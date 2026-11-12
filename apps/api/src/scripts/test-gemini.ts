
import "dotenv/config";

import { generateBankingAnswer } from "../services/gemini.js";

async function main() {
  console.log("Testing Gemini connection...");

  const question =
    "What documents do I need to open an account?";

  const documents = [
    {
      title: "Open an Account with Alpha Morgan Bank",
      category: "General Questions",
      content: `
Question: How do I open an account with Alpha Morgan Bank?

Answer:
Simply visit any of our digital platforms to open a Tier 1 account
or visit our nearest branch or start online by completing the
registration form on our website.

You will need a valid ID, recent utility bill, and a passport
photograph.
      `,
    },
  ];

  const answer = await generateBankingAnswer(
    question,
    documents
  );

  console.log("\nCustomer question:");
  console.log(question);

  console.log("\nBobby's response:");
  console.log(answer);

  console.log("\nGemini test successful!");
}

main().catch((error) => {
  console.error("Gemini test failed:", error);
  process.exitCode = 1;
});
