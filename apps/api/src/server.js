import Fastify from "fastify";
import cors from "@fastify/cors";
import "dotenv/config";
import conversationRoutes from "./routes/conversations.js";
import { prisma } from "./plugins/prisma.js";
import knowledgeRoutes from "./routes/knowledge.js";
import complaintRoutes from "./routes/complaints.js";
import escalationRoutes from "./routes/escalations.js";

const port = Number(process.env.PORT ?? 4000);
const app = Fastify({
    logger: true,
});
async function start() {
    try {
        // Register CORS
        await app.register(cors, {
            origin: process.env.FRONTEND_URL ?? "http://localhost:3000",
        });
        // Register API routes BEFORE starting the server
        await app.register(conversationRoutes, {
            prefix: "/api",
        });
        await app.register(knowledgeRoutes, {
            prefix: "/api",
        });
        await app.register(escalationRoutes, {
            prefix: "/api",
        });
        await app.register(complaintRoutes, {
            prefix: "/api",
        });
        // Connect to PostgreSQL
        app.addHook("onReady", async () => {
            await prisma.$connect();
            app.log.info("Connected to Supabase PostgreSQL");
        });
        // Disconnect Prisma during shutdown
        app.addHook("onClose", async () => {
            await prisma.$disconnect();
            app.log.info("Disconnected from PostgreSQL");
        });
        // API health check
        app.get("/health", async () => ({
            success: true,
            service: "alpha-morgan-bobby-api",
            message: "API is running",
        }));
        // Database health check
        app.get("/health/database", async () => {
            await prisma.$queryRaw `SELECT 1`;
            return {
                success: true,
                database: "connected",
                message: "Database is responding",
            };
        });
        // Start server LAST
        const port = Number(process.env.PORT ?? 4000);
        await app.listen({
            port,
            host: "127.0.0.1",
        });
    }
    catch (error) {
        app.log.error(error);
        await app.close();
        process.exit(1);
    }
}
start();
//# sourceMappingURL=server.js.map