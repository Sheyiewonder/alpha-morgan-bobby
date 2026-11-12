-- Add optional links from a complaint to its transaction and conversation.
ALTER TABLE "Complaint"
ADD COLUMN "transactionId" TEXT,
ADD COLUMN "conversationId" TEXT;

-- Ensure each transaction and conversation can have at most one linked complaint.
CREATE UNIQUE INDEX "Complaint_transactionId_key"
ON "Complaint"("transactionId");

CREATE UNIQUE INDEX "Complaint_conversationId_key"
ON "Complaint"("conversationId");

-- Preserve complaints if their linked records are deleted.
ALTER TABLE "Complaint"
ADD CONSTRAINT "Complaint_transactionId_fkey"
FOREIGN KEY ("transactionId")
REFERENCES "Transaction"("id")
ON DELETE SET NULL
ON UPDATE CASCADE;

ALTER TABLE "Complaint"
ADD CONSTRAINT "Complaint_conversationId_fkey"
FOREIGN KEY ("conversationId")
REFERENCES "Conversation"("id")
ON DELETE SET NULL
ON UPDATE CASCADE;