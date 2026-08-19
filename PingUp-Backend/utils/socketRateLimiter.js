const { RateLimiterMemory } = require('rate-limiter-flexible');

const limiters = {
    'message:send': new RateLimiterMemory({
        points: 10,
        duration: 1,
    }),

    'dm:send': new RateLimiterMemory({
        points: 10,
        duration: 1,
    }),

    // Room typing events
    'typing:start': new RateLimiterMemory({
        points: 20,
        duration: 1,
    }),

    'typing:stop': new RateLimiterMemory({
        points: 20,
        duration: 1,
    }),

    // DM typing events
    'dm:typing:start': new RateLimiterMemory({
        points: 30,
        duration: 1,
    }),

    'dm:typing:stop': new RateLimiterMemory({
        points: 30,
        duration: 1,
    }),

    'message:reaction': new RateLimiterMemory({
        points: 20,
        duration: 1,
    }),

    default: new RateLimiterMemory({
        points: 20,
        duration: 1,
    }),
};

async function checkSocketRateLimit(userId, eventName) {
    const limiter = limiters[eventName] || limiters.default;

    try {
        await limiter.consume(`${userId}:${eventName}`);
        return true;
    } catch (err) {
        return false;
    }
}

module.exports = {
    checkSocketRateLimit,
};
