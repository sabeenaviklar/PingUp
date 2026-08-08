process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret-key';
process.env.REFRESH_SECRET = process.env.REFRESH_SECRET || 'test-refresh-secret-key';
const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const Module = require('node:module');

// Mock Redis connection during unit testing 
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
      sMembers: async () => [],
      sAdd: async () => {},
      sRem: async () => {},
      sCard: async () => 0,
    };
    return {
      pubClient: mockRedisClient,
      subClient: mockRedisClient,
      redisClient: mockRedisClient,
      redisReady: Promise.resolve(),
    };
  }
  return originalLoad(request, parent, isMain);
};

const { sanitizeCategoryId } = require('../utils/helpers');

describe('sanitizeCategoryId Helper', () => {
  it('strips "cat-" prefix from prefixed category string', () => {
    assert.equal(sanitizeCategoryId('cat-engineering'), 'engineering');
  });

  it('strips "cat-" prefix when category name contains spaces or unicode symbols', () => {
    assert.equal(sanitizeCategoryId('cat-✦ chat'), '✦ chat');
    assert.equal(sanitizeCategoryId('cat-welcome lounge'), 'welcome lounge');
  });

  it('returns clean category unchanged if "cat-" prefix is not present', () => {
    assert.equal(sanitizeCategoryId('engineering'), 'engineering');
    assert.equal(sanitizeCategoryId('general'), 'general');
  });

  it('handles edge case inputs (null, undefined, non-strings, whitespace) safely without throwing errors', () => {
    assert.equal(sanitizeCategoryId(null), '');
    assert.equal(sanitizeCategoryId(undefined), '');
    assert.equal(sanitizeCategoryId(12345), '');
    assert.equal(sanitizeCategoryId({}), '');
    assert.equal(sanitizeCategoryId(''), '');
    assert.equal(sanitizeCategoryId('  cat-design  '), 'design');
  });
});

describe('Category Deletion Logic & Message Cleanup Strategy', () => {
  it('identifies rooms and target room names correctly for message cleanup', () => {
    const mockRooms = [
      { name: 'eng-1', category: 'engineering' },
      { name: 'eng-2', category: 'engineering' },
      { name: 'design-1', category: 'design' }
    ];

    const categoryInput = 'cat-engineering';
    const targetCategory = sanitizeCategoryId(categoryInput);
    
    assert.equal(targetCategory, 'engineering');
    
    const matchingRooms = mockRooms.filter(r => r.category === targetCategory);
    const roomNames = matchingRooms.map(r => r.name);
    
    assert.deepEqual(roomNames, ['eng-1', 'eng-2']);
  });

  it('simulates full deletion flow clearing rooms and messages for prefixed ID', async () => {
    let mockRooms = [
      { name: 'eng-1', category: 'engineering' },
      { name: 'eng-2', category: 'engineering' },
      { name: 'general', category: 'general' },
    ];
    let mockMessages = [
      { roomName: 'eng-1', text: 'Hello' },
      { roomName: 'eng-2', text: 'World' },
      { roomName: 'general', text: 'Stay' },
    ];

    async function deleteCategorySimulation(rawCategoryId) {
      const targetCategory = sanitizeCategoryId(rawCategoryId);
      if (!targetCategory) return { deletedRooms: 0, deletedMessages: 0 };

      const roomsToDelete = mockRooms.filter(r => r.category === targetCategory);
      const roomNames = roomsToDelete.map(r => r.name);

      let deletedMessages = 0;
      if (roomNames.length > 0) {
        const initialMsgCount = mockMessages.length;
        mockMessages = mockMessages.filter(m => !roomNames.includes(m.roomName));
        deletedMessages = initialMsgCount - mockMessages.length;
      }

      const initialRoomCount = mockRooms.length;
      mockRooms = mockRooms.filter(r => r.category !== targetCategory);
      const deletedRooms = initialRoomCount - mockRooms.length;

      return { deletedRooms, deletedMessages };
    }

    const result = await deleteCategorySimulation('cat-engineering');
    assert.equal(result.deletedRooms, 2);
    assert.equal(result.deletedMessages, 2);
    assert.equal(mockRooms.length, 1);
    assert.equal(mockRooms[0].name, 'general');
    assert.equal(mockMessages.length, 1);
    assert.equal(mockMessages[0].roomName, 'general');
  });

  it('gracefully handles empty/invalid categoryId without deleting any records', async () => {
    let mockRooms = [{ name: 'general', category: 'general' }];
    
    async function deleteCategorySimulation(rawCategoryId) {
      const targetCategory = sanitizeCategoryId(rawCategoryId);
      if (!targetCategory) return { deletedRooms: 0 };
      const initialRoomCount = mockRooms.length;
      mockRooms = mockRooms.filter(r => r.category !== targetCategory);
      return { deletedRooms: initialRoomCount - mockRooms.length };
    }

    const resNull = await deleteCategorySimulation(null);
    assert.equal(resNull.deletedRooms, 0);

    const resUndefined = await deleteCategorySimulation(undefined);
    assert.equal(resUndefined.deletedRooms, 0);

    const resObj = await deleteCategorySimulation({ unsafe: true });
    assert.equal(resObj.deletedRooms, 0);

    assert.equal(mockRooms.length, 1);
  });
});

