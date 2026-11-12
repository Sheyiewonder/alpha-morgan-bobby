import "dotenv/config";
import { GoogleGenAI } from "@google/genai";
async function main() {
    const apiKey = process.env.GOOGLE_API_KEY;
    if (!apiKey) {
        throw new Error("GOOGLE_API_KEY is missing.");
    }
    const ai = new GoogleGenAI({ apiKey });
    console.log("Checking available Gemini models...\n");
    const response = await ai.models.list();
    for await (const model of response) {
        if (model.name?.includes("gemini")) {
            console.log({
                name: model.name,
                displayName: model.displayName,
                supportedActions: model.supportedActions,
            });
        }
    }
    console.log("\nModel listing completed.");
}
main().catch((error) => {
    console.error("Model listing failed:", {
        status: error.status,
        message: error.message,
    });
    process.exitCode = 1;
});
//# sourceMappingURL=list-gemini-models.js.map