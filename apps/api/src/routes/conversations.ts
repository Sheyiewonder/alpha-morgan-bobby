
import type { FastifyPluginAsync } from "fastify";

import { prisma } from "../plugins/prisma.js";
import { generateEmbedding } from "../services/embeddings.js";
import {
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
  reason: string
) {
  return prisma.$transaction(async (tx) => {
    // Reuse an existing active escalation instead of creating duplicates.
    const existingEscalation = await tx.escalation.findFirst({
      where: {
        conversationId,
        status: {
          in: ["PENDING", "ASSIGNED", "IN_PROGRESS"],
        },
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    const escalation =
      existingEscalation ??
      (await tx.escalation.create({
        data: {
          conversationId,
          reason,
          status: "PENDING",
        },
      }));

    const assistantMessage = await tx.message.create({
      data: {
        conversationId,
        role: "ASSISTANT",
        content: existingEscalation
          ? `Your issue already has an active referral to our customer support team.

Your escalation is currently ${escalation.status.toLowerCase().replace("_", " ")}.

The expected response target is within 48 hours. This is a response target, not a guarantee that the issue will be resolved within that period.`
          : `I've successfully referred your issue to our customer support team.

Your support escalation has been created successfully.

Reference ID: ${escalation.id}

The expected response target is within 48 hours. This is a response target, not a guarantee that the issue will be resolved within that period.

You can continue this conversation while awaiting a response.`,
      },
    });

    await tx.conversation.update({
      where: { id: conversationId },
      data: { updatedAt: new Date() },
    });

    return {
      escalation,
      assistantMessage,
    };
  });
}


const conversationRoutes: FastifyPluginAsync = async (app) => {
  // Create a conversation
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


  // List conversations for the admin dashboard
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


  // Retrieve a conversation and its message history
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

  // Save customer message, retrieve knowledge and generate Bobby's response
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

      // 1. Save the customer's message
      const userMessage = await prisma.message.create({
        data: {
          conversationId: conversation.id,
          role: "USER",
          content,
        },
      });

      await prisma.conversation.update({
        where: { id: conversation.id },
        data: { updatedAt: new Date() },
      });

      
      
      try {
        // 2. Handle requests for human support.
        if (isHumanSupportRequest(content)) {
          const referral = await createHumanSupportReferral(
            conversation.id,
            `Customer requested human support: ${content}`
          );

          request.log.info(
            {
              conversationId: conversation.id,
              escalationId: referral.escalation.id,
            },
            "Human support escalation created or reused"
          );

          return reply.code(201).send({
            success: true,
            userMessage,
            assistantMessage: referral.assistantMessage,
            escalation: referral.escalation,
            sources: [],
          });
        }

        // 3. Handle ordinary conversation without knowledge retrieval.
                // 3. If a human support escalation is active,
        // save the customer's message without generating a Bobby response.
        const activeEscalation = await prisma.escalation.findFirst({
          where: {
            conversationId: conversation.id,
            status: {
              in: ["PENDING", "ASSIGNED", "IN_PROGRESS"],
            },
          },
          orderBy: {
            createdAt: "desc",
          },
          select: {
            id: true,
            status: true,
            assignedTo: true,
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
        
        if (isConversationalMessage(content)) {

          const answer = await generateConversationalResponse(content);

          const assistantMessage = await prisma.message.create({
            data: {
              conversationId: conversation.id,
              role: "ASSISTANT",
              content: answer,
            },
          });

          await prisma.conversation.update({
            where: { id: conversation.id },
            data: { updatedAt: new Date() },
          });

          request.log.info(
            {
              conversationId: conversation.id,
              responseType: "conversation",
            },
            "Conversational response generated"
          );

          return reply.code(201).send({
            success: true,
            userMessage,
            assistantMessage,
            sources: [],
          });
        }

        // 3. Banking enquiry: generate an embedding
        const embedding = await generateEmbedding(content);


        const vector = `[${embedding.join(",")}]`;

        // 3. Retrieve relevant approved banking documents
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


        // 4. No approved knowledge found: refer to human support.
        if (documents.length === 0) {
          const referral = await createHumanSupportReferral(
            conversation.id,
            `Bobby could not find sufficient approved banking information to answer: ${content}`
          );

          request.log.info(
            {
              conversationId: conversation.id,
              escalationId: referral.escalation.id,
            },
            "Knowledge-base fallback escalated to human support"
          );

          return reply.code(201).send({
            success: true,
            userMessage,
            assistantMessage: referral.assistantMessage,
            escalation: referral.escalation,
            sources: [],
          });
        }


        // 4. Generate Bobby's response using Gemini
        const answer = await generateBankingAnswer(
          content,
          documents
        );

        // 5. Save Bobby's response
        const assistantMessage = await prisma.message.create({
          data: {
            conversationId: conversation.id,
            role: "ASSISTANT",
            content: answer,
          },
        });

        await prisma.conversation.update({
          where: { id: conversation.id },
          data: { updatedAt: new Date() },
        });

        // 6. Return the complete response
        return reply.code(201).send({
          success: true,
          userMessage,
          assistantMessage,
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