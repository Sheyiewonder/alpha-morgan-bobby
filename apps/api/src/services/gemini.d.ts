interface KnowledgeContext {
    title: string;
    category: string;
    content: string;
}
export declare function generateConversationalResponse(message: string): Promise<string>;
export declare function generateBankingAnswer(question: string, documents: KnowledgeContext[]): Promise<string>;
export {};
//# sourceMappingURL=gemini.d.ts.map