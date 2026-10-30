import { db } from "@/lib/db";
import { Prisma } from "@/generated/prisma/client";
/** Prisma7 adapters retain SQLSTATE under driverAdapterError.cause.originalCode. */
function retryableConflict(error: unknown): boolean {
  if (!(error instanceof Prisma.PrismaClientKnownRequestError)) return false;
  if (error.code === "P2034") return true;
  if (error.code !== "P2010") return false;
  const adapter = error.meta?.driverAdapterError;
  const cause = typeof adapter === "object" && adapter !== null && "cause" in adapter ? adapter.cause : undefined;
  const state = error.meta?.code ?? (typeof cause === "object" && cause !== null && "originalCode" in cause ? cause.originalCode : undefined);
  return state === "40001" || state === "40P01";
}
export async function transaction<T>(
  work: (tx: Prisma.TransactionClient) => Promise<T>,
): Promise<T> {
  for (let attempt = 0; ; attempt++) {
    try {
      return await db.$transaction(work, {
        isolationLevel: "Serializable",
        maxWait: 10000,
        timeout: 20000,
      });
    } catch (error) {
      if (retryableConflict(error) && attempt < 3)
        continue;
      throw error;
    }
  }
}
