import { isIPv4, isIPv6 } from "node:net";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { keyedHash } from "@/lib/crypto";

// Vercel functions share no memory, so the counters live in Postgres (RateLimitBucket).
const WINDOW_SECONDS = 15 * 60;
// Every attempt from one network, any account: slows a guessing run without locking out a shared office.
export const LOGIN_IP_LIMIT = 50;
// One account from one network: the guessing limit. Cleared on a successful login.
export const LOGIN_PAIR_LIMIT = 10;
export const LOGIN_RETRY_AFTER_SECONDS = WINDOW_SECONDS;
// There is no per-email key on purpose: anyone could then lock the operator out from anywhere.

/** Vercel sets x-forwarded-for to the connecting client; IPv6 is grouped by /64, the usual per-customer block. */
export function clientIp(request: Request): string {
  const raw = (request.headers.get("x-forwarded-for")?.split(",")[0] ?? request.headers.get("x-real-ip") ?? "").trim();
  const mapped = raw.toLowerCase().startsWith("::ffff:") ? raw.slice(7) : raw;
  if (isIPv4(mapped)) return mapped;
  if (isIPv6(raw)) return `${expandIPv6(raw).slice(0, 4).join(":")}::/64`;
  return "unknown";
}

function expandIPv6(address: string): string[] {
  const [head, tail = ""] = address.toLowerCase().split("%")[0].split("::");
  const left = head ? head.split(":") : [];
  const right = address.includes("::") && tail ? tail.split(":") : [];
  const groups = address.includes("::") ? [...left, ...Array(8 - left.length - right.length).fill("0"), ...right] : left;
  return groups.map((group) => group.replace(/^0+(?=.)/, ""));
}

function isMissingTable(error: unknown): boolean {
  if (!(error instanceof Prisma.PrismaClientKnownRequestError)) return false;
  // P2021 from the query builder; raw queries surface Postgres' undefined_table (42P01) inside P2010.
  return error.code === "P2021" || (error.code === "P2010" && String((error.meta as { code?: unknown } | undefined)?.code) === "42P01");
}

// Increments first and reads the result, in one statement: concurrent attempts cannot both pass a check-then-write.
// The window restarts once it is older than WINDOW_SECONDS by the database clock, so a lockout ends on its own.
async function hit(key: string): Promise<number> {
  const rows = await prisma.$queryRaw<Array<{ count: number }>>`
    INSERT INTO "RateLimitBucket" ("key", "count", "windowStart")
    VALUES (${key}, 1, now())
    ON CONFLICT ("key") DO UPDATE SET
      "count" = CASE WHEN "RateLimitBucket"."windowStart" <= now() - make_interval(secs => ${WINDOW_SECONDS}::double precision)
        THEN 1 ELSE "RateLimitBucket"."count" + 1 END,
      "windowStart" = CASE WHEN "RateLimitBucket"."windowStart" <= now() - make_interval(secs => ${WINDOW_SECONDS}::double precision)
        THEN now() ELSE "RateLimitBucket"."windowStart" END
    RETURNING "count"`;
  return Number(rows[0]?.count ?? 0);
}

export interface LoginAttempt {
  allowed: boolean;
  pairKey: string | null;
}

/** Counts this attempt before the password is checked; `allowed: false` means answer 429 without checking it. */
export async function checkLoginAttempt(ip: string, email: string): Promise<LoginAttempt> {
  const ipKey = `login:ip:${keyedHash(ip)}`;
  const pairKey = `login:pair:${keyedHash(`${email}\n${ip}`)}`;
  try {
    const ipCount = await hit(ipKey);
    const pairCount = await hit(pairKey);
    return { allowed: ipCount <= LOGIN_IP_LIMIT && pairCount <= LOGIN_PAIR_LIMIT, pairKey };
  } catch (error) {
    if (!isMissingTable(error)) throw error;
    // Deployed before its migration: keep login working, but say so on every attempt.
    console.error("[login-rate-limit] RateLimitBucket table is missing; login attempts are NOT limited until the migration runs", error);
    return { allowed: true, pairKey: null };
  }
}

/** A correct password clears this account+network counter and drops buckets older than a day. */
export async function recordLoginSuccess(pairKey: string | null): Promise<void> {
  if (!pairKey) return;
  try {
    await prisma.rateLimitBucket.deleteMany({ where: { key: pairKey } });
    await prisma.rateLimitBucket.deleteMany({ where: { windowStart: { lt: new Date(Date.now() - 24 * 60 * 60 * 1000) } } });
  } catch (error) {
    if (!isMissingTable(error)) throw error;
    console.error("[login-rate-limit] RateLimitBucket table is missing; cleanup skipped", error);
  }
}
