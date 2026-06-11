const assert = require('node:assert/strict');
const Module = require('node:module');
const test = require('node:test');

test('verifyToken restricts accepted JWT algorithms to HS256', () => {
  const originalJwtSecret = process.env.JWT_SECRET;
  process.env.JWT_SECRET = 'test-secret';

  const originalLoad = Module._load;
  let capturedOptions;

  delete require.cache[require.resolve('../middleware/auth')];

  Module._load = (request, parent, isMain) => {
    if (request === 'jsonwebtoken') {
      return {
        sign: () => 'signed-token',
        verify: (_token, _secret, options) => {
          capturedOptions = options;
          return { id: 'user-1', username: 'test-user', role: 'member' };
        }
      };
    }

    return originalLoad(request, parent, isMain);
  };

  try {
    const { verifyToken } = require('../middleware/auth');

    const decoded = verifyToken('signed-token');

    assert.deepEqual(decoded, {
      id: 'user-1',
      username: 'test-user',
      role: 'member'
    });
    assert.deepEqual(capturedOptions, { algorithms: ['HS256'] });
  } finally {
    if (originalJwtSecret === undefined) {
      delete process.env.JWT_SECRET;
    } else {
      process.env.JWT_SECRET = originalJwtSecret;
    }
    Module._load = originalLoad;
    delete require.cache[require.resolve('../middleware/auth')];
  }
});

test('first test does not leak JWT_SECRET into process.env', () => {
  const beforeAll = process.env.JWT_SECRET;

  process.env.JWT_SECRET = 'leak-check-probe';

  const originalLoad = Module._load;
  Module._load = (request, parent, isMain) => {
    if (request === 'jsonwebtoken') {
      return {
        sign: () => 'signed-token',
        verify: () => ({ id: 'user-1', username: 'test-user', role: 'member' })
      };
    }
    return originalLoad(request, parent, isMain);
  };

  try {
    delete require.cache[require.resolve('../middleware/auth')];
    const { verifyToken } = require('../middleware/auth');
    verifyToken('signed-token');
  } finally {
    if (beforeAll === undefined) {
      delete process.env.JWT_SECRET;
    } else {
      process.env.JWT_SECRET = beforeAll;
    }
    Module._load = originalLoad;
    delete require.cache[require.resolve('../middleware/auth')];
  }

  // After the first test ran and cleaned up, env should match what it was before all tests.
  // If the first test leaked, process.env.JWT_SECRET would still be 'test-secret'.
  assert.notEqual(process.env.JWT_SECRET, 'test-secret',
    'First test leaked JWT_SECRET into process.env');
});
