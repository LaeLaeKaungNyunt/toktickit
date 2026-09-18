-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "mustChangePassword" BOOLEAN NOT NULL DEFAULT false,
    "tokenVersion" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "User_role_idx" ON "User"("role");

-- CreateIndex
CREATE INDEX "User_email_idx" ON "User"("email");

-- Migrate existing DevelopmentRequester records to User
INSERT INTO "User" ("id", "name", "email", "passwordHash", "role", "isActive", "mustChangePassword", "tokenVersion", "createdAt", "updatedAt")
SELECT 
    "id", 
    "displayName", 
    "email", 
    '$2b$10$JWTc.v/442rMhQGCZAISlezEP2ZVzsNotthFeP295XTUu9alc4T2y',
    'Requester', 
    "isActive", 
    false, 
    0, 
    "createdAt", 
    "updatedAt"
FROM "DevelopmentRequester";

-- DropForeignKey
ALTER TABLE "Ticket" DROP CONSTRAINT IF EXISTS "Ticket_requesterId_fkey";

-- DropForeignKey
ALTER TABLE "TicketEvent" DROP CONSTRAINT IF EXISTS "TicketEvent_actorId_fkey";

-- DropForeignKey
ALTER TABLE "Attachment" DROP CONSTRAINT IF EXISTS "Attachment_removedByRequesterId_fkey";

-- AddForeignKey
ALTER TABLE "Ticket" ADD CONSTRAINT "Ticket_requesterId_fkey" FOREIGN KEY ("requesterId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TicketEvent" ADD CONSTRAINT "TicketEvent_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Attachment" ADD CONSTRAINT "Attachment_removedByRequesterId_fkey" FOREIGN KEY ("removedByRequesterId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- DropTable
DROP TABLE IF EXISTS "DevelopmentRequester";
