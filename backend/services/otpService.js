const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const { getRedis, isRedisAvailable } = require('../config/redis');

// ─── Constants ────────────────────────────────────────────────────────────────
const OTP_TTL_SECONDS = 10 * 60;         // 10 minutes (matches email template)
const ATTEMPT_TTL_SECONDS = 10 * 60;     // 10 minutes
const REQUEST_TTL_SECONDS = 5 * 60;      // 5 minutes
const MAX_VERIFY_ATTEMPTS = parseInt(process.env.OTP_MAX_ATTEMPTS) || 5;
const MAX_OTP_REQUESTS = parseInt(process.env.OTP_MAX_REQUESTS) || 3;

// ─── Redis Key Helpers ────────────────────────────────────────────────────────
const otpKey = (userId) => `otp:${userId}`;
const attemptsKey = (userId) => `otp:attempts:${userId}`;
const requestsKey = (userId) => `otp:requests:${userId}`;

// ─── OTP Generation ───────────────────────────────────────────────────────────
/**
 * Generates a cryptographically secure 6-digit OTP.
 */
const generateOTP = () => {
  // Use crypto for true randomness (not Math.random)
  const randomBytes = crypto.randomBytes(4);
  const randomNumber = randomBytes.readUInt32BE(0);
  return String(100000 + (randomNumber % 900000));
};

// ─── OTP Hashing ─────────────────────────────────────────────────────────────
/**
 * Hashes an OTP using bcrypt (never store plain OTP).
 */
const hashOTP = async (otp) => {
  return bcrypt.hash(otp, 10);
};

/**
 * Compares a plain OTP against a stored bcrypt hash.
 */
const compareOTP = async (plainOtp, hashedOtp) => {
  return bcrypt.compare(plainOtp, hashedOtp);
};

// ─── Redis Storage ────────────────────────────────────────────────────────────
/**
 * Stores a hashed OTP in Redis with TTL.
 * Falls back to returning false if Redis is unavailable.
 */
const storeOTP = async (userId, hashedOtp) => {
  if (!isRedisAvailable()) {
    console.warn('⚠️  otpService: Redis unavailable, cannot store OTP in Redis.');
    return false;
  }
  const client = getRedis();
  await client.set(otpKey(userId), hashedOtp, 'EX', OTP_TTL_SECONDS);
  // Reset attempt counter when a new OTP is issued
  await client.del(attemptsKey(userId));
  return true;
};

/**
 * Retrieves the stored OTP hash from Redis.
 */
const getStoredOTPHash = async (userId) => {
  if (!isRedisAvailable()) return null;
  const client = getRedis();
  return client.get(otpKey(userId));
};

/**
 * Deletes OTP data from Redis (after success or manual clear).
 */
const deleteOTP = async (userId) => {
  if (!isRedisAvailable()) return;
  const client = getRedis();
  await client.del(otpKey(userId));
  await client.del(attemptsKey(userId));
};

// ─── Rate Limiting via Redis ──────────────────────────────────────────────────
/**
 * Checks and increments OTP request count.
 * Returns { allowed: bool, remaining: number, resetInSeconds: number }
 */
const checkOTPRequestRate = async (userId) => {
  if (!isRedisAvailable()) {
    // If Redis is down, allow the request (graceful degradation)
    return { allowed: true, remaining: MAX_OTP_REQUESTS - 1, resetInSeconds: REQUEST_TTL_SECONDS };
  }

  const client = getRedis();
  const key = requestsKey(userId);

  const current = await client.incr(key);
  if (current === 1) {
    // First request — set TTL
    await client.expire(key, REQUEST_TTL_SECONDS);
  }

  const ttl = await client.ttl(key);
  const remaining = Math.max(0, MAX_OTP_REQUESTS - current);

  if (current > MAX_OTP_REQUESTS) {
    return { allowed: false, remaining: 0, resetInSeconds: ttl };
  }

  return { allowed: true, remaining, resetInSeconds: ttl };
};

/**
 * Checks and increments OTP verification attempt count.
 * Returns { allowed: bool, attemptsLeft: number }
 */
const checkVerifyAttempts = async (userId) => {
  if (!isRedisAvailable()) {
    return { allowed: true, attemptsLeft: MAX_VERIFY_ATTEMPTS };
  }

  const client = getRedis();
  const key = attemptsKey(userId);

  const current = await client.incr(key);
  if (current === 1) {
    await client.expire(key, ATTEMPT_TTL_SECONDS);
  }

  const attemptsLeft = Math.max(0, MAX_VERIFY_ATTEMPTS - current);

  if (current > MAX_VERIFY_ATTEMPTS) {
    return { allowed: false, attemptsLeft: 0 };
  }

  return { allowed: true, attemptsLeft };
};

// ─── Full OTP Verify Flow ─────────────────────────────────────────────────────
/**
 * Full OTP verification:
 * 1. Check attempt rate
 * 2. Retrieve stored hash
 * 3. Compare
 * 4. Delete OTP on success
 *
 * Returns { success, error, attemptsLeft }
 */
const verifyOTP = async (userId, plainOtp) => {
  // Step 1: Check attempt rate limit
  const { allowed, attemptsLeft } = await checkVerifyAttempts(userId);
  if (!allowed) {
    return {
      success: false,
      error: `Too many failed attempts. Please request a new OTP.`,
      attemptsLeft: 0,
    };
  }

  // Step 2: Get stored hash
  const storedHash = await getStoredOTPHash(userId);
  if (!storedHash) {
    return {
      success: false,
      error: 'OTP has expired or does not exist. Please request a new one.',
      attemptsLeft,
    };
  }

  // Step 3: Compare
  const isMatch = await compareOTP(plainOtp, storedHash);
  if (!isMatch) {
    return {
      success: false,
      error: `Invalid OTP. ${attemptsLeft} attempt${attemptsLeft !== 1 ? 's' : ''} remaining.`,
      attemptsLeft,
    };
  }

  // Step 4: Success — delete OTP
  await deleteOTP(userId);

  return { success: true, error: null, attemptsLeft: MAX_VERIFY_ATTEMPTS };
};

module.exports = {
  generateOTP,
  hashOTP,
  storeOTP,
  getStoredOTPHash,
  deleteOTP,
  checkOTPRequestRate,
  checkVerifyAttempts,
  verifyOTP,
};
