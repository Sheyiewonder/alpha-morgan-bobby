import { prisma } from "../plugins/prisma.js";
async function main() {
    try {
        await prisma.$connect();
        const result = await prisma.$queryRaw `
      SELECT current_database() AS database,
             current_timestamp AS connected_at
    `;
        console.log("Database connection successful!");
        console.log(result);
    }
    catch (error) {
        console.error("Database connection failed:", error);
        process.exitCode = 1;
    }
    finally {
        await prisma.$disconnect();
    }
}
main();
//# sourceMappingURL=test-db.js.map