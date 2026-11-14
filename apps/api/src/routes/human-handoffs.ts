
import type { FastifyPluginAsync } from "fastify";
import type {
  HumanHandoffStatus,
  Prisma,
} from "@prisma/client";
import { prisma } from "../plugins/prisma.js";

interface HandoffQuery {
  page?: string;
  limit?: string;
  search?: string;
  status?: string;
}

interface HandoffParams {
  id: string;
}

interface UpdateHandoffBody {
  status?: string;
  assignedTo?: string | null;
}

interface ClaimHandoffBody {
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

const ACTIVE_HANDOFF_STATUSES = [
  "PENDING",
  "ASSIGNED",
  "IN_PROGRESS",
] as const;

const handoffInclude = {
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
          id: true,
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
  complaint: {
    select: {
      id: true,
    },
  },
};

// Backfill historical complaints and escalations.
// Complaints are processed first so they receive priority
// when a conversation has both an unresolved complaint and escalation.
async function backfillHistoricalHandoffs() {
  let created = 0;
  let skipped = 0;
  let checked = 0;

  // 1. Backfill unresolved historical complaints.
  const complaints = await prisma.complaint.findMany({
    where: {
      conversationId: {
        not: null,
      },
      status: {
        in: ["OPEN", "ACKNOWLEDGED", "IN_PROGRESS"],
      },
    },
    orderBy: {
      createdAt: "asc",
    },
  });

  checked += complaints.length;

  for (const complaint of complaints) {
    const conversationId = complaint.conversationId;

    if (!conversationId) {
      skipped++;
      continue;
    }

    // Do not recreate a handoff for an existing complaint.
    const existingComplaintHandoff =
      await prisma.humanHandoff.findFirst({
        where: {
          complaintId: complaint.id,
        },
      });

    if (existingComplaintHandoff) {
      skipped++;
      continue;
    }

    // Avoid multiple active handoffs for one conversation.
    const existingActiveHandoff =
      await prisma.humanHandoff.findFirst({
        where: {
          conversationId,
          status: {
            in: [...ACTIVE_HANDOFF_STATUSES],
          },
        },
      });

    if (existingActiveHandoff) {
      skipped++;
      continue;
    }

    await prisma.humanHandoff.create({
      data: {
        conversationId,
        complaintId: complaint.id,
        reason: `Historical complaint ${complaint.reference}: ${complaint.subject}\n\n${complaint.description}`,
        source: "COMPLAINT",
        status:
          complaint.status === "IN_PROGRESS"
            ? "IN_PROGRESS"
            : "PENDING",
      },
    });

    created++;
  }

  // 2. Backfill unresolved historical escalations.
  const escalations = await prisma.escalation.findMany({
    where: {
      status: {
        in: ["PENDING", "ASSIGNED", "IN_PROGRESS"],
      },
    },
    orderBy: {
      createdAt: "asc",
    },
  });

  checked += escalations.length;

  for (const escalation of escalations) {
    // Do not recreate an existing knowledge-gap handoff.
    const existingSourceHandoff =
      await prisma.humanHandoff.findFirst({
        where: {
          conversationId: escalation.conversationId,
          source: "KNOWLEDGE_GAP",
        },
      });

    if (existingSourceHandoff) {
      skipped++;
      continue;
    }

    // Avoid multiple active handoffs for one conversation.
    const existingActiveHandoff =
      await prisma.humanHandoff.findFirst({
        where: {
          conversationId: escalation.conversationId,
          status: {
            in: [...ACTIVE_HANDOFF_STATUSES],
          },
        },
      });

    if (existingActiveHandoff) {
      skipped++;
      continue;
    }

    await prisma.humanHandoff.create({
      data: {
        conversationId: escalation.conversationId,
        reason: escalation.reason,
        source: "KNOWLEDGE_GAP",
        status: escalation.status,
        assignedTo: escalation.assignedTo,
      },
    });

    created++;
  }

  return {
    created,
    skipped,
    checked,
  };
}

const humanHandoffRoutes: FastifyPluginAsync = async (app) => {
   // Run historical backfill in the background.
  // Do not block Fastify route registration while it runs.
  void backfillHistoricalHandoffs()
    .then((result) => {
      app.log.info(
        {
          created: result.created,
          skipped: result.skipped,
          checked: result.checked,
        },
        "Historical human handoff backfill completed"
      );
    })
    .catch((error) => {
      app.log.error(
        error,
        "Historical human handoff backfill failed"
      );
    });


  // GET /api/human-handoffs/notifications
  // Dashboard counts and recent handoffs awaiting a representative response.
  app.get("/human-handoffs/notifications", async (_request, reply) => {
    const [unattendedCount, activeHandoffs] = await Promise.all([
      prisma.humanHandoff.count({
        where: {
          status: "PENDING",
          assignedTo: null,
        },
      }),

      prisma.humanHandoff.findMany({
        where: {
          status: {
            in: [...ACTIVE_HANDOFF_STATUSES],
          },
        },
        orderBy: {
          updatedAt: "desc",
        },
        select: {
          id: true,
          status: true,
          source: true,
          reason: true,
          assignedTo: true,
          updatedAt: true,
          conversation: {
            select: {
              id: true,
              title: true,
              customer: {
                select: {
                  firstName: true,
                  lastName: true,
                },
              },
              messages: {
                orderBy: {
                  createdAt: "desc",
                },
                take: 1,
                select: {
                  id: true,
                  role: true,
                  content: true,
                  createdAt: true,
                },
              },
            },
          },
        },
      }),
    ]);

    // A handoff needs a response when its latest message is from the customer.
    const awaitingResponse = activeHandoffs.filter(
      (handoff) => handoff.conversation.messages[0]?.role === "USER"
    );

    return reply.send({
      success: true,
      counts: {
        unattended: unattendedCount,
        newMessages: awaitingResponse.length,
      },
      notifications: awaitingResponse.slice(0, 8),
      checkedAt: new Date().toISOString(),
    });
  });

  // GET /api/human-handoffs
  // List and filter human handoffs.
  app.get<{ Querystring: HandoffQuery }>(
    "/human-handoffs",
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
          message: "Invalid human handoff status.",
        });
      }

      const where: Prisma.HumanHandoffWhereInput = {
        ...(status
          ? { status: status as HumanHandoffStatus }
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

      const [handoffs, total] = await Promise.all([
        prisma.humanHandoff.findMany({
          where,
          orderBy: { createdAt: "desc" },
          skip: (page - 1) * limit,
          take: limit,
          include: handoffInclude,
        }),
        prisma.humanHandoff.count({ where }),
      ]);

      return {
        success: true,
        handoffs,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      };
    }
  );

  // GET /api/human-handoffs/:id
  // Retrieve a handoff and its original conversation history.
  app.get<{ Params: HandoffParams }>(
    "/human-handoffs/:id",
    async (request, reply) => {
      const handoff = await prisma.humanHandoff.findUnique({
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
          complaint: {
            select: {
              id: true,
            },
          },
        },
      });

      if (!handoff) {
        return reply.code(404).send({
          success: false,
          message: "Human handoff not found.",
        });
      }

      return {
        success: true,
        handoff,
      };
    }
  );

  // POST /api/human-handoffs/:id/claim
  // Atomically claim an unassigned pending handoff.
  app.post<{
    Params: HandoffParams;
    Body: ClaimHandoffBody;
  }>("/human-handoffs/:id/claim", async (request, reply) => {
    const assignedTo = request.body?.assignedTo?.trim();

    if (!assignedTo) {
      return reply.code(400).send({
        success: false,
        message: "A representative name is required.",
      });
    }

    const result = await prisma.humanHandoff.updateMany({
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
      const existing = await prisma.humanHandoff.findUnique({
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
          message: "Human handoff not found.",
        });
      }

      return reply.code(409).send({
        success: false,
        message: existing.assignedTo
          ? `This handoff has already been claimed by ${existing.assignedTo}.`
          : `This handoff cannot be claimed because its status is ${existing.status}.`,
      });
    }

    const handoff = await prisma.humanHandoff.findUnique({
      where: { id: request.params.id },
      include: handoffInclude,
    });

    return {
      success: true,
      message: "Human handoff claimed successfully.",
      handoff,
    };
  });

  // POST /api/human-handoffs/:id/messages
  // Save a representative reply in the original conversation.
  app.post<{
    Params: HandoffParams;
    Body: AgentMessageBody;
  }>("/human-handoffs/:id/messages", async (request, reply) => {
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
      const handoff = await tx.humanHandoff.findUnique({
        where: { id: request.params.id },
        select: {
          id: true,
          conversationId: true,
          status: true,
          assignedTo: true,
        },
      });

      if (!handoff) {
        return { error: "NOT_FOUND" as const };
      }

      if (
        handoff.assignedTo !== assignedTo ||
        !ACTIVE_HANDOFF_STATUSES.includes(
          handoff.status as (typeof ACTIVE_HANDOFF_STATUSES)[number]
        ) ||
        handoff.status === "PENDING"
      ) {
        return { error: "NOT_ASSIGNED" as const };
      }

      const message = await tx.message.create({
        data: {
          conversationId: handoff.conversationId,
          role: "AGENT",
          content,
        },
      });

      await tx.humanHandoff.update({
        where: { id: handoff.id },
        data: { status: "IN_PROGRESS" },
      });

      await tx.conversation.update({
        where: { id: handoff.conversationId },
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
        message: "Human handoff not found.",
      });
    }

    if (result.error === "NOT_ASSIGNED") {
      return reply.code(403).send({
        success: false,
        message:
          "You must claim this active handoff before sending a reply.",
      });
    }

    return reply.code(201).send({
      success: true,
      message: "Your reply has been added to the conversation.",
      agentMessage: result.message,
    });
  });

  // PATCH /api/human-handoffs/:id
  // Update handoff status or representative assignment.
  app.patch<{
    Params: HandoffParams;
    Body: UpdateHandoffBody;
  }>("/human-handoffs/:id", async (request, reply) => {
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
        message: "Invalid human handoff status.",
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

    const existing = await prisma.humanHandoff.findUnique({
      where: { id: request.params.id },
      select: { id: true },
    });

    if (!existing) {
      return reply.code(404).send({
        success: false,
        message: "Human handoff not found.",
      });
    }

    const data: {
        status?: HumanHandoffStatus;
        assignedTo?: string | null;
        } = {};

        if (hasStatus) {
        data.status = status as HumanHandoffStatus;
        }

        if (hasAssignedTo) {
        data.assignedTo =
            assignedTo === null ? null : assignedTo!.trim();
        }

    const handoff = await prisma.humanHandoff.update({
      where: { id: request.params.id },
      data,
      include: handoffInclude,
    });

    return {
      success: true,
      message: "Human handoff updated successfully.",
      handoff,
    };
  });
};

export default humanHandoffRoutes;
