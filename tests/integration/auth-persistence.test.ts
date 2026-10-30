import "./guard";
import { it, expect } from "vitest";
import { randomUUID } from "node:crypto";
import { PrismaAdapter } from "@next-auth/prisma-adapter";
import { db } from "@/lib/db";
it("isolated Google-linked adapter identity retains its store and database session", async () => {
  const adapter = PrismaAdapter(db);
  const tag = "isolated-" + randomUUID();
  const user = await adapter.createUser!({
    name: "Isolated adapter test",
    email: tag + "@example.invalid",
    emailVerified: new Date(),
    image: null,
  });
  try {
    await adapter.linkAccount!({
      userId: user.id,
      provider: "google",
      providerAccountId: tag,
      type: "oauth",
    });
    const store = await db.store.create({
      data: { name: tag, slug: tag, ownerId: user.id },
    });
    const linked = await adapter.getUserByAccount!({
      provider: "google",
      providerAccountId: tag,
    });
    expect(linked?.id).toBe(user.id);
    await adapter.createSession!({
      userId: user.id,
      sessionToken: tag,
      expires: new Date(Date.now() + 60000),
    });
    const authenticated = await adapter.getSessionAndUser!(tag);
    expect(authenticated?.user.id).toBe(user.id);
    expect(
      (await db.store.findUniqueOrThrow({ where: { id: store.id } })).ownerId,
    ).toBe(linked!.id);
  } finally {
    await db.store.deleteMany({ where: { ownerId: user.id } });
    await db.user.delete({ where: { id: user.id } });
    await db.$disconnect();
  }
});
