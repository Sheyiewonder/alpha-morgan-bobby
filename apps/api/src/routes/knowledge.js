import { timingSafeEqual } from "node:crypto";
import { prisma } from "../plugins/prisma.js";
import { generateEmbedding } from "../services/embeddings.js";
const requireAdmin = async (request, reply) => {
    const configuredKey = process.env.ADMIN_API_KEY;
    const providedKey = request.headers["x-admin-api-key"];
    if (!configuredKey) {
        return reply.code(503).send({
            success: false,
            message: "Admin access is not configured.",
        });
    }
    if (typeof providedKey !== "string") {
        return reply.code(401).send({
            success: false,
            message: "Unauthorized.",
        });
    }
    const expected = Buffer.from(configuredKey);
    const actual = Buffer.from(providedKey);
    if (expected.length !== actual.length ||
        !timingSafeEqual(expected, actual)) {
        return reply.code(401).send({
            success: false,
            message: "Unauthorized.",
        });
    }
};
const knowledgeRoutes = async (app) => {
    // List approved documents for chatbot retrieval
    app.get("/knowledge", async () => {
        const documents = await prisma.knowledgeDocument.findMany({
            where: { isApproved: true },
            orderBy: { updatedAt: "desc" },
            take: 100,
            select: {
                id: true,
                title: true,
                category: true,
                content: true,
                source: true,
                version: true,
                updatedAt: true,
            },
        });
        return {
            success: true,
            count: documents.length,
            documents,
        };
    });
    // Search approved documents by keywords
    app.get("/knowledge/search", {
        schema: {
            querystring: {
                type: "object",
                required: ["q"],
                additionalProperties: false,
                properties: {
                    q: {
                        type: "string",
                        minLength: 2,
                        maxLength: 150,
                    },
                },
            },
        },
    }, async (request) => {
        const query = request.query.q.trim();
        const documents = await prisma.knowledgeDocument.findMany({
            where: {
                isApproved: true,
                OR: [
                    {
                        title: {
                            contains: query,
                            mode: "insensitive",
                        },
                    },
                    {
                        category: {
                            contains: query,
                            mode: "insensitive",
                        },
                    },
                    {
                        content: {
                            contains: query,
                            mode: "insensitive",
                        },
                    },
                ],
            },
            take: 10,
            orderBy: { updatedAt: "desc" },
        });
        return {
            success: true,
            query,
            count: documents.length,
            documents,
        };
    });
    // Admin: list documents awaiting approval
    app.get("/knowledge/admin/pending", { preHandler: requireAdmin }, async () => {
        const documents = await prisma.knowledgeDocument.findMany({
            where: { isApproved: false },
            orderBy: { createdAt: "desc" },
        });
        return {
            success: true,
            count: documents.length,
            documents,
        };
    });
    // Admin: approve or reject a knowledge document
    app.patch("/knowledge/:id/approval", {
        preHandler: requireAdmin,
        schema: {
            params: {
                type: "object",
                required: ["id"],
                properties: {
                    id: { type: "string", minLength: 1 },
                },
            },
            body: {
                type: "object",
                required: ["isApproved"],
                additionalProperties: false,
                properties: {
                    isApproved: { type: "boolean" },
                },
            },
        },
    }, async (request, reply) => {
        const existing = await prisma.knowledgeDocument.findUnique({
            where: { id: request.params.id },
            select: { id: true },
        });
        if (!existing) {
            return reply.code(404).send({
                success: false,
                message: "Knowledge document not found.",
            });
        }
        const document = await prisma.knowledgeDocument.update({
            where: { id: request.params.id },
            data: {
                isApproved: request.body.isApproved,
            },
        });
        return {
            success: true,
            message: request.body.isApproved
                ? "Knowledge document approved."
                : "Knowledge document rejected.",
            document,
        };
    });
    app.get("/knowledge/semantic-search", async (request, reply) => {
        try {
            const query = request.query.q?.trim();
            if (!query) {
                return reply.code(400).send({
                    success: false,
                    message: "Please provide a search question.",
                });
            }
            if (query.length > 1000) {
                return reply.code(400).send({
                    success: false,
                    message: "Search question is too long.",
                });
            }
            const requestedLimit = Number(request.query.limit ?? 5);
            const limit = Number.isFinite(requestedLimit)
                ? Math.min(Math.max(Math.floor(requestedLimit), 1), 10)
                : 5;
            // Convert the question into a 384-dimensional embedding.
            const embedding = await generateEmbedding(query);
            const vector = `[${embedding.join(",")}]`;
            // Retrieve the most relevant approved banking documents.
            const documents = await prisma.$queryRaw `
        SELECT *
        FROM match_knowledge_documents(
            ${vector}::extensions.vector,
            CAST(0.25 AS DOUBLE PRECISION),
            CAST(${limit} AS INTEGER)
        )
        `;
            return {
                success: true,
                query,
                count: documents.length,
                documents,
            };
        }
        catch (error) {
            request.log.error(error);
            return reply.code(500).send({
                success: false,
                message: "Semantic search failed.",
            });
        }
    });
};
export default knowledgeRoutes;
//# sourceMappingURL=knowledge.js.map