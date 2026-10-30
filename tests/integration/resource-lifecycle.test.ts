import "./guard";
import { afterAll, beforeAll, expect, it } from "vitest";
import { randomUUID } from "node:crypto";
import { db } from "@/lib/db";
import { AdminService } from "@/services/admin";
import { AttendanceService } from "@/services/attendance";
import { ResourceLifecycleService } from "@/services/resource-lifecycle";
const tag = `lifecycle-${randomUUID()}`;
let actor: Awaited<ReturnType<typeof db.user.create>>;
const markets: string[] = [];
async function market() {
  const m = await db.marketVenue.create({
    data: { name: tag, slug: `${tag}-${markets.length}` },
  });
  markets.push(m.id);
  return m;
}
beforeAll(async () => {
  actor = await db.user.create({ data: { name: tag, role: "SUPERADMIN" } });
});
afterAll(async () => {
  await db.marketVenue.deleteMany({ where: { id: { in: markets } } });
  if (actor) {
    await db.auditLog.deleteMany({ where: { actorId: actor.id } });
    await db.user.delete({ where: { id: actor.id } });
  }
  await db.$disconnect();
});
it("never cascades a market's configured children, then deletes an explicitly empty named market", async () => {
  const m = await market();
  const zone = await AdminService.zone(actor, m.id, { name: "A" });
  await expect(
    ResourceLifecycleService.remove(actor, "market", m.id, {
      confirmName: m.name,
    }),
  ).rejects.toThrow("โซน");
  expect(
    await db.marketZone.findUnique({ where: { id: zone.id } }),
  ).not.toBeNull();
  await expect(
    ResourceLifecycleService.remove(actor, "zone", zone.id, {
      confirmName: "wrong",
    }),
  ).rejects.toThrow();
  await ResourceLifecycleService.remove(actor, "zone", zone.id, {
    confirmName: "A",
  });
  await ResourceLifecycleService.remove(actor, "market", m.id, {
    confirmName: m.name,
  });
  expect(await db.marketVenue.findUnique({ where: { id: m.id } })).toBeNull();
  expect(
    await db.auditLog.count({
      where: { actorId: actor.id, action: "MARKET_DELETED", target: m.id },
    }),
  ).toBe(1);
});
it("blocks stalls referenced by preferred attendance templates and denies ordinary users", async () => {
  const m = await market();
  const zone = await AdminService.zone(actor, m.id, { name: "B" });
  const stall = await AdminService.stall(actor, m.id, null, {
    zoneId: zone.id,
    code: "B01",
    x: 0.2,
    y: 0.3,
  });
  const store = await db.store.create({
    data: { name: tag, slug: `${tag}-store`, ownerId: actor.id },
  });
  try {
    await db.attendanceTemplate.create({
      data: {
        marketId: m.id,
        storeId: store.id,
        weekday: 1,
        preferredCode: stall.code,
      },
    });
    const preview = await ResourceLifecycleService.preview(
      actor,
      "stall",
      stall.id,
    );
    expect(preview.canDelete).toBe(false);
    await expect(
      ResourceLifecycleService.remove(actor, "stall", stall.id, {
        confirmName: stall.code,
      }),
    ).rejects.toThrow();
    await expect(
      ResourceLifecycleService.preview(
        { ...actor, role: "USER" },
        "stall",
        stall.id,
      ),
    ).rejects.toThrow("ผู้ดูแล");
  } finally {
    await db.store.delete({ where: { id: store.id } });
  }
});
it("saves positions atomically, rejects cross-market IDs and stale coordinates", async () => {
  const m = await market(),
    other = await market();
  const z = await AdminService.zone(actor, m.id, { name: "C" }),
    oz = await AdminService.zone(actor, other.id, { name: "C" });
  const a = await AdminService.stall(actor, m.id, null, {
    zoneId: z.id,
    code: "C01",
    x: 0.2,
    y: 0.3,
  });
  const b = await AdminService.stall(actor, other.id, null, {
    zoneId: oz.id,
    code: "C01",
    x: 0.2,
    y: 0.3,
  });
  await expect(
    AdminService.layout(actor, m.id, {
      positions: [
        { id: a.id, x: 0.6, y: 0.6 },
        { id: b.id, x: 0.5, y: 0.5 },
      ],
    }),
  ).rejects.toThrow();
  expect(
    (await db.marketStall.findUniqueOrThrow({ where: { id: a.id } })).x,
  ).toBe(0.2);
  await AdminService.layout(actor, m.id, {
    positions: [{ id: a.id, x: 0.6, y: 0.6 }],
    expectedPositions: [{ id: a.id, x: 0.2, y: 0.3 }],
  });
  await expect(
    AdminService.layout(actor, m.id, {
      positions: [{ id: a.id, x: 0.7, y: 0.7 }],
      expectedPositions: [{ id: a.id, x: 0.2, y: 0.3 }],
    }),
  ).rejects.toThrow("เปลี่ยน");
});
it("creates numbered stalls atomically and prevents duplicates or cross-market zones", async () => {
  const m = await market(),
    other = await market();
  const zone = await AdminService.zone(actor, m.id, { name: "D" });
  await expect(
    AdminService.stallBatch(actor, other.id, {
      zoneId: zone.id,
      prefix: "D",
      start: 1,
      count: 3,
      x: 0.1,
      y: 0.2,
      columns: 2,
    }),
  ).rejects.toThrow();
  await AdminService.stallBatch(actor, m.id, {
    zoneId: zone.id,
    prefix: "D",
    start: 1,
    count: 3,
    x: 0.1,
    y: 0.2,
    columns: 2,
  });
  await expect(
    AdminService.stallBatch(actor, m.id, {
      zoneId: zone.id,
      prefix: "D",
      start: 3,
      count: 3,
      x: 0.1,
      y: 0.2,
      columns: 2,
    }),
  ).rejects.toThrow();
  expect(await db.marketStall.count({ where: { marketId: m.id } })).toBe(3);
  await AdminService.updateZone(actor, zone.id, { name: "D ใหม่" });
  expect(
    (await db.marketZone.findUniqueOrThrow({ where: { id: zone.id } })).name,
  ).toBe("D ใหม่");
});
it("keeps omitted market and stall fields unchanged on a narrow PATCH", async () => {
  const m = await market();
  await db.marketVenue.update({
    where: { id: m.id },
    data: {
      type: "LARGE",
      description: "Keep description",
      address: "Keep address",
      entrance: "Keep entrance",
      timezone: "Europe/London",
      active: false,
    },
  });
  await AdminService.market(actor, m.id, { name: `${tag} renamed` });
  expect
    .soft(await db.marketVenue.findUniqueOrThrow({ where: { id: m.id } }))
    .toMatchObject({
      type: "LARGE",
      description: "Keep description",
      address: "Keep address",
      entrance: "Keep entrance",
      timezone: "Europe/London",
      active: false,
    });
  const zone = await AdminService.zone(actor, m.id, { name: "PATCH" });
  const stall = await AdminService.stall(actor, m.id, null, {
    zoneId: zone.id,
    code: "P01",
    x: 0.2,
    y: 0.3,
    directions: "Keep directions",
    active: false,
  });
  await AdminService.stall(actor, null, stall.id, { x: 0.4 });
  expect(
    await db.marketStall.findUniqueOrThrow({ where: { id: stall.id } }),
  ).toMatchObject({ x: 0.4, directions: "Keep directions", active: false });
});
it("keeps preferred-code templates attached when their stall code is renamed", async () => {
  const m = await market(),
    zone = await AdminService.zone(actor, m.id, { name: "Rename" });
  const stall = await AdminService.stall(actor, m.id, null, {
    zoneId: zone.id,
    code: "R01",
    x: 0.2,
    y: 0.3,
  });
  const store = await db.store.create({
    data: { name: tag, slug: `${tag}-rename-store`, ownerId: actor.id },
  });
  try {
    const template = await db.attendanceTemplate.create({
      data: {
        marketId: m.id,
        storeId: store.id,
        weekday: 1,
        preferredCode: "R01",
      },
    });
    await AdminService.stall(actor, null, stall.id, { code: "R02" });
    expect(
      (
        await db.attendanceTemplate.findUniqueOrThrow({
          where: { id: template.id },
        })
      ).preferredCode,
    ).toBe("R02");
    await expect(
      ResourceLifecycleService.remove(actor, "stall", stall.id, {
        confirmName: "R02",
      }),
    ).rejects.toThrow();
  } finally {
    await db.store.delete({ where: { id: store.id } });
  }
});

