import { getRedisClient } from "../config/redisClient.js";

const OTP_TTL_SECONDS = 10 * 60;       // 10 minutes
const RESET_TTL_SECONDS = 15 * 60;     // 15 minutes

const verifyKey = (email) => `otp:verify:${email.toLowerCase()}`;
const resetKey = (hashedToken) => `otp:reset:${hashedToken}`;

// ─── Verify Email OTP ────────────────────────────────────────────────────────

/**
 * Store email verification OTP in Redis with TTL.
 */
export const saveVerifyOTP = async (email, otp) => {
  const redis = await getRedisClient();
  await redis.set(verifyKey(email), otp, "EX", OTP_TTL_SECONDS);
};

/**
 * Read OTP from Redis. Returns null if not found / expired.
 */
export const getVerifyOTP = async (email) => {
  const redis = await getRedisClient();
  return redis.get(verifyKey(email));
};

/**
 * Delete OTP after successful verification.
 */
export const deleteVerifyOTP = async (email) => {
  const redis = await getRedisClient();
  await redis.del(verifyKey(email));
};

// ─── Reset Password Token ────────────────────────────────────────────────────

/**
 * Store reset password token → userId mapping in Redis with TTL.
 * @param {string} hashedToken - SHA-256 hash of the raw token sent to user
 * @param {string} userId - MongoDB ObjectId string
 */
export const saveResetToken = async (hashedToken, userId) => {
  const redis = await getRedisClient();
  await redis.set(resetKey(hashedToken), userId.toString(), "EX", RESET_TTL_SECONDS);
};

/**
 * Lookup userId by hashed reset token. Returns null if not found / expired.
 */
export const getResetToken = async (hashedToken) => {
  const redis = await getRedisClient();
  return redis.get(resetKey(hashedToken));
};

/**
 * Delete reset token after successful password reset.
 */
export const deleteResetToken = async (hashedToken) => {
  const redis = await getRedisClient();
  await redis.del(resetKey(hashedToken));
};
