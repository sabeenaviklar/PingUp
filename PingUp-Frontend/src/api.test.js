import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeBaseUrl, getApiUrl } from './api.js';

test('normalizeBaseUrl unit test suite', async (t) => {
  await t.test('strips trailing single slash', () => {
    assert.equal(normalizeBaseUrl('http://localhost:3001/'), 'http://localhost:3001');
  });

  await t.test('strips multiple trailing slashes', () => {
    assert.equal(normalizeBaseUrl('https://pingup-backend.onrender.com///'), 'https://pingup-backend.onrender.com');
  });

  await t.test('trims surrounding whitespace', () => {
    assert.equal(normalizeBaseUrl('  http://localhost:3001/  '), 'http://localhost:3001');
  });

  await t.test('handles empty or non-string inputs safely', () => {
    assert.equal(normalizeBaseUrl(''), '');
    assert.equal(normalizeBaseUrl(null), '');
    assert.equal(normalizeBaseUrl(undefined), '');
  });
});

test('getApiUrl unit test suite', async (t) => {
  await t.test('returns relative URL when base URL is empty (local dev proxy fallback)', () => {
    assert.equal(getApiUrl('/api/users', ''), '/api/users');
    assert.equal(getApiUrl('/api/dm', ''), '/api/dm');
  });

  await t.test('ensures leading slash on endpoint', () => {
    assert.equal(getApiUrl('api/users', ''), '/api/users');
    assert.equal(getApiUrl('api/dm/123', ''), '/api/dm/123');
  });

  await t.test('joins base URL and endpoint without double slashes', () => {
    assert.equal(getApiUrl('/api/users', 'http://localhost:3001'), 'http://localhost:3001/api/users');
    assert.equal(getApiUrl('/api/users', 'http://localhost:3001/'), 'http://localhost:3001/api/users');
    assert.equal(getApiUrl('api/users', 'http://localhost:3001/'), 'http://localhost:3001/api/users');
  });

  await t.test('preserves query parameters', () => {
    assert.equal(getApiUrl('/api/users/search?q=alice', ''), '/api/users/search?q=alice');
    assert.equal(getApiUrl('/api/users/search?q=alice', 'http://localhost:3001/'), 'http://localhost:3001/api/users/search?q=alice');
  });

  await t.test('handles empty endpoint safely', () => {
    assert.equal(getApiUrl('', 'http://localhost:3001'), 'http://localhost:3001');
  });
});
