import { prisma } from "../plugins/prisma.js";
const complaintStatuses = [
    "OPEN",
    "ACKNOWLEDGED",
    "IN_PROGRESS",
    "RESOLVED",
    "CLOSED",
];
const complaintPriorities = [
    "LOW",
    "MEDIUM",
    "HIGH",
    "URGENT",
];
const customerSelect = {
    firstName: true,
    lastName: true,
    customerRef: true,
    segment: true,
};
const complaintRoutes = async (app) => {
    // List complaints with pagination, search and filters.
    app.get("/complaints", {
        schema: {
            querystring: {
                type: "object",
                additionalProperties: false,
                properties: {
                    page: { type: "string", pattern: "^[1-9][0-9]*$" },
                    limit: { type: "string", pattern: "^[1-9][0-9]*$" },
                    search: { type: "string", maxLength: 100 },
                    status: {
                        type: "string",
                        enum: complaintStatuses,
                    },
                    priority: {
                        type: "string",
                        enum: complaintPriorities,
                    },
                },
            },
        },
    }, async (request) => {
        const page = Math.max(1, Number(request.query.page ?? 1));
        const limit = Math.min(50, Math.max(1, Number(request.query.limit ?? 10)));
        const skip = (page - 1) * limit;
        const search = request.query.search?.trim();
        const where = {
            ...(request.query.status
                ? { status: request.query.status }
                : {}),
            ...(request.query.priority
                ? { priority: request.query.priority }
                : {}),
            ...(search
                ? {
                    OR: [
                        {
                            reference: {
                                contains: search,
                                mode: "insensitive",
                            },
                        },
                        {
                            subject: {
                                contains: search,
                                mode: "insensitive",
                            },
                        },
                        {
                            description: {
                                contains: search,
                                mode: "insensitive",
                            },
                        },
                        {
                            category: {
                                contains: search,
                                mode: "insensitive",
                            },
                        },
                        {
                            customer: {
                                is: {
                                    OR: [
                                        {
                                            firstName: {
                                                contains: search,
                                                mode: "insensitive",
                                            },
                                        },
                                        {
                                            lastName: {
                                                contains: search,
                                                mode: "insensitive",
                                            },
                                        },
                                        {
                                            customerRef: {
                                                contains: search,
                                                mode: "insensitive",
                                            },
                                        },
                                    ],
                                },
                            },
                        },
                    ],
                }
                : {}),
        };
        const [complaints, total] = await Promise.all([
            prisma.complaint.findMany({
                where,
                orderBy: { createdAt: "desc" },
                skip,
                take: limit,
                include: {
                    customer: {
                        select: customerSelect,
                    },
                },
            }),
            prisma.complaint.count({ where }),
        ]);
        return {
            success: true,
            complaints,
            pagination: {
                page,
                limit,
                total,
                totalPages: Math.ceil(total / limit),
            },
        };
    });
    // Retrieve one complaint with its full details.
    app.get("/complaints/:id", async (request, reply) => {
        const complaint = await prisma.complaint.findUnique({
            where: { id: request.params.id },
            include: {
                customer: {
                    select: customerSelect,
                },
            },
        });
        if (!complaint) {
            return reply.code(404).send({
                success: false,
                message: "Complaint not found.",
            });
        }
        return {
            success: true,
            complaint,
        };
    });
    // Update complaint status and/or priority.
    app.patch("/complaints/:id", {
        schema: {
            body: {
                type: "object",
                minProperties: 1,
                additionalProperties: false,
                properties: {
                    status: {
                        type: "string",
                        enum: complaintStatuses,
                    },
                    priority: {
                        type: "string",
                        enum: complaintPriorities,
                    },
                },
            },
        },
    }, async (request, reply) => {
        const existingComplaint = await prisma.complaint.findUnique({
            where: { id: request.params.id },
            select: { id: true },
        });
        if (!existingComplaint) {
            return reply.code(404).send({
                success: false,
                message: "Complaint not found.",
            });
        }
        const complaint = await prisma.complaint.update({
            where: { id: request.params.id },
            data: {
                ...(request.body.status
                    ? { status: request.body.status }
                    : {}),
                ...(request.body.priority
                    ? { priority: request.body.priority }
                    : {}),
            },
            include: {
                customer: {
                    select: customerSelect,
                },
            },
        });
        request.log.info({
            complaintId: complaint.id,
            status: complaint.status,
            priority: complaint.priority,
        }, "Complaint updated");
        return {
            success: true,
            message: "Complaint updated successfully.",
            complaint,
        };
    });
};
export default complaintRoutes;
//# sourceMappingURL=complaints.js.map