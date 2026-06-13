import Redis from "ioredis";

const REDIS_URL = process.env.REDIS_URL || "redis://localhost:6379";

let clientPromise = null;

/**
 * Returns a connected Redis singleton client.
 * Safe to call multiple times — always returns the same connected instance.
 */
export const getRedisClient = async () => {
  if (clientPromise) return clientPromise;

  clientPromise = new Promise((resolve, reject) => {
    const client = new Redis(REDIS_URL);

    client.on("error", (err) => {
      console.error("[Redis] Client error:", err.message);
    });

    client.on("connect", () => {
      console.log("[Redis] Connected to", REDIS_URL);
    });

    client.on("ready", () => {
      resolve(client);
    });

    client.on("reconnecting", () => {
      console.warn("[Redis] Reconnecting...");
    });
  });

  return clientPromise;
};

/**
 * Gracefully disconnect Redis client (for tests / shutdown).
 */
export const disconnectRedis = async () => {
  if (client) {
    await client.quit();
    client = null;
  }
};
