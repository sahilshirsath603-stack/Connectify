const Redis = require('ioredis');

let redisClient = null;
let redisAvailable = false;
let hasLoggedConnected = false;
let hasLoggedError = false;
let gaveUp = false;

const createRedisClient = () => {
  if (redisClient) return redisClient;

  const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';

  const client = new Redis(redisUrl, {
    // Don't crash the app if Redis is down
    lazyConnect: true,
    retryStrategy: (times) => {
      if (times > 5) {
        // Only warn if we never successfully connected
        if (!hasLoggedConnected) {
          gaveUp = true;
          console.warn('⚠️  Redis: Max reconnect attempts reached. OTP will use MongoDB fallback.');
        }
        return null; // stop retrying
      }
      return Math.min(times * 600, 3000);
    },
    maxRetriesPerRequest: 1,
    enableReadyCheck: true,
    connectTimeout: 10000,
  });

  // 'ready' fires only after the connection is fully usable (after AUTH + SELECT).
  // Use this instead of 'connect' to avoid logging on every reconnect attempt.
  client.on('ready', () => {
    redisAvailable = true;
    hasLoggedError = false; // reset so errors are logged again if it drops later
    if (!hasLoggedConnected) {
      hasLoggedConnected = true;
      console.log('✅ Redis connected');
    }
  });

  client.on('error', (err) => {
    redisAvailable = false;
    if (!hasLoggedError && err.code === 'ECONNREFUSED') {
      hasLoggedError = true;
      console.warn('⚠️  Redis not available. Running without Redis (OTP fallback to MongoDB).');
    }
  });

  client.on('close', () => {
    redisAvailable = false;
  });

  client.connect().catch(() => {
    // Silently handled by error event above
  });

  redisClient = client;
  return client;
};

const getRedis = () => redisClient;
const isRedisAvailable = () => redisAvailable;

module.exports = { createRedisClient, getRedis, isRedisAvailable };
