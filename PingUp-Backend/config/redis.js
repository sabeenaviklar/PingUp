const { createClient } = require('redis');
const Redis = require('ioredis');

const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';

const pubClient = createClient({ url: redisUrl });
const subClient = pubClient.duplicate();
const redisClient = pubClient.duplicate(); // For general purpose like presence
const ioRedisClient = new Redis(redisUrl, { maxRetriesPerRequest: null }); // For BullMQ

const redisReady = Promise.all([
  pubClient.connect(),
  subClient.connect(),
  redisClient.connect()
]).then(() => {
  console.log('✅ Redis clients connected');
}).catch(err => {
  console.error('❌ Redis connection error:', err);
  process.exit(1);
});

module.exports = {
  pubClient,
  subClient,
  redisClient,
  ioRedisClient,
  redisReady
};
