const url = new URL(
  process.env.DATABASE_URL ?? "postgresql://localhost/undefined",
);
if (
  !url.pathname.endsWith("_test") ||
  !["localhost", "127.0.0.1", "db"].includes(url.hostname)
)
  throw new Error(
    "Integration tests require TEST_DATABASE_URL ending in _test on loopback or local Compose db",
  );
