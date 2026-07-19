import { describe, expect, it } from "vitest";
import {
  backoffMs,
  classifyError,
  ClassifiedError,
  isTransportRetryable,
  wrapThrown,
} from "./retry.js";

describe("classifyError", () => {
  it("classifies 429 as transient", () => {
    expect(classifyError({ status: 429, message: "rate limit" })).toBe(
      "transient"
    );
  });

  it("classifies 503 as transient", () => {
    expect(classifyError({ status: 503, message: "unavailable" })).toBe(
      "transient"
    );
  });

  it("classifies 401 as auth", () => {
    expect(classifyError({ status: 401, message: "unauthorized" })).toBe(
      "auth"
    );
  });

  it("classifies 400 as invalid_request", () => {
    expect(classifyError({ status: 400, message: "bad request" })).toBe(
      "invalid_request"
    );
  });

  it("classifies network messages as transient", () => {
    expect(classifyError(new Error("fetch failed"))).toBe("transient");
    expect(classifyError(new Error("socket hang up"))).toBe("transient");
    expect(classifyError(new Error("Request timed out"))).toBe("transient");
  });

  it("classifies SyntaxError as parse", () => {
    expect(classifyError(new SyntaxError("Unexpected token"))).toBe("parse");
  });

  it("classifies ZodError by name", () => {
    const err = { name: "ZodError", message: "bad", issues: [] };
    expect(classifyError(err)).toBe("schema");
  });
});

describe("isTransportRetryable", () => {
  it("only retries transient", () => {
    expect(isTransportRetryable("transient")).toBe(true);
    expect(isTransportRetryable("auth")).toBe(false);
    expect(isTransportRetryable("schema")).toBe(false);
  });
});

describe("backoffMs", () => {
  it("grows with attempt and respects retry-after", () => {
    const a0 = backoffMs(0, { baseMs: 100, maxMs: 10_000 });
    const a2 = backoffMs(2, { baseMs: 100, maxMs: 10_000 });
    expect(a0).toBeGreaterThanOrEqual(100);
    expect(a2).toBeGreaterThan(a0);
    expect(backoffMs(0, { retryAfterMs: 1500, maxMs: 10_000 })).toBe(1500);
  });
});

describe("wrapThrown", () => {
  it("preserves ClassifiedError", () => {
    const c = new ClassifiedError("x", { failureClass: "soft" });
    expect(wrapThrown(c)).toBe(c);
  });
});
