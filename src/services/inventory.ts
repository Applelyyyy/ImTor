import type { Prisma } from "@/generated/prisma/client";
export class InventoryService {
  static async expireForProduct(
    tx: Prisma.TransactionClient,
    productId: string,
    now = new Date(),
  ) {
    const expired = await tx.reservation.findMany({
      where: { productId, status: "RESERVED", expiresAt: { lte: now } },
    });
    for (const row of expired) {
      const changed = await tx.reservation.updateMany({
        where: { id: row.id, status: "RESERVED" },
        data: { status: "EXPIRED" },
      });
      if (changed.count) {
        await tx.product.update({
          where: { id: productId },
          data: { stock: { increment: row.quantity } },
        });
        await tx.inventoryMovement.create({
          data: {
            productId,
            reservationId: row.id,
            delta: row.quantity,
            reason: "EXPIRED",
          },
        });
      }
    }
  }
}
