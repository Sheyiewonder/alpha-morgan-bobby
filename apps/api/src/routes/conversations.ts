
import type { FastifyPluginAsync } from "fastify";

import { prisma } from "../plugins/prisma.js";
import { generateEmbedding } from "../services/embeddings.js";
import {
  evaluateHumanHandoff,
  generateBankingAnswer,
  generateConversationalResponse,
} from "../services/gemini.js";

interface CreateConversationBody {
  customerId?: string;
  title?: string;
  channel?: string;
}

interface ConversationParams {
  id: string;
}

interface ListConversationsQuery {
  page?: string;
  limit?: string;
}

interface CreateMessageBody {
  content: string;
}

interface KnowledgeDocument {
  id: string;
  title: string;
  category: string;
  content: string;
  similarity: number;
}

const ACTIVE_HANDOFF_STATUSES = [
  "PENDING",
  "ASSIGNED",
  "IN_PROGRESS",
] as const;

function isConversationalMessage(message: string): boolean {
  const normalize = (value: string) =>
    value
      .toLowerCase()
      .replace(/\bhow(?:'|’|â€™)re\b/g, "how are")
      .replace(/\bhow(?:'|’|â€™)s\b/g, "how is")
      .replace(/\bwhat(?:'|’|â€™)s\b/g, "what is")
      .replace(/\bwho(?:'|’|â€™)s\b/g, "who is")
      .replace(/\bi(?:'|’|â€™)m\b/g, "i am")
      .replace(/[^\p{L}\p{N}\s]/gu, " ")
      .replace(/\s+/g, " ")
      .trim();

  const normalized = normalize(message);

  // Banking intent always takes priority.
  const bankingIntent =
    /\b(account|accounts|bank|banking|transfer|transaction|transactions|balance|card|cards|atm|branch|loan|loans|password|ussd|fee|fees|interest|deposit|withdraw|withdrawal|payment|payments|complaint|debit|credit|money|cash|mobile app|internet banking|mobile banking|login|log in|sign in|blocked|failed transaction|forgot password|reset password)\b/i;

  if (bankingIntent.test(normalized)) {
    return false;
  }

  // Split combined messages into individual conversational statements.
  const segments = message
    .split(/[\n.!?;]+/)
    .map(normalize)
    .filter(Boolean);

  if (segments.length === 0) {
    return false;
  }

  const conversationalPatterns = [
    /^(hi|hello|hey)( there)?( bobby)?$/,
    /^(good morning|good afternoon|good evening)( bobby)?$/,
    /^(how are you|how are you doing)( today| this morning| this afternoon| this evening)?$/,
    /^(good morning|good afternoon|good evening)( bobby)? how are you( doing)?( today| this morning| this afternoon| this evening)?$/,
    /^how is your day( going| so far)?$/,

    // Introductions
    /^my name is [\p{L}]+(?: [\p{L}]+){0,3}$/u,
    /^i am [\p{L}]+(?: [\p{L}]+){0,3}$/u,
    /^call me [\p{L}]+(?: [\p{L}]+){0,3}$/u,

    // Appreciation
    /^(thank you|thanks|thanks a lot|thank you so much|many thanks)( bobby)?$/,
    /^(you are welcome|no problem|my pleasure)$/,

    // Farewells
    /^(bye|goodbye|see you|see you later|take care)( bobby)?$/,

    // About Bobby
    /^(who are you|what is your name|what should i call you)$/,
    /^(what can you do|how can you help me|what can you help me with)$/,

    // Social conversation
    /^(nice to meet you|good to meet you)$/,
    /^(i am happy to meet you|i am glad to meet you|i am pleased to meet you)$/,
    /^(i am happy to talk to you|i am glad to talk to you)$/,
  ];

  return segments.every((segment) => {
    const withoutGreeting = segment
      .replace(/^(?:(?:hi|hello|hey)(?: there)?(?: bobby)?\s*)+/, "")
      .trim();

    return conversationalPatterns.some(
      (pattern) =>
        pattern.test(segment) || pattern.test(withoutGreeting)
    );
  });
}

function isHumanSupportRequest(message: string): boolean {
  const normalized = message.toLowerCase();

  const directRequest =
    /\b(speak|talk|connect|transfer|put me through|refer|hand me over)\b.{0,60}\b(human|person|agent|representative|staff|customer service|support team)\b/i;

  const explicitHandoff =
    /\b(human agent|live agent|real person|human support|escalate this|request an escalation|speak to a human|talk to a human)\b/i;

  return (
    directRequest.test(normalized) ||
    explicitHandoff.test(normalized)
  );
}

async function createHumanSupportReferral(
  conversationId: string,
  reason: string,
  source:
    | "AI_DECISION"
    | "CUSTOMER_REQUEST"
    | "KNOWLEDGE_GAP"
    | "COMPLAINT"
    | "OTHER"
) {
  return prisma.$transaction(async (tx) => {
    // Reuse an existing active handoff where possible.
    const existingHandoff = await tx.humanHandoff.findFirst({
      where: {
        conversationId,
        status: {
          in: [...ACTIVE_HANDOFF_STATUSES],
        },
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    const handoff =
      existingHandoff ??
      (await tx.humanHandoff.create({
        data: {
          conversationId,
          reason,
          source,
          status: "PENDING",
        },
      }));

    // Knowledge gaps remain visible in the existing Escalations page.
    let escalation = null;

    if (source === "KNOWLEDGE_GAP") {
      const existingEscalation = await tx.escalation.findFirst({
        where: {
          conversationId,
          status: {
            in: [...ACTIVE_HANDOFF_STATUSES],
          },
        },
        orderBy: {
          createdAt: "desc",
        },
      });

      escalation =
        existingEscalation ??
        (await tx.escalation.create({
          data: {
            conversationId,
            reason,
            status: "PENDING",
          },
        }));
    }

    // Do not create duplicate acknowledgments for an existing handoff.
    const assistantMessage = existingHandoff
      ? null
      : await tx.message.create({
          data: {
            conversationId,
            role: "ASSISTANT",
            content: `I've referred this conversation to our human support team.

Reference ID: ${handoff.id}

A representative will be able to review your conversation and respond here. You can continue sending messages while you wait.`,
          },
        });

    await tx.conversation.update({
      where: { id: conversationId },
      data: {
        updatedAt: new Date(),
      },
    });

    return {
      handoff,
      escalation,
      assistantMessage,
    };
  });
}

const conversationRoutes: FastifyPluginAsync = async (app) => {
  // Create a conversation.
  app.post<{ Body: CreateConversationBody }>(
    "/conversations",
    {
      schema: {
        body: {
          type: "object",
          additionalProperties: false,
          properties: {
            customerId: { type: "string", minLength: 1 },
            title: { type: "string", maxLength: 120 },
            channel: { type: "string", maxLength: 30 },
          },
        },
      },
    },
    async (request, reply) => {
      const { customerId, title, channel } = request.body;

      if (customerId) {
        const customer = await prisma.customer.findUnique({
          where: { id: customerId },
          select: { id: true },
        });

        if (!customer) {
          return reply.code(404).send({
            success: false,
            message: "Customer not found.",
          });
        }
      }

      const conversation = await prisma.conversation.create({
        data: {
          ...(customerId ? { customerId } : {}),
          ...(title ? { title } : {}),
          channel: channel ?? "WEB",
        },
      });

      return reply.code(201).send({
        success: true,
        conversation,
      });
    }
  );

  // List conversations for the admin dashboard.
  app.get<{ Querystring: ListConversationsQuery }>(
    "/conversations",
    {
      schema: {
        querystring: {
          type: "object",
          additionalProperties: false,
          properties: {
            page: { type: "string", pattern: "^[1-9][0-9]*$" },
            limit: { type: "string", pattern: "^[1-9][0-9]*$" },
          },
        },
      },
    },
    async (request) => {
      const page = Math.max(1, Number(request.query.page ?? 1));
      const limit = Math.min(
        50,
        Math.max(1, Number(request.query.limit ?? 10))
      );

      const skip = (page - 1) * limit;

      const [conversations, total] = await Promise.all([
        prisma.conversation.findMany({
          orderBy: { updatedAt: "desc" },
          skip,
          take: limit,
          include: {
            customer: {
              select: {
                firstName: true,
                lastName: true,
                customerRef: true,
                segment: true,
              },
            },
            messages: {
              orderBy: { createdAt: "desc" },
              take: 1,
              select: {
                role: true,
                content: true,
                createdAt: true,
              },
            },
            _count: {
              select: {
                messages: true,
                escalations: true,
                humanHandoffs: true,
              },
            },
          },
        }),
        prisma.conversation.count(),
      ]);

      return {
        success: true,
        conversations,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      };
    }
  );

  // Retrieve a conversation and its message history.
  app.get<{ Params: ConversationParams }>(
    "/conversations/:id",
    async (request, reply) => {
      const conversation = await prisma.conversation.findUnique({
        where: { id: request.params.id },
        include: {
          messages: {
            orderBy: { createdAt: "asc" },
            take: 100,
          },
          escalations: {
            orderBy: { createdAt: "desc" },
          },
          humanHandoffs: {
            orderBy: { createdAt: "desc" },
          },
        },
      });

      if (!conversation) {
        return reply.code(404).send({
          success: false,
          message: "Conversation not found.",
        });
      }

      return {
        success: true,
        conversation,
      };
    }
  );

  // Save customer message, retrieve knowledge and generate Bobby's response.
  app.post<{
    Params: ConversationParams;
    Body: CreateMessageBody;
  }>(
    "/conversations/:id/messages",
    {
      schema: {
        body: {
          type: "object",
          required: ["content"],
          additionalProperties: false,
          properties: {
            content: {
              type: "string",
              minLength: 1,
              maxLength: 5000,
            },
          },
        },
      },
    },
    async (request, reply) => {
      const conversation = await prisma.conversation.findUnique({
        where: { id: request.params.id },
        select: {
          id: true,
          isResolved: true,
        },
      });

      if (!conversation) {
        return reply.code(404).send({
          success: false,
          message: "Conversation not found.",
        });
      }

      if (conversation.isResolved) {
        return reply.code(409).send({
          success: false,
          message: "This conversation has been resolved.",
        });
      }

      const content = request.body.content.trim();

      if (!content) {
        return reply.code(400).send({
          success: false,
          message: "Message content cannot be empty.",
        });
      }

      // 1. Save the customer's message.
      const userMessage = await prisma.message.create({
        data: {
          conversationId: conversation.id,
          role: "USER",
          content,
        },
      });

      await prisma.conversation.update({
        where: { id: conversation.id },
        data: {
          updatedAt: new Date(),
        },
      });

      try {
        // 2. Handle explicit requests for human support.
        if (isHumanSupportRequest(content)) {
          const referral = await createHumanSupportReferral(
            conversation.id,
            `Customer requested human support: ${content}`,
            "CUSTOMER_REQUEST"
          );

          request.log.info(
            {
              conversationId: conversation.id,
              handoffId: referral.handoff.id,
            },
            "Human support handoff created or reused"
          );

          return reply.code(201).send({
            success: true,
            userMessage,
            assistantMessage: referral.assistantMessage,
            handoff: referral.handoff,
            handoffActive: true,
            escalation: referral.escalation,
            sources: [],
          });
        }

        // 3. Check whether a human handoff is already active.
        const activeHandoff = await prisma.humanHandoff.findFirst({
          where: {
            conversationId: conversation.id,
            status: {
              in: [...ACTIVE_HANDOFF_STATUSES],
            },
          },
          orderBy: {
            createdAt: "desc",
          },
        });

        if (activeHandoff) {
          return reply.code(201).send({
            success: true,
            userMessage,
            assistantMessage: null,
            handoffActive: true,
            handoff: activeHandoff,
            sources: [],
          });
        }

        // Preserve compatibility with older knowledge-gap escalations
        // created before the HumanHandoff model was introduced.
        const activeEscalation = await prisma.escalation.findFirst({
          where: {
            conversationId: conversation.id,
            status: {
              in: [...ACTIVE_HANDOFF_STATUSES],
            },
          },
          orderBy: {
            createdAt: "desc",
          },
        });

        if (activeEscalation) {
          request.log.info(
            {
              conversationId: conversation.id,
              escalationId: activeEscalation.id,
              escalationStatus: activeEscalation.status,
            },
            "Bobby response skipped because human support is handling the conversation"
          );

          return reply.code(201).send({
            success: true,
            userMessage,
            assistantMessage: null,
            handoffActive: true,
            escalation: activeEscalation,
            sources: [],
          });
        }

        // 4. Handle ordinary conversation without knowledge retrieval.
        if (isConversationalMessage(content)) {
          const answer = await generateConversationalResponse(content);

          const handoffDecision = await evaluateHumanHandoff(
            content,
            answer
          );

          if (handoffDecision.needsHumanSupport) {
            const referral = await createHumanSupportReferral(
              conversation.id,
              handoffDecision.reason ||
                "Bobby determined that this conversation requires human assistance.",
              "AI_DECISION"
            );

            request.log.info(
              {
                conversationId: conversation.id,
                handoffId: referral.handoff.id,
                source: "AI_DECISION",
              },
              "Conversational message referred to human support"
            );

            return reply.code(201).send({
              success: true,
              userMessage,
              assistantMessage: referral.assistantMessage,
              handoff: referral.handoff,
              handoffActive: true,
              sources: [],
            });
          }

          // Check again in case another process created a handoff
          // while Bobby was generating or evaluating the response.
          const concurrentHandoff =
            await prisma.humanHandoff.findFirst({
              where: {
                conversationId: conversation.id,
                status: {
                  in: [...ACTIVE_HANDOFF_STATUSES],
                },
              },
              orderBy: {
                createdAt: "desc",
              },
            });

          if (concurrentHandoff) {
            return reply.code(201).send({
              success: true,
              userMessage,
              assistantMessage: null,
              handoffActive: true,
              handoff: concurrentHandoff,
              sources: [],
            });
          }

          const assistantMessage = await prisma.message.create({
            data: {
              conversationId: conversation.id,
              role: "ASSISTANT",
              content: answer,
            },
          });

          await prisma.conversation.update({
            where: { id: conversation.id },
            data: {
              updatedAt: new Date(),
            },
          });

          request.log.info(
            {
              conversationId: conversation.id,
              responseType: "conversation",
              handoffRequired: false,
            },
            "Conversational response generated"
          );

          return reply.code(201).send({
            success: true,
            userMessage,
            assistantMessage,
            handoffActive: false,
            sources: [],
          });
        }

        // 5. Banking enquiry: generate an embedding.
        const embedding = await generateEmbedding(content);
        const vector = `[${embedding.join(",")}]`;

        // 6. Retrieve relevant approved banking documents.
        const documents = await prisma.$queryRaw<KnowledgeDocument[]>`
          SELECT *
          FROM match_knowledge_documents(
            ${vector}::extensions.vector,
            CAST(0.25 AS DOUBLE PRECISION),
            CAST(5 AS INTEGER)
          )
        `;

        request.log.info(
          {
            conversationId: conversation.id,
            documentsFound: documents.length,
          },
          "Knowledge retrieval completed"
        );

        // 7. No approved knowledge found: refer to human support.
        if (documents.length === 0) {
          const referral = await createHumanSupportReferral(
            conversation.id,
            `Bobby could not find sufficient approved banking information to answer: ${content}`,
            "KNOWLEDGE_GAP"
          );

          request.log.info(
            {
              conversationId: conversation.id,
              handoffId: referral.handoff.id,
              escalationId: referral.escalation?.id,
            },
            "Knowledge gap referred to human support"
          );

          return reply.code(201).send({
            success: true,
            userMessage,
            assistantMessage: referral.assistantMessage,
            handoff: referral.handoff,
            handoffActive: true,
            escalation: referral.escalation,
            sources: [],
          });
        }

        // 8. Generate Bobby's banking response using approved documents.
        const answer = await generateBankingAnswer(content, documents);

        // 9. Evaluate whether the banking enquiry needs human intervention.
        const handoffDecision = await evaluateHumanHandoff(
          content,
          answer
        );

        if (handoffDecision.needsHumanSupport) {
          const referral = await createHumanSupportReferral(
            conversation.id,
            handoffDecision.reason ||
              "Bobby determined that this banking enquiry requires human assistance.",
            "AI_DECISION"
          );

          request.log.info(
            {
              conversationId: conversation.id,
              handoffId: referral.handoff.id,
              source: "AI_DECISION",
            },
            "Banking enquiry referred to human support"
          );

          return reply.code(201).send({
            success: true,
            userMessage,
            assistantMessage: referral.assistantMessage,
            handoff: referral.handoff,
            handoffActive: true,
            sources: documents.map((document) => ({
              id: document.id,
              title: document.title,
              category: document.category,
              similarity: document.similarity,
            })),
          });
        }

        // Check whether a representative took over while AI was processing.
        const concurrentHandoff = await prisma.humanHandoff.findFirst({
          where: {
            conversationId: conversation.id,
            status: {
              in: [...ACTIVE_HANDOFF_STATUSES],
            },
          },
          orderBy: {
            createdAt: "desc",
          },
        });

        if (concurrentHandoff) {
          return reply.code(201).send({
            success: true,
            userMessage,
            assistantMessage: null,
            handoffActive: true,
            handoff: concurrentHandoff,
            sources: [],
          });
        }

        // 10. Save Bobby's response normally.
        const assistantMessage = await prisma.message.create({
          data: {
            conversationId: conversation.id,
            role: "ASSISTANT",
            content: answer,
          },
        });

        await prisma.conversation.update({
          where: { id: conversation.id },
          data: {
            updatedAt: new Date(),
          },
        });

        return reply.code(201).send({
          success: true,
          userMessage,
          assistantMessage,
          handoffActive: false,
          sources: documents.map((document) => ({
            id: document.id,
            title: document.title,
            category: document.category,
            similarity: document.similarity,
          })),
        });
      } catch (error) {
        request.log.error(
          {
            err: error,
            conversationId: conversation.id,
          },
          "Failed to generate assistant response"
        );

        return reply.code(503).send({
          success: false,
          message:
            "Your message was received, but Bobby is temporarily unable to generate a response. Please try again shortly.",
          userMessage,
        });
      }
    }
  );
};

export default conversationRoutes;
