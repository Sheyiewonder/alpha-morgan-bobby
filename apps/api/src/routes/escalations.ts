
import type { FastifyPluginAsync } from "fastify";
import type {
  EscalationStatus,
  Prisma,
} from "@prisma/client";
import { prisma } from "../plugins/prisma.js";

interface EscalationQuery {
  page?: string;
  limit?: string;
  search?: string;
  status?: string;
}

interface EscalationParams {
  id: string;
}

interface UpdateEscalationBody {
  status?: string;
  assignedTo?: string | null;
}

interface ClaimEscalationBody {
  assignedTo: string;
}

interface AgentMessageBody {
  assignedTo: string;
  content: string;
}

const allowedStatuses = [
  "PENDING",
  "ASSIGNED",
  "IN_PROGRESS",
  "RESOLVED",
] as const;

const escalationInclude = {
  conversation: {
    select: {
      id: true,
      title: true,
      channel: true,
      isResolved: true,
      createdAt: true,
      customer: {
        select: {
          firstName: true,
          lastName: true,
          customerRef: true,
          segment: true,
        },
      },
      messages: {
        orderBy: { createdAt: "desc" as const },
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
        },
      },
    },
  },
};

const escalationRoutes: FastifyPluginAsync = async (app) => {
  // GET /api/escalations
  // List and filter escalations.
  app.get<{ Querystring: EscalationQuery }>(
    "/escalations",
    async (request, reply) => {
      const page = Math.max(1, Number(request.query.page) || 1);
      const limit = Math.min(
        50,
        Math.max(1, Number(request.query.limit) || 10)
      );

      const search = request.query.search?.trim();
      const status = request.query.status;

      if (
        status &&
        !allowedStatuses.includes(
          status as (typeof allowedStatuses)[number]
        )
      ) {
        return reply.code(400).send({
          success: false,
          message: "Invalid escalation status.",
        });
      }

      const where: Prisma.EscalationWhereInput = {
        ...(status
          ? { status: status as EscalationStatus }
          : {}),
        ...(search
          ? {
              OR: [
                {
                  reason: {
                    contains: search,
                    mode: "insensitive",
                  },
                },
                {
                  assignedTo: {
                    contains: search,
                    mode: "insensitive",
                  },
                },
                {
                  conversation: {
                    is: {
                      title: {
                        contains: search,
                        mode: "insensitive",
                      },
                    },
                  },
                },
                {
                  conversation: {
                    is: {
                      customer: {
                        is: {
                          firstName: {
                            contains: search,
                            mode: "insensitive",
                          },
                        },
                      },
                    },
                  },
                },
                {
                  conversation: {
                    is: {
                      customer: {
                        is: {
                          lastName: {
                            contains: search,
                            mode: "insensitive",
                          },
                        },
                      },
                    },
                  },
                },
                {
                  conversation: {
                    is: {
                      customer: {
                        is: {
                          customerRef: {
                            contains: search,
                            mode: "insensitive",
                          },
                        },
                      },
                    },
                  },
                },
              ],
            }
          : {}),
      };

      const [escalations, total] = await Promise.all([
        prisma.escalation.findMany({
          where,
          orderBy: { createdAt: "desc" },
          skip: (page - 1) * limit,
          take: limit,
          include: escalationInclude,
        }),
        prisma.escalation.count({ where }),
      ]);

      return {
        success: true,
        escalations,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      };
    }
  );

  // GET /api/escalations/:id
  // Retrieve one escalation and its conversation history.
  app.get<{ Params: EscalationParams }>(
    "/escalations/:id",
    async (request, reply) => {
      const escalation = await prisma.escalation.findUnique({
        where: { id: request.params.id },
        include: {
          conversation: {
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
                orderBy: { createdAt: "asc" },
                take: 100,
              },
            },
          },
        },
      });

      if (!escalation) {
        return reply.code(404).send({
          success: false,
          message: "Escalation not found.",
        });
      }

      return {
        success: true,
        escalation,
      };
    }
  );

  // PATCH /api/escalations/:id
  // Update escalation status or assigned support representative.
    // POST /api/escalations/:id/claim
  // Atomically claim a pending escalation.
  app.post<{
    Params: EscalationParams;
    Body: ClaimEscalationBody;
  }>("/escalations/:id/claim", async (request, reply) => {
    const assignedTo = request.body?.assignedTo?.trim();

    if (!assignedTo) {
      return reply.code(400).send({
        success: false,
        message: "A representative name is required.",
      });
    }

    const result = await prisma.escalation.updateMany({
      where: {
        id: request.params.id,
        status: "PENDING",
        assignedTo: null,
      },
      data: {
        assignedTo,
        status: "ASSIGNED",
      },
    });

    if (result.count === 0) {
      const existing = await prisma.escalation.findUnique({
        where: { id: request.params.id },
        select: {
          id: true,
          status: true,
          assignedTo: true,
        },
      });

      if (!existing) {
        return reply.code(404).send({
          success: false,
          message: "Escalation not found.",
        });
      }

      return reply.code(409).send({
        success: false,
        message:
          existing.assignedTo
            ? `This escalation has already been claimed by ${existing.assignedTo}.`
            : `This escalation cannot be claimed because its status is ${existing.status}.`,
      });
    }

    const escalation = await prisma.escalation.findUnique({
      where: { id: request.params.id },
      include: escalationInclude,
    });

    return {
      success: true,
      message: "Conversation claimed successfully.",
      escalation,
    };
  });

  // POST /api/escalations/:id/messages
  // Send a representative's reply into the original conversation.
  app.post<{
    Params: EscalationParams;
    Body: AgentMessageBody;
  }>("/escalations/:id/messages", async (request, reply) => {
    const assignedTo = request.body?.assignedTo?.trim();
    const content = request.body?.content?.trim();

    if (!assignedTo || !content) {
      return reply.code(400).send({
        success: false,
        message: "Representative name and message content are required.",
      });
    }

    if (content.length > 5000) {
      return reply.code(400).send({
        success: false,
        message: "Messages cannot exceed 5,000 characters.",
      });
    }

    const result = await prisma.$transaction(async (tx) => {
      const escalation = await tx.escalation.findUnique({
        where: { id: request.params.id },
        select: {
          id: true,
          conversationId: true,
          status: true,
          assignedTo: true,
        },
      });

      if (!escalation) {
        return { error: "NOT_FOUND" as const };
      }

      if (
        escalation.assignedTo !== assignedTo ||
        !["ASSIGNED", "IN_PROGRESS"].includes(escalation.status)
      ) {
        return { error: "NOT_ASSIGNED" as const };
      }

      const message = await tx.message.create({
        data: {
          conversationId: escalation.conversationId,
          role: "AGENT",
          content,
        },
      });

      await tx.escalation.update({
        where: { id: escalation.id },
        data: { status: "IN_PROGRESS" },
      });

      await tx.conversation.update({
        where: { id: escalation.conversationId },
        data: { updatedAt: new Date() },
      });

      return {
        error: null as null,
        message,
      };
    });

    if (result.error === "NOT_FOUND") {
      return reply.code(404).send({
        success: false,
        message: "Escalation not found.",
      });
    }

    if (result.error === "NOT_ASSIGNED") {
      return reply.code(403).send({
        success: false,
        message:
          "You must claim this active escalation before sending a reply.",
      });
    }

    return reply.code(201).send({
      success: true,
      message: "Your reply has been added to the conversation.",
      agentMessage: result.message,
    });
  });
  
  app.patch<{
    Params: EscalationParams;
    Body: UpdateEscalationBody;
  }>("/escalations/:id", async (request, reply) => {
    const { status, assignedTo } = request.body ?? {};

    const hasStatus = Object.prototype.hasOwnProperty.call(
      request.body ?? {},
      "status"
    );

    const hasAssignedTo = Object.prototype.hasOwnProperty.call(
      request.body ?? {},
      "assignedTo"
    );

    if (!hasStatus && !hasAssignedTo) {
      return reply.code(400).send({
        success: false,
        message: "Provide a status or assignedTo value to update.",
      });
    }

    if (
      hasStatus &&
      !allowedStatuses.includes(
        status as (typeof allowedStatuses)[number]
      )
    ) {
      return reply.code(400).send({
        success: false,
        message: "Invalid escalation status.",
      });
    }

    if (
      hasAssignedTo &&
      assignedTo !== null &&
      (typeof assignedTo !== "string" || assignedTo.trim().length === 0)
    ) {
      return reply.code(400).send({
        success: false,
        message: "assignedTo must be a non-empty string or null.",
      });
    }

    const existing = await prisma.escalation.findUnique({
      where: { id: request.params.id },
      select: { id: true },
    });

    if (!existing) {
      return reply.code(404).send({
        success: false,
        message: "Escalation not found.",
      });
    }

    const data: Prisma.EscalationUpdateInput = {};

    if (hasStatus) {
      data.status = status as EscalationStatus;
    }

    if (hasAssignedTo) {
      data.assignedTo =
        assignedTo === null ? null : assignedTo!.trim();
    }

    const escalation = await prisma.escalation.update({
      where: { id: request.params.id },
      data,
      include: escalationInclude,
    });

    return {
      success: true,
      message: "Escalation updated successfully.",
      escalation,
    };
  });
};

export default escalationRoutes;
