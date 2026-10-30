import { execFileSync } from "node:child_process";
import { resolve } from "node:path";
import { expect, it } from "vitest";
let available = true;
try {
  execFileSync("docker", ["compose", "version"], { stdio: "ignore" });
} catch {
  available = false;
}
it.skipIf(!available)(
  "isolates PostgreSQL and exposes only the stable app alias on the existing edge",
  () => {
    const raw = execFileSync(
      "docker",
      [
        "compose",
        "--env-file",
        "tests/fixtures-compose.env",
        "-f",
        "compose.yaml",
        "-f",
        "compose.tunnel.yaml",
        "config",
        "--format",
        "json",
      ],
      {
        encoding: "utf8",
        env: {
          NODE_ENV: "test",
          PATH: process.env.PATH,
          HOME: process.env.HOME,
          IMTOR_ENV_FILE: resolve("tests/fixtures-compose.env"),
        },
      },
    );
    const c = JSON.parse(raw);
    expect(Object.keys(c.services.db.networks)).toEqual(["internal"]);
    expect(Object.keys(c.services.migrate.networks)).toEqual(["internal"]);
    expect(Object.keys(c.services.app.networks).sort()).toEqual([
      "edge",
      "internal",
    ]);
    expect(c.services.app.networks.edge.aliases).toContain("imtor-app");
    expect(c.services.app.environment.PORT).toBe("3100");
    expect(c.services.app.expose).toEqual(["3100"]);
    expect(c.networks.edge).toMatchObject({
      external: true,
      name: "imtor-edge",
    });
    expect(c.networks.internal).toMatchObject({
      internal: true,
      name: "imtor-internal",
    });
    for (const service of ["app", "db", "caddy"])
      expect(c.services[service]?.ports ?? []).toEqual([]);
    expect(c.services.caddy).toBeUndefined();
    expect(c.services.app.environment.NEXTAUTH_URL).toBe(
      "https://imtor.applely.dev",
    );
    expect(c.services.app.environment.S3_BUCKET).toBe("imtor-images");
    expect(c.services.db.volumes[0]).toMatchObject({
      source: "postgres_data",
      target: "/var/lib/postgresql",
    });
  },
);
