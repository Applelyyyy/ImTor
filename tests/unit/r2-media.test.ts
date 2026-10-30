import { expect, it, vi } from "vitest";
import worker from "../../infra/r2-media/worker.mjs";
const path = "/approved/merchant1/12345678-1234-1234-1234-123456789abc.jpg";
it("never reads staging, arbitrary prefixes or encoded traversal", async () => {
  const get = vi.fn();
  for (const key of [
    "/staging/private/file",
    "/approved/x/file.jpg",
    "/approved/%2Fstaging/key.jpg",
  ]) {
    expect(
      (
        await worker.fetch(
          new Request("https://media.imtor.applely.dev" + key),
          { IMTOR_IMAGES: { get } },
        )
      ).status,
    ).toBe(404);
  }
  expect(get).not.toHaveBeenCalled();
});
it("serves approved bytes and supports safe HEAD/conditional requests", async () => {
  const object = {
    body: new Uint8Array([1, 2]),
    size: 2,
    httpEtag: '"fixture"',
  };
  const get = vi.fn().mockResolvedValue(object),
    head = vi.fn().mockResolvedValue(object),
    env = { IMTOR_IMAGES: { get, head } };
  const url = "https://media.imtor.applely.dev" + path;
  const response = await worker.fetch(new Request(url), env);
  expect(response.status).toBe(200);
  expect((await response.arrayBuffer()).byteLength).toBe(2);
  expect(response.headers.get("X-Content-Type-Options")).toBe("nosniff");
  expect(
    (await worker.fetch(new Request(url, { method: "HEAD" }), env)).body,
  ).toBeNull();
  expect(head).toHaveBeenCalled();
  expect(
    (
      await worker.fetch(
        new Request(url, { headers: { "If-None-Match": '"fixture"' } }),
        env,
      )
    ).status,
  ).toBe(304);
  expect(
    (await worker.fetch(new Request(url, { method: "PUT" }), env)).status,
  ).toBe(405);
});
