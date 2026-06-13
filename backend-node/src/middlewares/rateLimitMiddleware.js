import { RateLimiterRedis } from "rate-limiter-flexible";
import { getRedisClient } from "../config/redisClient.js";

// Limiters are initialized exactly once via a promise
let limitersPromise = null;

const getLimiters = () => {
  if (limitersPromise) return limitersPromise;

  limitersPromise = (async () => {
    const redisClient = await getRedisClient();

    const loginLimiter = new RateLimiterRedis({
      storeClient: redisClient,
      keyPrefix: "rate:login",
      points: 10,       // max 10 attempts
      duration: 60 * 15, // per 15 minutes
      blockDuration: 60 * 15,
    });

    const forgotPasswordLimiter = new RateLimiterRedis({
      storeClient: redisClient,
      keyPrefix: "rate:forgot",
      points: 5,
      duration: 60 * 15,
      blockDuration: 60 * 15,
    });

    const resendOtpLimiter = new RateLimiterRedis({
      storeClient: redisClient,
      keyPrefix: "rate:resend-otp",
      points: 5,
      duration: 60 * 10,
      blockDuration: 60 * 10,
    });

    return { loginLimiter, forgotPasswordLimiter, resendOtpLimiter };
  })();

  return limitersPromise;
};

/**
 * Factory: returns an Express middleware bound to the given limiter name.
 * @param {"login"|"forgotPassword"|"resendOtp"} limiterName
 */
const createRateLimitMiddleware = (limiterName) => async (req, res, next) => {
  try {
    const limiters = await getLimiters();
    const limiter = limiters[`${limiterName}Limiter`];

    // Key by IP (falls back to socket address)
    const ip = req.ip || req.socket?.remoteAddress || "unknown";
    await limiter.consume(ip);
    next();
  } catch (rejRes) {
    if (rejRes instanceof Error) {
      // It's an actual system error (e.g. Redis disconnected), not a rate limit rejection.
      return next(rejRes);
    }
    
    const retryAfterSecs = Math.ceil(rejRes.msBeforeNext / 1000) || 60;
    res.set("Retry-After", String(retryAfterSecs));
    res.status(429).json({
      message: `Too many requests. Please try again after ${retryAfterSecs} seconds.`,
      retryAfter: retryAfterSecs,
    });
  }
};

export const loginRateLimit = createRateLimitMiddleware("login");
export const forgotPasswordRateLimit = createRateLimitMiddleware("forgotPassword");
export const resendOtpRateLimit = createRateLimitMiddleware("resendOtp");
