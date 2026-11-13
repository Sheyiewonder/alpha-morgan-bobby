
import Fastify from "fastify";
import cors from "@fastify/cors";
import "dotenv/config";

import conversationRoutes from "./routes/conversations.js";
import { prisma } from "./plugins/prisma.js";
import knowledgeRoutes from "./routes/knowledge.js";
import complaintRoutes from "./routes/complaints.js";
import escalationRoutes from "./routes/escalations.js";
import demoRoutes from "./routes/demo.js";

const port = Number(process.env.PORT || 4000);
const host = "0.0.0.0";

const app = Fastify({
  logger: true,
});

async function start() {
  try {
    // Configure allowed frontend origins.
    const allowedOrigins = (process.env.FRONTEND_URL || "http://localhost:3000")
      .split(",")
      .map((origin) => origin.trim().replace(/\/+$/, ""))
      .filter(Boolean);

    await app.register(cors, {
      origin: (origin, callback) => {
        // Allow requests without an Origin header, such as Render health checks.
        if (!origin) {
          callback(null, true);
          return;
        }

        const normalizedOrigin = origin.replace(/\/+$/, "");

        if (allowedOrigins.includes(normalizedOrigin)) {
          callback(null, true);
          return;
        }

        callback(new Error("Origin not allowed by CORS"), false);
      },
      methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    });

    // Register API routes.
    await app.register(conversationRoutes, { prefix: "/api" });
    await app.register(knowledgeRoutes, { prefix: "/api" });
    await app.register(complaintRoutes, { prefix: "/api" });
    await app.register(escalationRoutes, { prefix: "/api" });
    await app.register(demoRoutes, { prefix: "/api" });

    // API health check.
    app.get("/health", async () => ({
      success: true,
      service: "alpha-morgan-bobby-api",
      message: "API is running",
    }));

    // Database health check.
    app.get("/health/database", async () => {
      await prisma.$queryRaw`SELECT 1`;

      return {
        success: true,
        database: "connected",
        message: "Database is responding",
      };
    });

    // Connect to PostgreSQL before accepting requests.
    await prisma.$connect();
    app.log.info("Connected to Supabase PostgreSQL");

    // Disconnect Prisma during shutdown.
    app.addHook("onClose", async () => {
      await prisma.$disconnect();
      app.log.info("Disconnected from PostgreSQL");
    });

    // Start the server.
    await app.listen({ port, host });
  } catch (error) {
    app.log.error(error);
    await app.close();
    process.exit(1);
  }
}

start();
