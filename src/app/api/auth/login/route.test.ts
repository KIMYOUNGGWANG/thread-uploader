import crypto from "crypto";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

process.env.ENCRYPTION_KEY = "test-encryption-key";

const mocks = vi.hoisted(() => ({
  findUser: vi.fn(),
  checkLoginAttempt: vi.fn(),
  recordLoginSuccess: vi.fn(async () => undefined),
  setCookie: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({ prisma: { user: { findUnique: mocks.findUser } } }));
vi.mock("next/headers", () => ({ cookies: async () => ({ set: mocks.setCookie }) }));
vi.mock("@/lib/login-rate-limit", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/login-rate-limit")>()),
  checkLoginAttempt: mocks.checkLoginAttempt,
  recordLoginSuccess: mocks.recordLoginSuccess,
}));

// verifyPassword and hashPassword are deliberately NOT mocked: the timing fix is only real if scrypt really runs.
import { hashPassword } from "@/lib/auth";
import { POST } from "./route";

function login(body: Record<string, unknown>, ip = "203.0.113.7") {
  return POST(new Request("http://localhost/api/auth/login", {
    method: "POST",
    headers: { "content-type": "application/json", "x-forwarded-for": ip },
    body: JSON.stringify(body),
  }));
}

describe("POST /api/auth/login", () => {
  let storedHash: string;
  beforeAll(async () => {
    storedHash = await hashPassword("correct horse");
  });
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.checkLoginAttempt.mockResolvedValue({ allowed: true, pairKey: "login:pair:abc" });
  });

  // Unknown emails used to answer before running scrypt, so response time told whether an account exists.
  it("runs scrypt for an unknown email and answers 401, not 500", async () => {
    mocks.findUser.mockResolvedValue(null);
    const scrypt = vi.spyOn(crypto, "scrypt");

    const response = await login({ email: "nobody@example.com", password: "guess" });

    expect(response.status).toBe(401);
    expect(scrypt).toHaveBeenCalled();
    scrypt.mockRestore();
  });

  it("answers the same 401 for a wrong password", async () => {
    mocks.findUser.mockResolvedValue({ id: "u1", email: "o@example.com", name: null, password: storedHash });

    const response = await login({ email: "o@example.com", password: "wrong" });

    expect(response.status).toBe(401);
    expect(mocks.recordLoginSuccess).not.toHaveBeenCalled();
  });

  it("logs in, sets the session cookie and clears the account+network counter", async () => {
    mocks.findUser.mockResolvedValue({ id: "u1", email: "o@example.com", name: null, password: storedHash });

    const response = await login({ email: "O@Example.com ", password: "correct horse" });

    expect(response.status).toBe(200);
    expect(mocks.setCookie).toHaveBeenCalledWith("auth_session", expect.any(String), expect.objectContaining({ httpOnly: true }));
    expect(mocks.checkLoginAttempt).toHaveBeenCalledWith("203.0.113.7", "o@example.com");
    expect(mocks.recordLoginSuccess).toHaveBeenCalledWith("login:pair:abc");
  });

  it("answers 429 before checking the password once the limit is hit", async () => {
    mocks.checkLoginAttempt.mockResolvedValue({ allowed: false, pairKey: "login:pair:abc" });
    mocks.findUser.mockResolvedValue({ id: "u1", email: "o@example.com", name: null, password: storedHash });

    const response = await login({ email: "o@example.com", password: "correct horse" });

    expect(response.status).toBe(429);
    expect(response.headers.get("retry-after")).toBe("900");
    expect(mocks.findUser).not.toHaveBeenCalled();
  });
});
