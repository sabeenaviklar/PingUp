const { redisClient, pubClient, subClient, redisReady } = require('../config/redis');

async function addOnlineUser(userId, socketId) {
    await redisClient.sAdd(`user:sockets:${userId}`, socketId);
    await redisClient.sAdd('users:online', userId);
}

async function removeOnlineUser(userId, socketId) {
    await redisClient.sRem(`user:sockets:${userId}`, socketId);
    const socketCount = await redisClient.sCard(`user:sockets:${userId}`);
    if (socketCount === 0) {
        await redisClient.sRem('users:online', userId);
    }
    return socketCount;
}

async function getOnlineUserIds() {
    return await redisClient.sMembers('users:online');
}

module.exports = {
    redisClient,
    pubClient,
    subClient,
    redisReady,
    addOnlineUser,
    removeOnlineUser,
    getOnlineUserIds
};
