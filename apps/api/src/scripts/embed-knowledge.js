import { prisma } from "../plugins/prisma.js";
import { generateEmbedding } from "../services/embeddings.js";
async function main() {
    console.log("Finding approved knowledge documents...");
    const documents = await prisma.knowledgeDocument.findMany({
        where: {
            isApproved: true,
        },
        select: {
            id: true,
            title: true,
            category: true,
            content: true,
        },
    });
    if (documents.length === 0) {
        console.log("No approved documents found.");
        return;
    }
    console.log(`Found ${documents.length} approved documents.`);
    let successful = 0;
    let failed = 0;
    for (const document of documents) {
        try {
            const text = [
                document.title,
                document.category,
                document.content,
            ].join("\n");
            const embedding = await generateEmbedding(text);
            const vector = `[${embedding.join(",")}]`;
            await prisma.$executeRaw `
        UPDATE "KnowledgeDocument"
        SET "embedding" = ${vector}::extensions.vector
        WHERE "id" = ${document.id}
      `;
            successful++;
            console.log(`Embedded: ${document.title}`);
        }
        catch (error) {
            failed++;
            console.error(`Failed: ${document.title}`, error);
        }
    }
    console.log("\nEmbedding process completed.");
    console.log(`Successful: ${successful}`);
    console.log(`Failed: ${failed}`);
}
main()
    .catch((error) => {
    console.error("Embedding script failed:", error);
    process.exitCode = 1;
})
    .finally(async () => {
    await prisma.$disconnect();
});
//# sourceMappingURL=embed-knowledge.js.map