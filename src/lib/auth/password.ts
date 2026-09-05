import crypto from "node:crypto";

/**
 * Cryptographic Password Hashing using Node.js built-in scrypt with random salt.
 * OWASP & NIST recommended for password storage.
 * Format stored in DB: `${saltHex}:${derivedKeyHex}`
 */

const KEY_LEN = 64;
const SALT_LEN = 16;

/**
 * Hash a plaintext password with a unique, cryptographically secure random salt.
 */
export async function hashPassword(password: string): Promise<string> {
  if (!password || typeof password !== "string") {
    throw new Error("Password must be a non-empty string");
  }

  const salt = crypto.randomBytes(SALT_LEN).toString("hex");

  return new Promise((resolve, reject) => {
    crypto.scrypt(password, salt, KEY_LEN, (err, derivedKey) => {
      if (err) return reject(err);
      resolve(`${salt}:${derivedKey.toString("hex")}`);
    });
  });
}

/**
 * Verify a plaintext password against a stored `${salt}:${derivedKeyHex}` string.
 * Uses timingSafeEqual to prevent side-channel timing attacks.
 */
export async function verifyPassword(password: string, storedHash?: string | null): Promise<boolean> {
  if (!password || !storedHash || typeof storedHash !== "string") {
    return false;
  }

  const parts = storedHash.split(":");
  if (parts.length !== 2) {
    return false;
  }

  const [salt, expectedKeyHex] = parts;
  if (!salt || !expectedKeyHex) {
    return false;
  }

  return new Promise((resolve) => {
    crypto.scrypt(password, salt, KEY_LEN, (err, derivedKey) => {
      if (err) return resolve(false);

      try {
        const expectedBuffer = Buffer.from(expectedKeyHex, "hex");
        // Timing-safe constant-time comparison
        if (derivedKey.length !== expectedBuffer.length) {
          return resolve(false);
        }
        const match = crypto.timingSafeEqual(derivedKey, expectedBuffer);
        resolve(match);
      } catch {
        resolve(false);
      }
    });
  });
}

/**
 * Validate password strength (minimum 6 characters).
 */
export function validatePasswordStrength(password: string): { valid: boolean; reason?: string } {
  if (!password || password.length < 6) {
    return { valid: false, reason: "Password must be at least 6 characters long." };
  }
  return { valid: true };
}
