import { describe, expect, it } from "vitest";
import { Hono } from "hono";
import { bodyLimit } from "hono/body-limit";

/**
 * Pins the Hono routing semantics the body-limit wiring in index.ts relies
 * on. Hono's `/*` matches the bare path itself — registering the 1MB JSON
 * limit on "/v1/mysteries/*" capped the 52MB bundle upload at 1MB (prod
 * 413, 2026-07-23). The fix scopes it to "/v1/mysteries/:caseId/*", which
 * requires a path segment. If Hono's matching ever changes, or someone
 * re-broadens the pattern, these tests fail before prod does.
 */
function buildApp() {
  const app = new Hono();
  const tooLarge = (c: never) =>
    (c as { json: (b: unknown, s: number) => Response }).json(
      { error: "payload_too_large" },
      413
    );
  app.use(
    "/v1/mysteries/:caseId/*",
    bodyLimit({ maxSize: 1024 * 1024, onError: tooLarge as never })
  );
  app.post(
    "/v1/mysteries",
    bodyLimit({ maxSize: 52 * 1024 * 1024, onError: tooLarge as never }),
    (c) => c.json({ ok: "upload" }, 201)
  );
  app.post("/v1/mysteries/:caseId/grants", (c) => c.json({ ok: "grant" }, 201));
  return app;
}

const post = (app: Hono, path: string, bytes: number) =>
  app.request(path, {
    method: "POST",
    body: new Uint8Array(bytes),
    headers: { "content-length": String(bytes) },
  });

describe("body-limit route scoping", () => {
  it("bare upload route accepts bodies above 1MB (its own 52MB cap governs)", async () => {
    const res = await post(buildApp(), "/v1/mysteries", 3_500_000);
    expect(res.status).toBe(201);
  });

  it("bare upload route still refuses bodies above 52MB", async () => {
    const app = buildApp();
    const res = await app.request("/v1/mysteries", {
      method: "POST",
      body: new Uint8Array(1024),
      headers: { "content-length": String(53 * 1024 * 1024) },
    });
    expect(res.status).toBe(413);
  });

  it("sub-routes keep the 1MB JSON cap", async () => {
    const res = await post(buildApp(), "/v1/mysteries/blackwood/grants", 2_000_000);
    expect(res.status).toBe(413);
  });

  it("sub-routes accept normal JSON-sized bodies", async () => {
    const res = await post(buildApp(), "/v1/mysteries/blackwood/grants", 512);
    expect(res.status).toBe(201);
  });

  it("documents the Hono gotcha: `/*` matches the bare path", async () => {
    const app = new Hono();
    let ran = false;
    app.use("/v1/mysteries/*", async (_c, next) => {
      ran = true;
      await next();
    });
    app.post("/v1/mysteries", (c) => c.text("ok"));
    await app.request("/v1/mysteries", { method: "POST" });
    expect(ran).toBe(true);
  });
});
