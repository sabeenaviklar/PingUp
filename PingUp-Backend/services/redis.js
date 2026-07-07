const { redisClient, pubClient, subClient, redisReady } = require('../config/redis');

async function setUserPresence(userId, presence) {
    await redisClient.hSet('users:presence', userId, JSON.stringify({ ...presence, lastActive: Date.now() }));
}

async function getUserPresence(userId) {
    const data = await redisClient.hGet('users:presence', userId);
    return data ? JSON.parse(data) : null;
}

async function getAllPresence() {
    const all = await redisClient.hGetAll('users:presence');
    const result = {};
    for (const [userId, data] of Object.entries(all)) {
        result[userId] = JSON.parse(data);
    }
    return result;
}

async function addOnlineUser(userId, socketId) {
    await redisClient.sAdd(`user:sockets:${userId}`, socketId);
}

async function removeOnlineUser(userId, socketId) {
    await redisClient.sRem(`user:sockets:${userId}`, socketId);
    const socketCount = await redisClient.sCard(`user:sockets:${userId}`);
    if (socketCount === 0) {
        await redisClient.hDel('users:presence', userId);
    }
    return socketCount;
}

async function getOnlineUserIds() {
    return await redisClient.hKeys('users:presence');
}

module.exports = {
    redisClient,
    pubClient,
    subClient,
    redisReady,
    addOnlineUser,
    removeOnlineUser,
    getOnlineUserIds,
    setUserPresence,
    getUserPresence,
    getAllPresence
};
