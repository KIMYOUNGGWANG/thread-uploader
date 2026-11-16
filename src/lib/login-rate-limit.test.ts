import { beforeEach, describe, expect, it, vi } from "vitest";
import { Prisma } from "@prisma/client";

process.env.ENCRYPTION_KEY = "test-encryption-key";

const mocks = vi.hoisted(() => ({
  queryRaw: vi.fn(),
  deleteMany: vi.fn(async () => ({ count: 0 })),
}));
vi.mock("@/lib/prisma", () => ({ prisma: { $queryRaw: mocks.queryRaw, rateLimitBucket: { deleteMany: mocks.deleteMany } } }));

import { checkLoginAttempt, clientIp, LOGIN_IP_LIMIT, LOGIN_PAIR_LIMIT, recordLoginSuccess } from "./login-rate-limit";

const request = (headers: Record<string, string>) => new Request("http://localhost/api/auth/login", { headers });
const sqlValues = (call: unknown[]) => call.slice(1);

describe("clientIp", () => {
  it("takes the first x-forwarded-for hop and unwraps IPv4-mapped addresses", () => {
    expect(clientIp(request({ "x-forwarded-for": "203.0.113.7, 10.0.0.1" }))).toBe("203.0.113.7");
    expect(clientIp(request({ "x-forwarded-for": "::ffff:203.0.113.7" }))).toBe("203.0.113.7");
    expect(clientIp(request({ "x-real-ip": "198.51.100.2" }))).toBe("198.51.100.2");
  });

  it("groups IPv6 by /64 so rotating the interface id does not reset the counter", () => {
    const a = clientIp(request({ "x-forwarded-for": "2001:db8:abcd:12::1" }));
    const b = clientIp(request({ "x-forwarded-for": "2001:0db8:abcd:0012:ffff:1:2:3" }));
    expect(a).toBe("2001:db8:abcd:12::/64");
    expect(b).toBe(a);
    expect(clientIp(request({ "x-forwarded-for": "::1" }))).toBe("0:0:0:0::/64");
  });

  it("falls back to one shared bucket when there is no usable address", () => {
    expect(clientIp(request({}))).toBe("unknown");
    expect(clientIp(request({ "x-forwarded-for": "not-an-ip" }))).toBe("unknown");
  });
});

describe("checkLoginAttempt", () => {
  beforeEach(() => vi.clearAllMocks());

  it("stores only keyed hashes, never the raw email or IP", async () => {
    mocks.queryRaw.mockResolvedValue([{ count: 1 }]);

    await checkLoginAttempt("203.0.113.7", "o@example.com");

    const keys = mocks.queryRaw.mock.calls.map((call) => String(sqlValues(call)[0]));
    expect(keys).toHaveLength(2);
    expect(keys[0]).toMatch(/^login:ip:[0-9a-f]{64}$/);
    expect(keys[1]).toMatch(/^login:pair:[0-9a-f]{64}$/);
    expect(keys.join(" ")).not.toMatch(/203\.0\.113\.7|example\.com/);
  });

  it("allows up to the limits and blocks past either one", async () => {
    mocks.queryRaw.mockResolvedValueOnce([{ count: LOGIN_IP_LIMIT }]).mockResolvedValueOnce([{ count: LOGIN_PAIR_LIMIT }]);
    expect((await checkLoginAttempt("ip", "e")).allowed).toBe(true);
    mocks.queryRaw.mockResolvedValueOnce([{ count: LOGIN_IP_LIMIT + 1 }]).mockResolvedValueOnce([{ count: 1 }]);
    expect((await checkLoginAttempt("ip", "e")).allowed).toBe(false);
    mocks.queryRaw.mockResolvedValueOnce([{ count: 1 }]).mockResolvedValueOnce([{ count: LOGIN_PAIR_LIMIT + 1 }]);
    expect((await checkLoginAttempt("ip", "e")).allowed).toBe(false);
  });

  it.each([
    ["P2010 with 42P01 (raw query)", new Prisma.PrismaClientKnownRequestError("relation missing", { code: "P2010", clientVersion: "5", meta: { code: "42P01" } })],
    ["P2021 (query builder)", new Prisma.PrismaClientKnownRequestError("table missing", { code: "P2021", clientVersion: "5" })],
  ])("lets login through and logs when the table is missing: %s", async (_label, error) => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    mocks.queryRaw.mockRejectedValue(error);

    expect(await checkLoginAttempt("ip", "e")).toEqual({ allowed: true, pairKey: null });
    expect(log).toHaveBeenCalledWith(expect.stringContaining("NOT limited"), error);
    log.mockRestore();
  });

  it("does not swallow other database errors", async () => {
    mocks.queryRaw.mockRejectedValue(new Error("connection refused"));
    await expect(checkLoginAttempt("ip", "e")).rejects.toThrow("connection refused");
  });
});

describe("recordLoginSuccess", () => {
  beforeEach(() => vi.clearAllMocks());

  it("deletes the account+network counter and day-old buckets", async () => {
    await recordLoginSuccess("login:pair:abc");

    expect(mocks.deleteMany).toHaveBeenCalledWith({ where: { key: "login:pair:abc" } });
    expect(mocks.deleteMany).toHaveBeenCalledWith({ where: { windowStart: { lt: expect.any(Date) } } });
  });

  it("does nothing when the limiter was off", async () => {
    await recordLoginSuccess(null);
    expect(mocks.deleteMany).not.toHaveBeenCalled();
  });
});
