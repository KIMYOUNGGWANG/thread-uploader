import { describe, expect, it } from "vitest";
import { encrypt, decrypt, signSession, verifySession } from "./crypto";

describe("crypto utilities", () => {
  it("encrypts and decrypts text cleanly with AES-256-GCM", () => {
    const original = "THAAUubLFZCJwZABYmItcHI2MEw5eHp";
    const encrypted = encrypt(original);

    expect(encrypted).not.toBe(original);
    expect(encrypted.split(":")).toHaveLength(3);

    const decrypted = decrypt(encrypted);
    expect(decrypted).toBe(original);
  });

  it("returns null for tampered cipher text", () => {
    const encrypted = encrypt("secret-token");
    const parts = encrypted.split(":");
    // Tamper with payload
    const tampered = `${parts[0]}:${parts[1]}:badpayload1234`;
    expect(decrypt(tampered)).toBeNull();
  });

  it("signs and verifies session tokens correctly", () => {
    const userId = "cmqpj5swv0000eizeddjsl0re";
    const token = signSession(userId);

    expect(token).toContain(userId);
    const verifiedId = verifySession(token);
    expect(verifiedId).toBe(userId);
  });

  it("rejects tampered or forged session signatures", () => {
    const userId = "cmqpj5swv0000eizeddjsl0re";
    const token = signSession(userId);
    const parts = token.split(".");

    // Forgery attempt: switch to admin id keeping signature
    const forged = `admin-target-user-id.${parts[1]}.${parts[2]}`;
    expect(verifySession(forged)).toBeNull();
  });

  it("rejects expired session tokens", () => {
    const userId = "cmqpj5swv0000eizeddjsl0re";
    // -10 seconds TTL
    const expiredToken = signSession(userId, -10);
    expect(verifySession(expiredToken)).toBeNull();
  });
});
