import crypto from "crypto";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12; // 96 bits for GCM
const AUTH_TAG_LENGTH = 16; // 128 bits

function getMasterKey(): Buffer {
  const secret =
    process.env.ENCRYPTION_KEY ||
    process.env.CRON_SECRET ||
    "threads-uploader-default-fallback-key-32b";
  return crypto.createHash("sha256").update(secret).digest();
}

/**
 * Encrypt sensitive plain text using AES-256-GCM
 */
export function encrypt(plainText: string): string {
  const iv = crypto.randomBytes(IV_LENGTH);
  const key = getMasterKey();
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

  const encrypted = Buffer.concat([cipher.update(plainText, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();

  // Format: iv:authTag:encrypted (hex)
  return `${iv.toString("hex")}:${authTag.toString("hex")}:${encrypted.toString("hex")}`;
}

/**
 * Decrypt AES-256-GCM encrypted text. Returns null if invalid or tampered.
 */
export function decrypt(cipherText: string): string | null {
  try {
    const parts = cipherText.split(":");
    if (parts.length !== 3) return null;

    const [ivHex, authTagHex, encryptedHex] = parts;
    if (!ivHex || !authTagHex || !encryptedHex) return null;

    const iv = Buffer.from(ivHex, "hex");
    const authTag = Buffer.from(authTagHex, "hex");
    const encrypted = Buffer.from(encryptedHex, "hex");

    if (iv.length !== IV_LENGTH || authTag.length !== AUTH_TAG_LENGTH) return null;

    const key = getMasterKey();
    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(authTag);

    const decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()]);
    return decrypted.toString("utf8");
  } catch {
    return null;
  }
}

/**
 * Sign session data with HMAC-SHA256
 * Format: payload.timestamp.signature
 */
export function signSession(userId: string, ttlSeconds = 60 * 60 * 24 * 7): string {
  const expiresAt = Date.now() + ttlSeconds * 1000;
  const payload = `${userId}.${expiresAt}`;
  const key = getMasterKey();
  const signature = crypto.createHmac("sha256", key).update(payload).digest("hex");
  return `${payload}.${signature}`;
}

/**
 * Verify and extract userId from signed session token
 */
export function verifySession(token: string): string | null {
  if (!token || typeof token !== "string") return null;

  const parts = token.split(".");
  if (parts.length !== 3) return null;

  const [userId, expiresAtStr, signature] = parts;
  if (!userId || !expiresAtStr || !signature) return null;

  const expiresAt = parseInt(expiresAtStr, 10);
  if (isNaN(expiresAt) || Date.now() > expiresAt) {
    return null; // Expired
  }

  const payload = `${userId}.${expiresAtStr}`;
  const key = getMasterKey();
  const expectedSignature = crypto.createHmac("sha256", key).update(payload).digest("hex");

  try {
    const sigBuffer = Buffer.from(signature, "hex");
    const expBuffer = Buffer.from(expectedSignature, "hex");
    if (sigBuffer.length !== expBuffer.length) return null;
    if (!crypto.timingSafeEqual(sigBuffer, expBuffer)) return null;

    return userId;
  } catch {
    return null;
  }
}
