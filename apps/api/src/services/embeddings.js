import { pipeline } from "@huggingface/transformers";
let extractorPromise = null;
async function getExtractor() {
    if (!extractorPromise) {
        console.log("Loading sentence embedding model...");
        extractorPromise = pipeline("feature-extraction", "Xenova/all-MiniLM-L6-v2");
    }
    return extractorPromise;
}
export async function generateEmbedding(text) {
    if (!text.trim()) {
        throw new Error("Cannot generate an embedding from empty text.");
    }
    const extractor = await getExtractor();
    const output = await extractor(text, {
        pooling: "mean",
        normalize: true,
    });
    const embedding = Array.from(output.data);
    if (embedding.length !== 384) {
        throw new Error(`Expected 384 embedding dimensions, received ${embedding.length}`);
    }
    return embedding;
}
//# sourceMappingURL=embeddings.js.map