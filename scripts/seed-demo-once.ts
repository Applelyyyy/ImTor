import { Client } from "pg";
import { db } from "@/lib/db";
import { DemoService } from "@/services/demo";

export async function seedDemoOnce() {
  const url = new URL(process.env.DATABASE_URL ?? "postgresql://invalid/invalid");
  if (url.hostname !== "db" || url.pathname !== "/imtor_demo" ||
    process.env.DEMO_MODE !== "true" || process.env.ENABLE_DEMO_GENERATOR !== "true")
    throw new Error("Seeding requires the isolated demo database and both demo flags.");
  const lock = new Client({ connectionString: process.env.DATABASE_URL });
  await lock.connect();
  try {
    const actual = await lock.query<{ name: string }>("SELECT current_database() AS name");
    if (actual.rows[0]?.name !== "imtor_demo") throw new Error("Expected isolated demo database.");
    await lock.query("SET lock_timeout = '150s'");
    // Session lock spans the existing generator's separate serializable transaction.
    await lock.query("SELECT pg_advisory_lock(hashtext('imtor-demo-initial-seed'))");
    if (await db.demoBatch.count()) {
      console.log("Existing fictional demo batch retained; no duplicate seed.");
      return;
    }
    await DemoService.generate({}, "cli:demo-deployment");
    console.log("Initial fictional demo batch created; no OAuth identities or login bypass created.");
  } finally { await lock.end(); }
}

if (import.meta.main) {
  seedDemoOnce().catch(() => {
    console.error("Demo seed failed; data retained. Inspect privately before retrying.");
    process.exitCode = 1;
  }).finally(() => db.$disconnect());
}
