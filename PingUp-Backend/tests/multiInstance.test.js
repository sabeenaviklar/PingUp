process.env.NODE_ENV = 'test';
const assert = require('node:assert/strict');
const test = require('node:test');
const http = require('node:http');
const Module = require('node:module');

// ─────────────────────────────────────────────────────────────────────
//  App-level mocks (models, queue, presence redis) — the test boots two
//  Socket.IO servers with REAL Redis adapters, but the handlers hit the
//  database/BullMQ/presence, which we isolate here (same approach as the
//  existing cookieAuth.test.js).
// ─────────────────────────────────────────────────────────────────────
const originalLoad = Module._load;

const presenceKeys = new Set();
const mockRedisClient = {
    on: () => {},
    off: () => {},
    connect: async () => {},
    duplicate: () => mockRedisClient,
    psubscribe: async () => {},
    punsubscribe: async () => {},
    subscribe: async () => {},
    unsubscribe: async () => {},
    publish: async () => 0,
    sAdd: async (key, val) => { presenceKeys.add(`${key}:${val}`); },
    sRem: async (key, val) => { presenceKeys.delete(`${key}:${val}`); },
    sCard: async () => 0,
    sMembers: async (key) =>
        [...presenceKeys].filter(k => k.startsWith(`${key}:`)).map(k => k.slice(key.length + 1)),
};

// In-memory user store keyed by id
const usersMap = new Map();
function makeUser(id, username, role) {
    return {
        _id: { toString: () => id },
        id,
        username,
        role,
        banned: false,
        save: async function () { return this; },
        toSafeObject: function () { return { id, username, role }; },
        toPrivateProfile: function () { return { id, username, role }; },
    };
}

const userModel = {
    findById: async (id) => usersMap.get(String(id)) || null,
    findByIdAndUpdate: async (id, upd) => {
        const u = usersMap.get(String(id));
        if (u) Object.assign(u, upd);
        return u;
    },
    findOne: async (q) =>
        [...usersMap.values()].find(u => !q || (q.username && u.username === q.username)) || null,
    find: async () => [...usersMap.values()],
    updateOne: async (q, upd) => {
        const u = usersMap.get(String(q?._id));
        if (u && upd?.$set) Object.assign(u, upd.$set);
        return { matchedCount: u ? 1 : 0 };
    },
    countDocuments: async () => usersMap.size,
    create: async (doc) => doc,
};
const roomsMap = new Map([
    ['general', { _id: { toString: () => 'room-general' }, name: 'general', isReadOnly: false, isLocked: false }],
]);
const roomModel = {
    find: async () => [],
    findOne: async (q) => roomsMap.get(q?.name) || null,
    findById: async () => null,
    create: async (d) => d,
    findByIdAndDelete: async () => null,
    findOneAndUpdate: async () => null,
    deleteMany: async () => {},
};
const messageModel = {
    find: async () => [],
    findById: async () => null,
    findByIdAndUpdate: async () => null,
    create: async (d) => d,
    deleteMany: async () => {},
    updateMany: async () => {},
};
const directMessageModel = {
    findOne: async () => null,
    create: async (doc) => ({
        _id: { toString: () => 'dm-msg-1' },
        ...doc,
        read: false,
        save: async function () { return this; },
    }),
    updateMany: async () => ({ modifiedCount: 0 }),
    find: async () => [],
};
const serverSettingsModel = {
    findOne: async () => null,
    findOneAndUpdate: async () => null,
};

Module._load = (request, parent, isMain) => {
    if (request.endsWith('config/redis')) {
        return {
            pubClient: mockRedisClient,
            subClient: mockRedisClient,
            redisClient: mockRedisClient,
            ioRedisClient: mockRedisClient,
            redisReady: Promise.resolve(),
        };
    }
    if (request.endsWith('services/messageQueue')) {
        return { messageQueue: { add: async () => {} } };
    }
    if (request.endsWith('models/User')) return userModel;
    if (request.endsWith('models/Room')) return roomModel;
    if (request.endsWith('models/Message')) return messageModel;
    if (request.endsWith('models/DirectMessage')) return directMessageModel;
    if (request.endsWith('models/ServerSettings')) return serverSettingsModel;
    return originalLoad(request, parent, isMain);
};

const { setupHandlers } = require('../sockets/handlers');

// Cleanup any open handles after the suite
process.on('exit', () => {
    Module._load = originalLoad;
});

const { Server } = require('socket.io');
const { createAdapter } = require('@socket.io/redis-adapter');
const { createClient } = require('redis');
const { io: ioClient } = require('socket.io-client');

const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';

function once(emitter, event, timeoutMs = 5000) {
    return new Promise((resolve, reject) => {
        const timer = setTimeout(() => {
            emitter.off(event, handler);
            reject(new Error(`Timed out waiting for "${event}"`));
        }, timeoutMs);
        const handler = (arg) => {
            clearTimeout(timer);
            resolve(arg);
        };
        emitter.once(event, handler);
    });
}

