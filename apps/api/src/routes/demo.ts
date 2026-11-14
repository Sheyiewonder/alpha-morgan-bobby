
import type { FastifyPluginAsync } from "fastify";
import { randomUUID } from "node:crypto";

import { prisma } from "../plugins/prisma.js";

const DEMO_CUSTOMER_REF = "DEMO-CUST-001";

// Fixed demonstration value. This is not a real account balance.
const SIMULATED_BALANCE = "485000.00";

const complaintCategories = [
  "FAILED_TRANSACTION",
  "INCORRECT_TRANSACTION",
  "WRONG_RECIPIENT",
  "OTHER",
] as const;

type ComplaintCategory = (typeof complaintCategories)[number];

interface CreateDemoComplaintBody {
  category: ComplaintCategory;
  description: string;
  transactionReference?: string;
}

const categorySubjects: Record<ComplaintCategory, string> = {
  FAILED_TRANSACTION: "Failed transaction report",
  INCORRECT_TRANSACTION: "Incorrect transaction report",
  WRONG_RECIPIENT: "Wrong recipient report",
  OTHER: "Other banking issue",
};

function createTicketReference() {
  return `DEMO-CMP-${randomUUID()
    .replace(/-/g, "")
    .slice(0, 12)
    .toUpperCase()}`;
}

