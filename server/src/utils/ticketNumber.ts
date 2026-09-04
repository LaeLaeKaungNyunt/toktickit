import { Prisma } from "@prisma/client";

/**
 * Atomically allocates the next ticket number for the specified UTC year.
 * Format: TKT-YYYY-NNNNN (e.g. TKT-2026-00001).
 *
 * Uses PostgreSQL atomic upsert on TicketSequence within the given transaction.
 */
export async function allocateTicketNumber(
  tx: Prisma.TransactionClient,
  year?: number
): Promise<string> {
  const currentYear = year ?? new Date().getUTCFullYear();

  const result = await tx.$queryRaw<{ allocatedValue: number }[]>`
    INSERT INTO "TicketSequence" ("year", "nextValue", "updatedAt")
    VALUES (${currentYear}, 2, NOW())
    ON CONFLICT ("year")
    DO UPDATE SET "nextValue" = "TicketSequence"."nextValue" + 1, "updatedAt" = NOW()
    RETURNING "nextValue" - 1 AS "allocatedValue";
  `;

  const allocatedValue = Number(result[0].allocatedValue);
  const paddedValue = String(allocatedValue).padStart(5, "0");
  return `TKT-${currentYear}-${paddedValue}`;
}