test('Two-instance Socket.IO: cross-instance user targeting via per-user rooms', async (t) => {
    // Probe Redis — skip gracefully when it is not running (e.g. local dev).
    const probe = createClient({ url: REDIS_URL });
    let redisAvailable = false;
    try {
        await probe.connect();
        redisAvailable = true;
        await probe.quit();
    } catch (err) {
        redisAvailable = false;
    }
    if (!redisAvailable) {
        t.skip('Redis unavailable — skipping two-instance integration test');
        return;
    }

    const pub1 = createClient({ url: REDIS_URL });
    const sub1 = pub1.duplicate();
    const pub2 = createClient({ url: REDIS_URL });
    const sub2 = pub2.duplicate();
    await Promise.all([pub1.connect(), sub1.connect(), pub2.connect(), sub2.connect()]);

    const http1 = http.createServer();
    const http2 = http.createServer();
    const io1 = new Server(http1, { cors: { origin: '*' } });
    const io2 = new Server(http2, { cors: { origin: '*' } });
    io1.adapter(createAdapter(pub1, sub1));
    io2.adapter(createAdapter(pub2, sub2));

    await new Promise(r => http1.listen(0, r));
    await new Promise(r => http2.listen(0, r));
    const port1 = http1.address().port;
    const port2 = http2.address().port;

    // Mimic sockets/index.js: set socket.user, replicate it to socket.data,
    // join the per-user room, then wire the real handlers.
    const attach = (io, user) => {
        io.on('connection', (socket) => {
            socket.user = { id: user.id, username: user.username, role: user.role };
            socket.data.user = socket.user;
            socket.join(`user:${socket.user.id}`);
            setupHandlers(io, socket);
        });
    };
    attach(io1, { id: 'mod-1', username: 'moderator', role: 'owner' });
    attach(io2, { id: 'target-1', username: 'target', role: 'member' });

    usersMap.set('mod-1', makeUser('mod-1', 'moderator', 'owner'));
    usersMap.set('target-1', makeUser('target-1', 'target', 'member'));

    const clients = [];
    const connectClient = (url) => {
        const c = ioClient(url, { transports: ['websocket'], forceNew: true });
        clients.push(c);
        return c;
    };

    t.after(async () => {
        for (const c of clients) c.close();
        await Promise.allSettled([io1.close(), io2.close()]);
        await new Promise(r => http1.close(r));
        await new Promise(r => http2.close(r));
        await Promise.allSettled([pub1.quit(), sub1.quit(), pub2.quit(), sub2.quit()]);
        usersMap.clear();
    });

    await t.test('user:kick from instance 1 disconnects the target on instance 2', async () => {
        const modClient = connectClient(`http://localhost:${port1}`);
        const targetClient = connectClient(`http://localhost:${port2}`);
        await Promise.all([once(modClient, 'connect'), once(targetClient, 'connect')]);

        const kickedP = once(targetClient, 'kicked');
        const discP = once(targetClient, 'disconnect');
        modClient.emit('user:kick', { targetId: 'target-1' });

        const kicked = await kickedP;
        assert.equal(kicked.by, 'moderator');
        await discP; // connection must actually close on instance 2
    });

    await t.test('/kick command from instance 1 disconnects the target on instance 2', async () => {
        const modClient = connectClient(`http://localhost:${port1}`);
        const targetClient = connectClient(`http://localhost:${port2}`);
        await Promise.all([once(modClient, 'connect'), once(targetClient, 'connect')]);

        const kickedP = once(targetClient, 'kicked');
        const discP = once(targetClient, 'disconnect');
        modClient.emit('message:send', { roomName: 'general', text: '/kick target' });

        const kicked = await kickedP;
        assert.equal(kicked.by, 'moderator');
        await discP;
    });

    await t.test('user:ban from instance 1 disconnects the target on instance 2', async () => {
        const modClient = connectClient(`http://localhost:${port1}`);
        const targetClient = connectClient(`http://localhost:${port2}`);
        await Promise.all([once(modClient, 'connect'), once(targetClient, 'connect')]);

        const kickedP = once(targetClient, 'kicked');
        const discP = once(targetClient, 'disconnect');
        modClient.emit('user:ban', { targetId: 'target-1' });

        const kicked = await kickedP;
        assert.match(kicked.by, /banned/);
        await discP;
        assert.equal(usersMap.get('target-1').banned, true);
    });

    await t.test('user:setrole from instance 1 delivers role:updated on instance 2', async () => {
        const modClient = connectClient(`http://localhost:${port1}`);
        const targetClient = connectClient(`http://localhost:${port2}`);
        await Promise.all([once(modClient, 'connect'), once(targetClient, 'connect')]);

        const roleUpdatedP = once(targetClient, 'role:updated');
        modClient.emit('user:setrole', { targetId: 'target-1', role: 'moderator' });

        const payload = await roleUpdatedP;
        assert.equal(payload.role, 'moderator');
    });

    await t.test('dm:send delivers dm:notification to a recipient on instance 2', async () => {
        const modClient = connectClient(`http://localhost:${port1}`);
        const targetClient = connectClient(`http://localhost:${port2}`);
        await Promise.all([once(modClient, 'connect'), once(targetClient, 'connect')]);

        const notifP = once(targetClient, 'dm:notification');
        modClient.emit('dm:send', { toUserId: 'target-1', text: 'hello from instance 1' });

        const notif = await notifP;
        assert.equal(notif.fromId, 'mod-1');
        assert.equal(notif.preview, 'hello from instance 1');
    });

    await t.test('dm:join on instance 2 sends dm:read receipt to the user on instance 1', async () => {
        const modClient = connectClient(`http://localhost:${port1}`);
        const targetClient = connectClient(`http://localhost:${port2}`);
        await Promise.all([once(modClient, 'connect'), once(targetClient, 'connect')]);

        const readP = once(modClient, 'dm:read');
        targetClient.emit('dm:join', { otherUserId: 'mod-1' });

        const receipt = await readP;
        assert.equal(receipt.readerId, 'target-1');
    });
});
