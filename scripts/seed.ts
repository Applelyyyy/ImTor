import "dotenv/config";
import { db } from "../src/lib/db";
import { DemoService } from "../src/services/demo";

async function main() {
  if (
    process.env.ENABLE_DEMO_GENERATOR !== "true" ||
    (process.env.NODE_ENV === "production" && process.env.DEMO_MODE !== "true")
  )
    throw new Error(
      "Enable ENABLE_DEMO_GENERATOR=true; production also requires DEMO_MODE=true",
    );
  const url = process.env.DATABASE_URL;
  if (!url)
    throw new Error(
      "DATABASE_URL must explicitly identify the local demo database",
    );
  const hostname = new URL(url).hostname;
  if (!["localhost", "127.0.0.1", "[::1]", "::1", "db"].includes(hostname))
    throw new Error(
      "Seed CLI only permits loopback or the local Compose db service; use the gated admin generator for an explicitly configured demo deployment",
    );
  const batch = await DemoService.generate({}, "cli:seed");
  console.log(
    `Created fictional demo batch ${batch.id}. No authenticated users or OAuth identities were created.`,
  );
}
main()
  .catch((error) => {
    console.error(
      error instanceof Error ? error.message : "Demo seeding failed",
    );
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
