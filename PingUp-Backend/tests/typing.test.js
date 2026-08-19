process.env.NODE_ENV = 'test';
const assert = require('node:assert/strict');
const { test } = require('node:test');
const http = require('http');
const Module = require('node:module');

// Mock external Redis and BullMQ connections to isolate tests
// (handlers.js -> commands/helpers/messageQueue -> config/redis).
const originalLoad = Module._load;
Module._load = (request, parent, isMain) => {
    if (request.endsWith('config/redis') || request.endsWith('config/redis.js')) {
        const mockRedisClient = {
            sAdd: async () => {},
            sRem: async () => {},
            sCard: async () => 0,
            sMembers: async () => [],
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
            ioRedisClient: mockRedisClient,
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

const { Server } = require('socket.io');
const { io: ioc } = require('socket.io-client');
const { setupHandlers } = require('../sockets/handlers');
const { setTypingTTL } = require('../sockets/typingState');

function once(emitter, event) {
    return new Promise((resolve) => emitter.once(event, resolve));
}

async function connect(client) {
    await Promise.race([
        once(client, 'connect'),
        new Promise((_, reject) => setTimeout(() => reject(new Error('client connect timeout')), 2000)),
    ]);
}

async function waitFor(cond, timeout = 2000) {
    const start = Date.now();
    while (!cond()) {
        if (Date.now() - start > timeout) throw new Error('waitFor timed out');
        await new Promise((r) => setTimeout(r, 10));
    }
}

// Boot an isolated Socket.IO server whose connections get a fake `socket.user`
// (bypassing auth) and are auto-joined to the given rooms, with the real
// setupHandlers wired up — including the disconnect typing-cleanup listener.
async function bootServer({ rooms = [] } = {}) {
    const httpServer = http.createServer();
    const io = new Server(httpServer);
    io.on('connection', (socket) => {
        socket.user = {
            id: socket.handshake.auth.userId,
            username: socket.handshake.auth.username,
        };
        for (const r of rooms) socket.join(r);
        setupHandlers(io, socket);
    });
    await new Promise((resolve) => httpServer.listen(0, resolve));
    return { io, port: httpServer.address().port };
}

test('typing indicators are cleared when a user disconnects mid-typing', async (t) => {
    t.after(() => { Module._load = originalLoad; });

    // Disable TTL by default — assert cleanup on disconnect/stop only.
    // Each subtest sets the TTL it needs and resets it via t.after so a
    // failure can't leak a short TTL into later subtests.

    await t.test('channel: receiver gets typing:false when sender disconnects', async () => {
        setTypingTTL(60000);
        t.after(() => setTypingTTL(60000));
        const { io, port } = await bootServer({ rooms: ['testroom'] });
        t.after(async () => { await new Promise((r) => io.close(r)); });

        const a = ioc(`http://localhost:${port}`, { auth: { userId: 'userA', username: 'Alice' } });
        const b = ioc(`http://localhost:${port}`, { auth: { userId: 'userB', username: 'Bob' } });
        await Promise.all([connect(a), connect(b)]);
        t.after(() => { a.disconnect(); b.disconnect(); });

        const updates = [];
        b.on('typing:update', (u) => updates.push(u));

        a.emit('typing:start', { roomName: 'testroom' });
        await waitFor(() => updates.some((u) => u.username === 'Alice' && u.typing === true));
        assert.ok(
            updates.some((u) => u.username === 'Alice' && u.typing === true),
            'receiver should see "Alice is typing" after typing:start'
        );

        // Sender closes the tab mid-typing — typing:stop never arrives.
        a.disconnect();
        await waitFor(() => updates.some((u) => u.username === 'Alice' && u.typing === false));
        assert.ok(
            updates.some((u) => u.username === 'Alice' && u.typing === false),
            'receiver should get typing:false after sender disconnects'
        );
    });

    await t.test('channel: typing:stop clears the indicator immediately', async () => {
        setTypingTTL(60000);
        t.after(() => setTypingTTL(60000));
        const { io, port } = await bootServer({ rooms: ['testroom'] });
        t.after(async () => { await new Promise((r) => io.close(r)); });

        const a = ioc(`http://localhost:${port}`, { auth: { userId: 'userC', username: 'Carol' } });
        const b = ioc(`http://localhost:${port}`, { auth: { userId: 'userD', username: 'Dan' } });
        await Promise.all([connect(a), connect(b)]);
        t.after(() => { a.disconnect(); b.disconnect(); });

        const updates = [];
        b.on('typing:update', (u) => updates.push(u));

        a.emit('typing:start', { roomName: 'testroom' });
        await waitFor(() => updates.some((u) => u.username === 'Carol' && u.typing === true));

        a.emit('typing:stop', { roomName: 'testroom' });
        await waitFor(() => updates.some((u) => u.username === 'Carol' && u.typing === false));
        assert.ok(
            updates.some((u) => u.username === 'Carol' && u.typing === false),
            'receiver should get typing:false on typing:stop'
        );
    });

    await t.test('channel: TTL expiry auto-clears the indicator without disconnect', async () => {
        setTypingTTL(150);
        t.after(() => setTypingTTL(60000));
        const { io, port } = await bootServer({ rooms: ['testroom'] });
        t.after(async () => { await new Promise((r) => io.close(r)); });

        const a = ioc(`http://localhost:${port}`, { auth: { userId: 'userE', username: 'Eve' } });
        const b = ioc(`http://localhost:${port}`, { auth: { userId: 'userF', username: 'Frank' } });
        await Promise.all([connect(a), connect(b)]);
        t.after(() => { a.disconnect(); b.disconnect(); });

        const updates = [];
        b.on('typing:update', (u) => updates.push(u));

        a.emit('typing:start', { roomName: 'testroom' });
        await waitFor(() => updates.some((u) => u.username === 'Eve' && u.typing === true));

        // No disconnect, no typing:stop — the server must expire the flag itself.
        await waitFor(() => updates.some((u) => u.username === 'Eve' && u.typing === false));
        assert.ok(
            updates.some((u) => u.username === 'Eve' && u.typing === false),
            'receiver should get typing:false after the TTL expires'
        );
    });

    await t.test('dm: receiver gets dm:typing:false when sender disconnects', async () => {
        setTypingTTL(60000);
        t.after(() => setTypingTTL(60000));
        const { io, port } = await bootServer({ rooms: ['dm:userA_userB'] });
        t.after(async () => { await new Promise((r) => io.close(r)); });

        const a = ioc(`http://localhost:${port}`, { auth: { userId: 'userA', username: 'Alice' } });
        const b = ioc(`http://localhost:${port}`, { auth: { userId: 'userB', username: 'Bob' } });
        await Promise.all([connect(a), connect(b)]);
        t.after(() => { a.disconnect(); b.disconnect(); });

        const updates = [];
        b.on('dm:typing', (u) => updates.push(u));

        a.emit('dm:typing:start', { toUserId: 'userB' });
        await waitFor(() => updates.some((u) => u.username === 'Alice' && u.typing === true));
        assert.ok(
            updates.some((u) => u.username === 'Alice' && u.typing === true),
            'receiver should see DM typing indicator after dm:typing:start'
        );

        a.disconnect();
        await waitFor(() => updates.some((u) => u.username === 'Alice' && u.typing === false));
        assert.ok(
            updates.some((u) => u.username === 'Alice' && u.typing === false),
            'receiver should get dm:typing:false after sender disconnects'
        );
    });

    await t.test('dm: dm:typing:stop clears the indicator immediately', async () => {
        setTypingTTL(60000);
        t.after(() => setTypingTTL(60000));
        const { io, port } = await bootServer({ rooms: ['dm:userC_userD'] });
        t.after(async () => { await new Promise((r) => io.close(r)); });

        const a = ioc(`http://localhost:${port}`, { auth: { userId: 'userC', username: 'Carol' } });
        const b = ioc(`http://localhost:${port}`, { auth: { userId: 'userD', username: 'Dan' } });
        await Promise.all([connect(a), connect(b)]);
        t.after(() => { a.disconnect(); b.disconnect(); });

        const updates = [];
        b.on('dm:typing', (u) => updates.push(u));

        a.emit('dm:typing:start', { toUserId: 'userD' });
        await waitFor(() => updates.some((u) => u.username === 'Carol' && u.typing === true));

        a.emit('dm:typing:stop', { toUserId: 'userD' });
        await waitFor(() => updates.some((u) => u.username === 'Carol' && u.typing === false));
        assert.ok(
            updates.some((u) => u.username === 'Carol' && u.typing === false),
            'receiver should get dm:typing:false on dm:typing:stop'
        );
    });
});