it("records released stall history on cancellation without blocking a new overlapping assignment", async () => {
  const m = await market(),
    zone = await AdminService.zone(actor, m.id, { name: "History" });
  const stall = await AdminService.stall(actor, m.id, null, {
    zoneId: zone.id,
    code: "H01",
    x: 0.2,
    y: 0.3,
  });
  const store = await db.store.create({
    data: { name: tag, slug: `${tag}-history-store`, ownerId: actor.id },
  });
  const session = await db.marketSession.create({
    data: {
      marketId: m.id,
      date: "2099-01-01",
      startsAt: new Date("2099-01-01T09:00:00Z"),
      endsAt: new Date("2099-01-01T14:00:00Z"),
    },
  });
  try {
    const attendance = await AttendanceService.save(actor, {
      storeId: store.id,
      sessionId: session.id,
      stallId: stall.id,
      authorized: true,
      status: "SCHEDULED",
    });
    await AdminService.session(actor, session.id, "CANCELLED");
    const audit = await db.auditLog.findFirstOrThrow({
      where: {
        actorId: actor.id,
        action: "SESSION_CANCELLED",
        target: session.id,
      },
    });
    expect(audit.changes).toMatchObject({
      releasedAssignments: [
        {
          attendanceId: attendance.id,
          storeId: store.id,
          stallId: stall.id,
          stallCode: "H01",
          zoneName: "History",
          startsAt: "2099-01-01T09:00:00.000Z",
          endsAt: "2099-01-01T14:00:00.000Z",
        },
      ],
    });
    expect(
      await db.stallAssignment.count({
        where: { attendanceId: attendance.id },
      }),
    ).toBe(0);
    expect(
      (
        await db.storeAttendance.findUniqueOrThrow({
          where: { id: attendance.id },
        })
      ).status,
    ).toBe("CANCELLED");
    const replacement = await db.marketSession.create({
      data: {
        marketId: m.id,
        date: "2099-01-02",
        startsAt: session.startsAt,
        endsAt: session.endsAt,
      },
    });
    await expect(
      AttendanceService.save(actor, {
        storeId: store.id,
        sessionId: replacement.id,
        stallId: stall.id,
        authorized: true,
        status: "SCHEDULED",
      }),
    ).resolves.toHaveProperty("id");
  } finally {
    await db.store.delete({ where: { id: store.id } });
  }
});
it("keeps old assignment snapshots when a merchant moves or cancels attendance", async () => {
  const m = await market(),
    zone = await AdminService.zone(actor, m.id, { name: "Trace" });
  const a = await AdminService.stall(actor, m.id, null, {
    zoneId: zone.id,
    code: "T01",
    x: 0.2,
    y: 0.3,
  });
  const b = await AdminService.stall(actor, m.id, null, {
    zoneId: zone.id,
    code: "T02",
    x: 0.4,
    y: 0.3,
  });
  const store = await db.store.create({
    data: { name: tag, slug: `${tag}-move-store`, ownerId: actor.id },
  });
  const session = await db.marketSession.create({
    data: {
      marketId: m.id,
      date: "2099-02-01",
      startsAt: new Date("2099-02-01T09:00:00Z"),
      endsAt: new Date("2099-02-01T14:00:00Z"),
    },
  });
  try {
    const input = {
      storeId: store.id,
      sessionId: session.id,
      stallId: a.id,
      authorized: true as const,
      status: "SCHEDULED" as const,
    };
    const attendance = await AttendanceService.save(actor, input);
    await AttendanceService.save(actor, { ...input, stallId: b.id });
    await AttendanceService.save(actor, {
      ...input,
      stallId: b.id,
      status: "CANCELLED",
    });
    const audits = await db.auditLog.findMany({
      where: {
        actorId: actor.id,
        action: "ATTENDANCE_SAVED",
        target: attendance.id,
      },
    });
    expect(audits.map((row) => row.changes)).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          releasedAssignment: expect.objectContaining({
            stallId: a.id,
            stallCode: "T01",
            zoneName: "Trace",
            startsAt: "2099-02-01T09:00:00.000Z",
            endsAt: "2099-02-01T14:00:00.000Z",
          }),
        }),
        expect.objectContaining({
          releasedAssignment: expect.objectContaining({
            stallId: b.id,
            stallCode: "T02",
          }),
          status: "CANCELLED",
        }),
      ]),
    );
    expect(
      await db.stallAssignment.count({
        where: { attendanceId: attendance.id },
      }),
    ).toBe(0);
    await expect(
      AttendanceService.save(actor, { ...input, stallId: b.id }),
    ).resolves.toHaveProperty("id");
  } finally {
    await db.store.delete({ where: { id: store.id } });
  }
});
