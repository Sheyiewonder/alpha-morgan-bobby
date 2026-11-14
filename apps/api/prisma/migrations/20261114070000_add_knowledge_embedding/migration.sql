CREATE SCHEMA IF NOT EXISTS "extensions";

CREATE EXTENSION IF NOT EXISTS "vector"
WITH SCHEMA "extensions";

ALTER TABLE "KnowledgeDocument"
ADD COLUMN "embedding" "extensions"."vector"(384);