const demoRoutes: FastifyPluginAsync = async (app) => {
  // Get the synthetic customer profile and transaction history.
  // Each transaction includes its linked complaint, if one exists.
  app.get("/demo/customer", async (_request, reply) => {
    const customer = await prisma.customer.findUnique({
      where: { customerRef: DEMO_CUSTOMER_REF },
      select: {
        customerRef: true,
        firstName: true,
        lastName: true,
        segment: true,
        transactions: {
          orderBy: { transactionDate: "desc" },
          select: {
            id: true,
            reference: true,
            description: true,
            amount: true,
            currency: true,
            status: true,
            type: true,
            counterparty: true,
            transactionDate: true,
            complaint: {
              select: {
                reference: true,
                subject: true,
                category: true,
                priority: true,
                status: true,
                conversationId: true,
                createdAt: true,
              },
            },
          },
        },
      },
    });

    if (!customer) {
      return reply.code(404).send({
        success: false,
        message: "The demo customer has not been seeded yet.",
      });
    }

    return reply.send({
      success: true,
      simulationOnly: true,
      notice: "DEMO DATA — NOT A REAL BANK ACCOUNT",
      customer: {
        customerRef: customer.customerRef,
        firstName: customer.firstName,
        lastName: customer.lastName,
        fullName: `${customer.firstName} ${customer.lastName}`,
        segment: customer.segment,
      },
      balance: {
        amount: SIMULATED_BALANCE,
        currency: "NGN",
        label: "Account balance",
      },
      transactions: customer.transactions.map((transaction) => ({
        ...transaction,
        amount: transaction.amount.toString(),
      })),
    });
  });

  // Submit a complaint and create its Bobby conversation atomically.
  app.post<{ Body: CreateDemoComplaintBody }>(
    "/demo/complaints",
    {
      schema: {
        body: {
          type: "object",
          additionalProperties: false,
          required: ["category", "description"],
          properties: {
            category: {
              type: "string",
              enum: [...complaintCategories],
            },
            description: {
              type: "string",
              minLength: 10,
              maxLength: 2000,
            },
            transactionReference: {
              type: "string",
              minLength: 1,
              maxLength: 100,
            },
          },
        },
      },
    },
    async (request, reply) => {
      const { category, description, transactionReference } = request.body;

      const customer = await prisma.customer.findUnique({
        where: { customerRef: DEMO_CUSTOMER_REF },
        select: { id: true },
      });

      if (!customer) {
        return reply.code(404).send({
          success: false,
          message: "The demo customer has not been seeded yet.",
        });
      }

      // Verify that the transaction belongs to the demo customer.
      const transaction = transactionReference
        ? await prisma.transaction.findFirst({
            where: {
              reference: transactionReference,
              customerId: customer.id,
            },
            select: {
              id: true,
              reference: true,
              description: true,
              amount: true,
              currency: true,
              status: true,
              type: true,
              counterparty: true,
              transactionDate: true,
              complaint: {
                select: {
                  reference: true,
                  status: true,
                  createdAt: true,
                  conversationId: true,
                },
              },
            },
          })
        : null;

      if (transactionReference && !transaction) {
        return reply.code(400).send({
          success: false,
          message: "That transaction does not belong to the demo customer.",
        });
      }

      // A transaction can only have one complaint.
      if (transaction?.complaint) {
        return reply.code(409).send({
          success: false,
          message: "This transaction has already been reported.",
          existingComplaint: transaction.complaint,
        });
      }

      const reference = createTicketReference();

      const transactionSummary = transaction
        ? [
            `Transaction reference: ${transaction.reference}`,
            `Transaction description: ${transaction.description}`,
            `Transaction amount: ${transaction.currency} ${transaction.amount.toString()}`,
            `Transaction status: ${transaction.status}`,
            `Transaction type: ${transaction.type}`,
            `Counterparty: ${transaction.counterparty ?? "Not specified"}`,
            `Transaction date: ${transaction.transactionDate.toISOString()}`,
          ].join("\n")
        : "No specific transaction was attached to this report.";

      const complaintDescription = [
        description.trim(),
        transactionSummary,
        "This complaint was submitted through the synthetic demonstration dashboard.",
      ].join("\n\n");

      const conversationTitle = transaction
        ? `Transaction report · ${transaction.reference}`
        : `Support report · ${reference}`;

      const acknowledgement = [
        `Your report has been recorded successfully.`,
        "",
        `Ticket reference: ${reference}`,
        transaction
          ? `Transaction reference: ${transaction.reference}`
          : null,
        "",
        "You can track this report from your dashboard.",
        "",
        "For this demonstration, the support queue has a 48-hour response target. This is an expected response timeframe, not a guarantee of resolution.",
        "",
        "This is a simulated demonstration and not a real bank dispute or investigation.",
      ]
        .filter(Boolean)
        .join("\n");

      try {
        const result = await prisma.$transaction(async (tx) => {
          // Create the conversation and its first two messages.
          const conversation = await tx.conversation.create({
            data: {
              customerId: customer.id,
              title: conversationTitle,
              channel: "WEB",
              messages: {
                create: [
                  {
                    role: "USER",
                    content: [
                      "I would like to report a transaction or banking issue.",
                      "",
                      `Report category: ${category}`,
                      `Description: ${description.trim()}`,
                      "",
                      transactionSummary,
                    ].join("\n"),
                  },
                  {
                    role: "ASSISTANT",
                    content: acknowledgement,
                  },
                ],
              },
            },
            select: {
              id: true,
              title: true,
              createdAt: true,
            },
          });

          // Create the complaint and link it to the transaction
          // and the newly created Bobby conversation.
          const complaint = await tx.complaint.create({
            data: {
              reference,
              customerId: customer.id,
              transactionId: transaction?.id ?? null,
              conversationId: conversation.id,
              subject: categorySubjects[category],
              description: complaintDescription,
              category,
              priority:
                category === "FAILED_TRANSACTION" ||
                category === "WRONG_RECIPIENT"
                  ? "HIGH"
                  : "MEDIUM",
            },
            select: {
              id: true,
              reference: true,
              subject: true,
              description: true,
              category: true,
              priority: true,
              status: true,
              transactionId: true,
              conversationId: true,
              createdAt: true,
            },
          });

          return { complaint, conversation };
        });

        return reply.code(201).send({
          success: true,
          simulationOnly: true,
          message: "Your report has been recorded in the demonstration support queue.",
          complaint: result.complaint,
          conversation: result.conversation,
        });
      } catch (error) {
        // Handle simultaneous submissions for the same transaction.
        // The unique database constraint is the final safeguard.
        if (
          error &&
          typeof error === "object" &&
          "code" in error &&
          error.code === "P2002" &&
          transaction
        ) {
          const existingComplaint = await prisma.complaint.findUnique({
            where: { transactionId: transaction.id },
            select: {
              reference: true,
              status: true,
              createdAt: true,
              conversationId: true,
            },
          });

          if (existingComplaint) {
            return reply.code(409).send({
              success: false,
              message: "This transaction has already been reported.",
              existingComplaint,
            });
          }
        }

        throw error;
      }
    },
  );

  // List all reports belonging to the synthetic demo customer.
  // Includes linked transaction, conversation and escalation information.
  app.get("/demo/tickets", async (_request, reply) => {
    const customer = await prisma.customer.findUnique({
      where: { customerRef: DEMO_CUSTOMER_REF },
      select: { id: true },
    });

    if (!customer) {
      return reply.code(404).send({
        success: false,
        message: "The demo customer has not been seeded yet.",
      });
    }

    const tickets = await prisma.complaint.findMany({
      where: { customerId: customer.id },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        reference: true,
        subject: true,
        description: true,
        category: true,
        priority: true,
        status: true,
        createdAt: true,
        updatedAt: true,
        transaction: {
          select: {
            reference: true,
            description: true,
            amount: true,
            currency: true,
            status: true,
            transactionDate: true,
          },
        },
        conversation: {
          select: {
            id: true,
            title: true,
            escalations: {
              orderBy: { createdAt: "desc" },
              select: {
                id: true,
                status: true,
                reason: true,
                createdAt: true,
              },
            },
          },
        },
      },
    });

    return reply.send({
      success: true,
      simulationOnly: true,
      tickets: tickets.map((ticket) => ({
        ...ticket,
        transaction: ticket.transaction
          ? {
              ...ticket.transaction,
              amount: ticket.transaction.amount.toString(),
            }
          : null,
      })),
    });
  });
};

export default demoRoutes;
