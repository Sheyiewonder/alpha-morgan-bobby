
import "dotenv/config";
import { prisma } from "../plugins/prisma.js";

const CUSTOMER_REF = "DEMO-CUST-001";

const transactions = [
  {
    reference: "DEMO-TXN-1001",
    description: "Salary Payment",
    amount: "450000.00",
    type: "CREDIT",
    counterparty: "Alpha Morgan Demo Payroll",
    status: "SUCCESSFUL" as const,
    daysAgo: 1,
  },
  {
    reference: "DEMO-TXN-1002",
    description: "Transfer to John",
    amount: "25000.00",
    type: "TRANSFER",
    counterparty: "John Doe",
    status: "SUCCESSFUL" as const,
    daysAgo: 2,
  },
  {
    reference: "DEMO-TXN-1003",
    description: "Electricity Bill",
    amount: "18500.00",
    type: "BILL_PAYMENT",
    counterparty: "Demo Electricity Provider",
    status: "SUCCESSFUL" as const,
    daysAgo: 3,
  },
  {
    reference: "DEMO-TXN-1004",
    description: "Airtime Purchase",
    amount: "5000.00",
    type: "AIRTIME",
    counterparty: "Demo Telecom",
    status: "FAILED" as const,
    daysAgo: 4,
  },
  {
    reference: "DEMO-TXN-1005",
    description: "Transfer to Sarah",
    amount: "12000.00",
    type: "TRANSFER",
    counterparty: "Sarah Williams",
    status: "PENDING" as const,
    daysAgo: 5,
  },
  {
    reference: "DEMO-TXN-1006",
    description: "Online Purchase",
    amount: "32000.00",
    type: "CARD_PAYMENT",
    counterparty: "Demo Online Store",
    status: "REVERSED" as const,
    daysAgo: 6,
  },
  {
    reference: "DEMO-TXN-1007",
    description: "Restaurant Payment",
    amount: "8500.00",
    type: "CARD_PAYMENT",
    counterparty: "Demo Restaurant",
    status: "UNKNOWN" as const,
    daysAgo: 7,
  },
];

async function main() {
  await prisma.$connect();

  const customer = await prisma.customer.upsert({
    where: {
      customerRef: CUSTOMER_REF,
    },
    update: {
      firstName: "Feranmi",
      lastName: "Olawale",
      segment: "RETAIL",
    },
    create: {
      customerRef: CUSTOMER_REF,
      firstName: "Feranmi",
      lastName: "Olawale",
      segment: "RETAIL",
    },
  });

  // Only replace transactions belonging to this synthetic customer.
  await prisma.transaction.deleteMany({
    where: {
      customerId: customer.id,
    },
  });

  await prisma.transaction.createMany({
    data: transactions.map((transaction) => {
      const { daysAgo, ...data } = transaction;

      return {
        ...data,
        customerId: customer.id,
        currency: "NGN",
        transactionDate: new Date(
          Date.now() - daysAgo * 24 * 60 * 60 * 1000
        ),
      };
    }),
  });

  console.log("\nDemo customer seeded successfully.");
  console.log({
    customerRef: CUSTOMER_REF,
    name: `${customer.firstName} ${customer.lastName}`,
    transactions: transactions.length,
    simulationOnly: true,
  });
}

main()
  .catch((error) => {
    console.error("Demo customer seeding failed:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
