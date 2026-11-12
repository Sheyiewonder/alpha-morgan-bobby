import "dotenv/config";
import { prisma } from "../plugins/prisma.js";
const faqs = [
    {
        title: "Reset Internet or Mobile Banking Password",
        category: "General Questions",
        content: `Question: How do I reset my internet or mobile banking password?

Answer:
To reset your internet or mobile banking password, click on the "Forgot Password" link on the login page. You will receive a password reset link via your registered email address or a verification code via SMS. Follow the instructions to create a new password.`,
        source: "Supplied Alpha Morgan Bank FAQ",
    },
    {
        title: "Find a Branch or ATM",
        category: "General Questions",
        content: `Question: How do I find a branch or ATM near me?

Answer:
You can locate our branches and ATMs using the Branch & ATM Locator on our website or mobile app. Simply enter your location or use your device's GPS to find the nearest Alpha Morgan Bank branch or ATM.`,
        source: "Supplied Alpha Morgan Bank FAQ",
    },
    {
        title: "Apply for a Loan",
        category: "General Questions",
        content: `Question: How can I apply for a loan?

Answer:
You can apply for a loan through our mobile app, online banking platform, or by visiting any of our branches. The application process requires providing necessary documentation such as proof of income, valid ID, and collateral depending on the loan type. Our loan officers will guide you through the entire process.`,
        source: "Supplied Alpha Morgan Bank FAQ",
    },
    {
        title: "Online and Mobile Banking Security",
        category: "General Questions",
        content: `Question: How secure are your online and mobile banking platforms?

Answer:
Our online and mobile banking platforms employ industry-leading security measures including end-to-end encryption, two-factor authentication, and continuous monitoring for suspicious activities. We regularly update our security protocols to ensure your financial information remains protected.`,
        source: "Supplied Alpha Morgan Bank FAQ",
    },
    {
        title: "Types of Bank Accounts",
        category: "General Questions",
        content: `Question: What types of accounts do you offer?

Answer:
We offer a variety of accounts including Savings Accounts, Current Accounts, Fixed Deposit Accounts, and specialized accounts for businesses and high-net-worth individuals. Each account type comes with unique features tailored to meet different financial needs.`,
        source: "Supplied Alpha Morgan Bank FAQ",
    },
    {
        title: "Open an Account with Alpha Morgan Bank",
        category: "General Questions",
        content: `Question: How do I open an account with Alpha Morgan Bank?

Answer:
Simply visit any of our digital platforms to open a Tier 1 account or visit our nearest branch or start online by completing the registration form on our website. You will need a valid ID, recent utility bill, and a passport photograph. Our process is seamless and can be completed in minutes.`,
        source: "Supplied Alpha Morgan Bank FAQ",
    },
    {
        title: "USSD Banking and Airtime Services",
        category: "USSD Banking",
        content: `Question: What is Alpha Morgan Bank's USSD banking code?

Answer:
Alpha Morgan Bank's USSD banking code is *734#. You can dial this code from your mobile phone to access USSD banking services without needing a mobile internet connection.

Question: How do I purchase airtime using USSD?

Answer:
The supplied airtime shortcut is *734*amount#. Replace "amount" with the desired airtime amount. Please confirm the exact dialing format and any additional steps with Alpha Morgan Bank before completing an airtime transaction.

Question: Do I need an internet connection to use USSD banking?

Answer:
No. USSD banking works through your mobile network and does not require mobile internet access.

Question: What services are available through USSD banking?

Answer:
USSD banking provides access to banking services through a mobile phone. Available services and their exact menu options should be confirmed using Alpha Morgan Bank's official USSD menu.`,
        source: "User-supplied Alpha Morgan Bank USSD information — pending verification",
        isApproved: true,
    },
];
async function main() {
    await prisma.$connect();
    let created = 0;
    let updated = 0;
    for (const faq of faqs) {
        const existing = await prisma.knowledgeDocument.findFirst({
            where: {
                title: faq.title,
                category: faq.category,
            },
        });
        const { isApproved = true, ...faqData } = faq;
        if (existing) {
            await prisma.knowledgeDocument.update({
                where: {
                    id: existing.id,
                },
                data: {
                    ...faqData,
                    isApproved,
                    version: 1,
                },
            });
            updated++;
            console.log(`Updated: ${faq.title} (Approved: ${isApproved})`);
        }
        else {
            await prisma.knowledgeDocument.create({
                data: {
                    ...faqData,
                    isApproved,
                    version: 1,
                },
            });
            created++;
            console.log(`Created: ${faq.title} (Approved: ${isApproved})`);
        }
    }
    console.log("\nKnowledge base seeding completed.");
    console.log({
        created,
        updated,
        total: faqs.length,
    });
}
main()
    .catch((error) => {
    console.error("Knowledge base seeding failed:", error);
    process.exitCode = 1;
})
    .finally(async () => {
    await prisma.$disconnect();
});
//# sourceMappingURL=seed-knowledge.js.map