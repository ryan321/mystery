import { describe, expect, it, beforeEach } from "vitest";
import { googleAuthUrl, parseIdToken, safeNextPath } from "./google-auth.js";

const CLIENT_ID = "test-client.apps.googleusercontent.com";

function fakeIdToken(claims: Record<string, unknown>): string {
  const enc = (obj: unknown) =>
    Buffer.from(JSON.stringify(obj)).toString("base64url");
  return `${enc({ alg: "RS256", typ: "JWT" })}.${enc(claims)}.fakesig`;
}

const VALID = {
  iss: "https://accounts.google.com",
  aud: CLIENT_ID,
  exp: Math.floor(Date.now() / 1000) + 3600,
  sub: "10769150350006150715113082367",
  email: "sleuth@example.com",
  email_verified: true,
  name: "A. Sleuth",
};

describe("parseIdToken", () => {
  it("accepts a valid token and extracts the profile", () => {
    const res = parseIdToken(fakeIdToken(VALID), CLIENT_ID);
    expect(res).toEqual({
      sub: VALID.sub,
      email: "sleuth@example.com",
      name: "A. Sleuth",
    });
  });

  it("accepts the bare accounts.google.com issuer", () => {
    const res = parseIdToken(
      fakeIdToken({ ...VALID, iss: "accounts.google.com" }),
      CLIENT_ID
    );
    expect("error" in res).toBe(false);
  });

  it.each([
    ["wrong issuer", { iss: "https://evil.example" }, "wrong_issuer"],
    ["wrong audience", { aud: "other-client" }, "wrong_audience"],
    ["expired", { exp: Math.floor(Date.now() / 1000) - 10 }, "expired"],
    ["missing sub", { sub: undefined }, "missing_sub"],
    ["unverified email", { email_verified: false }, "email_not_verified"],
    ["missing email", { email: undefined }, "email_not_verified"],
  ])("rejects %s", (_label, patch, error) => {
    const res = parseIdToken(fakeIdToken({ ...VALID, ...patch }), CLIENT_ID);
    expect(res).toEqual({ error });
  });

  it("rejects malformed tokens", () => {
    expect(parseIdToken("not-a-jwt", CLIENT_ID)).toEqual({
      error: "malformed_id_token",
    });
    expect(parseIdToken("a.!!!.c", CLIENT_ID)).toEqual({
      error: "malformed_id_token",
    });
  });
});

describe("safeNextPath", () => {
  it("keeps same-site paths", () => {
    expect(safeNextPath("/mystery/dead-air")).toBe("/mystery/dead-air");
  });

  it.each([
    [undefined],
    [""],
    ["https://evil.example/phish"],
    ["//evil.example"],
    ["\\evil"],
    ["gallery"],
  ])("falls back to the gallery for %s", (raw) => {
    expect(safeNextPath(raw as string | undefined)).toBe("/gallery");
  });
});

describe("googleAuthUrl", () => {
  beforeEach(() => {
    process.env.GOOGLE_CLIENT_ID = CLIENT_ID;
    process.env.API_ORIGIN = "https://api.example.com";
  });

  it("points at Google with the right parameters", () => {
    const url = new URL(googleAuthUrl("state-123"));
    expect(url.origin).toBe("https://accounts.google.com");
    expect(url.searchParams.get("client_id")).toBe(CLIENT_ID);
    expect(url.searchParams.get("redirect_uri")).toBe(
      "https://api.example.com/v1/auth/google/callback"
    );
    expect(url.searchParams.get("response_type")).toBe("code");
    expect(url.searchParams.get("state")).toBe("state-123");
    expect(url.searchParams.get("scope")).toContain("email");
  });
});
