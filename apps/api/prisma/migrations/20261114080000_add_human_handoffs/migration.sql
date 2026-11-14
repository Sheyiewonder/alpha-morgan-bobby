CREATE TYPE "HumanHandoffStatus" AS ENUM (
    'PENDING',
    'ASSIGNED',
    'IN_PROGRESS',
    'RESOLVED'
);

CREATE TYPE "HumanHandoffSource" AS ENUM (
    'AI_DECISION',
    'CUSTOMER_REQUEST',
    'KNOWLEDGE_GAP',
    'COMPLAINT',
    'OTHER'
);

CREATE TABLE "HumanHandoff" (
    "id" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "complaintId" TEXT,
    "reason" TEXT NOT NULL,
    "source" "HumanHandoffSource" NOT NULL DEFAULT 'AI_DECISION',
    "status" "HumanHandoffStatus" NOT NULL DEFAULT 'PENDING',
    "assignedTo" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "HumanHandoff_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "HumanHandoff_status_createdAt_idx"
ON "HumanHandoff"("status", "createdAt");

CREATE INDEX "HumanHandoff_conversationId_idx"
ON "HumanHandoff"("conversationId");

CREATE INDEX "HumanHandoff_assignedTo_status_idx"
ON "HumanHandoff"("assignedTo", "status");

CREATE INDEX "HumanHandoff_complaintId_idx"
ON "HumanHandoff"("complaintId");

ALTER TABLE "HumanHandoff"
ADD CONSTRAINT "HumanHandoff_conversationId_fkey"
FOREIGN KEY ("conversationId")
REFERENCES "Conversation"("id")
ON DELETE CASCADE
ON UPDATE CASCADE;

ALTER TABLE "HumanHandoff"
ADD CONSTRAINT "HumanHandoff_complaintId_fkey"
FOREIGN KEY ("complaintId")
REFERENCES "Complaint"("id")
ON DELETE SET NULL
ON UPDATE CASCADE;
