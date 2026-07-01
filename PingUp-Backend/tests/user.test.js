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

// Mock User model methods before importing server
const User = require('../models/User');

const mockUsers = [
  {
    _id: 'user-alice',
    username: 'alice',
    displayName: 'Alice In Wonderland',
    role: 'member',
    online: true,
    banned: false,
    toSafeObject: () => ({ id: 'user-alice', username: 'alice', displayName: 'Alice In Wonderland', role: 'member', online: true })
  },
  {
    _id: 'user-bob',
    username: 'bob',
    displayName: 'Builder Bob',
    role: 'moderator',
    online: false,
    banned: false,
    toSafeObject: () => ({ id: 'user-bob', username: 'bob', displayName: 'Builder Bob', role: 'moderator', online: false })
  },
  {
    _id: 'user-banned',
    username: 'banneduser',
    displayName: 'Bad Agent',
    role: 'member',
    online: false,
    banned: true,
    toSafeObject: () => ({ id: 'user-banned', username: 'banneduser', displayName: 'Bad Agent', role: 'member', online: false })
  },
  {
    _id: 'user-searcher',
    username: 'searcher',
    displayName: 'Self User',
    role: 'member',
    online: true,
    banned: false,
    toSafeObject: () => ({ id: 'user-searcher', username: 'searcher', displayName: 'Self User', role: 'member', online: true })
  }
];

let lastQuery = null;
let lastLimit = null;

// Mock Mongoose's find chaining behavior
User.find = function (query) {
  lastQuery = query;
  const queryChain = {
    limit: function (n) {
      lastLimit = n;
      return queryChain;
    },
    then: function (onFulfilled) {
      let matches = mockUsers;

      // Exclude searching user
      if (query._id && query._id.$ne) {
        matches = matches.filter(u => u._id !== query._id.$ne);
      }

      // Exclude banned users
      if (query.banned && query.banned.$ne) {
        matches = matches.filter(u => u.banned !== query.banned.$ne);
      }

      // Search filters
      if (query.$or) {
        const usernameFilter = query.$or.find(f => f.username);
        const displayNameFilter = query.$or.find(f => f.displayName);

        const uRegex = usernameFilter ? new RegExp(usernameFilter.username.$regex, usernameFilter.username.$options) : null;
        const dRegex = displayNameFilter ? new RegExp(displayNameFilter.displayName.$regex, displayNameFilter.displayName.$options) : null;

        matches = matches.filter(u => {
          const uMatch = uRegex ? uRegex.test(u.username) : false;
          const dMatch = dRegex ? dRegex.test(u.displayName) : false;
          return uMatch || dMatch;
        });
      }

      if (lastLimit) {
        matches = matches.slice(0, lastLimit);
      }

      const safeMatches = matches.map(u => ({
        ...u,
        toSafeObject: u.toSafeObject
      }));

      onFulfilled(safeMatches);
      return Promise.resolve(safeMatches);
    }
  };
  return queryChain;
};

// Import our server configuration
const { server } = require('../server');
const { generateToken } = require('../middleware/auth');

test('User Search API Integration Test Suite', async (t) => {
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

  const requester = { _id: { toString: () => 'user-searcher' }, username: 'searcher', role: 'member' };
  const validToken = generateToken(requester);

  await t.test('GET /api/users/search - returns 401 if unauthorized', async () => {
    const res = await fetch(`${baseUrl}/api/users/search?q=alice`);
    const data = await res.json();
    assert.equal(res.status, 401);
    assert.equal(data.error, 'Unauthorized: No token provided');
  });

  await t.test('GET /api/users/search - returns empty array if search query is empty', async () => {
    const res = await fetch(`${baseUrl}/api/users/search?q=`, {
      headers: { Authorization: `Bearer ${validToken}` }
    });
    const data = await res.json();
    assert.equal(res.status, 200);
    assert.deepEqual(data, []);
  });

  await t.test('GET /api/users/search - returns matched users, excluding self and banned users', async () => {
    const res = await fetch(`${baseUrl}/api/users/search?q=a`, {
      headers: { Authorization: `Bearer ${validToken}` }
    });
    const data = await res.json();
    assert.equal(res.status, 200);
    
    // Matches should contain:
    // 'alice' (matches username 'alice')
    // Should NOT contain:
    // 'searcher' (self exclusion)
    // 'banneduser' (banned exclusion)
    assert.equal(data.length, 1);
    assert.equal(data[0].username, 'alice');
    assert.equal(data[0].id, 'user-alice');
  });

  await t.test('GET /api/users/search - performs case-insensitive matching on displayName', async () => {
    const res = await fetch(`${baseUrl}/api/users/search?q=builder`, {
      headers: { Authorization: `Bearer ${validToken}` }
    });
    const data = await res.json();
    assert.equal(res.status, 200);
    assert.equal(data.length, 1);
    assert.equal(data[0].username, 'bob');
    assert.equal(data[0].displayName, 'Builder Bob');
  });

  await t.test('GET /api/users/search - escapes regex special characters in search input', async () => {
    const res = await fetch(`${baseUrl}/api/users/search?q=.*`, {
      headers: { Authorization: `Bearer ${validToken}` }
    });
    const data = await res.json();
    assert.equal(res.status, 200);
    
    // The literal query '.*' should be escaped.
    // If it is NOT escaped, it acts as a wildcard and matches 'alice' and 'bob'.
    // If it IS escaped, it matches nothing because no usernames contain literal '.*'.
    assert.equal(data.length, 0);
  });

  await t.test('GET /api/users/search - handles non-string q queries safely (arrays/objects)', async () => {
    const res1 = await fetch(`${baseUrl}/api/users/search?q=alice&q=bob`, {
      headers: { Authorization: `Bearer ${validToken}` }
    });
    const data1 = await res1.json();
    assert.equal(res1.status, 200);
    assert.deepEqual(data1, []);

    const res2 = await fetch(`${baseUrl}/api/users/search?q[a]=b`, {
      headers: { Authorization: `Bearer ${validToken}` }
    });
    const data2 = await res2.json();
    assert.equal(res2.status, 200);
    assert.deepEqual(data2, []);
  });
});
