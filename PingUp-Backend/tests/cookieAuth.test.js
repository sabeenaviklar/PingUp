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

const User = require('../models/User');

// Mock user profiles
const mockUser = {
  _id: 'mock-user-123',
  username: 'cookieuser',
  displayName: 'Cookie User',
  role: 'member',
  comparePassword: async () => true,
  save: async function() { return this; },
  toPrivateProfile: () => ({ id: 'mock-user-123', username: 'cookieuser', displayName: 'Cookie User', role: 'member' })
};

User.findOne = async () => mockUser;
User.findById = async () => mockUser;

const { server } = require('../server');

test('Secure HttpOnly Cookie Auth Integration Test Suite', async (t) => {
  t.after(async () => {
    Module._load = originalLoad;
    if (server.listening) {
      await new Promise((resolve) => server.close(resolve));
    }
  });

  await new Promise((resolve) => server.listen(0, resolve));
  const port = server.address().port;
  const baseUrl = `http://localhost:${port}`;

  await t.test('POST /api/login sets the token cookie', async () => {
    const res = await fetch(`${baseUrl}/api/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'cookieuser', password: 'password' })
    });
    
    assert.equal(res.status, 200);
    const cookieHeader = res.headers.get('set-cookie');
    assert.ok(cookieHeader, 'Response should set a cookie');
    assert.match(cookieHeader, /token=/, 'Cookie header should set the token');
    assert.match(cookieHeader, /HttpOnly/, 'Cookie should have HttpOnly flag');
  });

  await t.test('GET /api/me validates credentials from cookie', async () => {
    // 1. Perform login to get the cookie
    const loginRes = await fetch(`${baseUrl}/api/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'cookieuser', password: 'password' })
    });
    const cookieHeader = loginRes.headers.get('set-cookie');
    const tokenCookie = cookieHeader.split(';')[0]; // extracts token=xxxx

    // 2. Make authenticated request using the cookie
    const meRes = await fetch(`${baseUrl}/api/me`, {
      headers: { Cookie: tokenCookie }
    });
    assert.equal(meRes.status, 200);
    const data = await meRes.json();
    assert.equal(data.user.username, 'cookieuser');
  });

  await t.test('POST /api/logout clears the token cookie', async () => {
    const res = await fetch(`${baseUrl}/api/logout`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken: 'dummy-refresh-token' })
    });
    
    assert.equal(res.status, 200);
    const cookieHeader = res.headers.get('set-cookie');
    assert.ok(cookieHeader, 'Response should set-cookie for logout');
    assert.match(cookieHeader, /token=;/, 'Cookie should be cleared');
    assert.match(cookieHeader, /Max-Age=0|Expires=/, 'Cookie should be expired immediately');
  });
});
