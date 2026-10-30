// Public reads only for immutable, server-rewritten JPEGs. The R2 bucket stays private.
const approved =
  /^\/approved\/[a-zA-Z0-9_-]+\/[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}\.jpg$/;
const demoDerivative =
  /^\/demo\/rd-[a-z0-9_-]{10,64}\/(?:products|stores|markets)\/[0-9a-f]{64}\.webp$/;
const mediaWorker = {
  async fetch(request, env) {
    const path = new URL(request.url).pathname;
    const isDemo = demoDerivative.test(path);
    if (!approved.test(path) && !isDemo) return new Response("Not found", { status: 404 });
    if (!["GET", "HEAD"].includes(request.method))
      return new Response("Method not allowed", {
        status: 405,
        headers: { Allow: "GET, HEAD" },
      });
    try {
      const object = await env.IMTOR_IMAGES[
        request.method === "HEAD" ? "head" : "get"
      ](path.slice(1));
      if (!object) return new Response("Not found", { status: 404 });
      const headers = new Headers({
        "Content-Type": isDemo ? "image/webp" : "image/jpeg",
        "X-Content-Type-Options": "nosniff",
        "Cache-Control": "public, max-age=31536000, immutable",
        ETag: object.httpEtag,
      });
      if (request.headers.get("If-None-Match") === object.httpEtag)
        return new Response(null, { status: 304, headers });
      headers.set("Content-Length", String(object.size));
      return new Response(request.method === "HEAD" ? null : object.body, {
        headers,
      });
    } catch {
      return new Response("Unavailable", {
        status: 503,
        headers: { "Cache-Control": "no-store" },
      });
    }
  },
};

export default mediaWorker;
