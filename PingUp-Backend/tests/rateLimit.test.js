process.env.NODE_ENV = 'test';
const assert = require('node:assert/strict');
const test = require('node:test');
const Module = require('node:module');

// Mock external Redis and Mongoose connections to isolate tests
const originalLoad = Module._load;
Module._load = (request, parent, isMain) => {
  if (request.endsWith('config/redis') || request.endsWith('config/redis.js')) {
    const mockRedisClient = {
      psubscribe: async () => {},
      punsubscribe: async () => {},
      subscribe: async () => {},
      unsubscribe: async () => {},
      publish: async () => {},
      on: () => {},
      off: () => {},
      connect: async () => {},
    };
    return {
      pubClient: mockRedisClient,
      subClient: mockRedisClient,
      redisClient: mockRedisClient,
      redisReady: Promise.resolve(),
    };
  }
  if (request.endsWith('services/messageQueue') || request.endsWith('services/messageQueue.js')) {
    return {
      messageQueue: { add: async () => {} },
    };
  }
  return originalLoad(request, parent, isMain);
};

// Mock User model to prevent DB call errors during login test
const User = require('../models/User');
User.findOne = async () => null;

const { server } = require('../server');

test('Authentication Rate Limiting Test Suite', async (t) => {
  t.after(async () => {
    Module._load = originalLoad;
    if (server.listening) {
      await new Promise((resolve) => server.close(resolve));
    }
  });

  // Start server on dynamic port
  await new Promise((resolve) => server.listen(0, resolve));
  const port = server.address().port;
  const baseUrl = `http://localhost:${port}`;

  await t.test('POST /api/login triggers rate limiting after 15 requests', async () => {
    let lastStatus = 0;
    let data;

    for (let i = 0; i < 16; i++) {
      const res = await fetch(`${baseUrl}/api/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: 'testuser', password: 'password' })
      });
      lastStatus = res.status;
      if (res.status === 429) {
        data = await res.json();
        break;
      }
      await res.text();
    }

    assert.equal(lastStatus, 429, '16th login attempt should be rate limited');
    assert.deepEqual(data, {
      error: 'Too many authentication attempts from this IP, please try again after 15 minutes.'
    });
  });
});
