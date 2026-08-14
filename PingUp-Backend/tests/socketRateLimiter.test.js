process.env.NODE_ENV = 'test';

const assert = require('node:assert/strict');
const test = require('node:test');

const {
    checkSocketRateLimit,
} = require('../utils/socketRateLimiter');

test('Socket Rate Limiting', async (t) => {

    // TEST 1
    await t.test(
        'message:send allows 10 requests and rejects the 11th',
        async () => {

            const userId = `test-user-${Date.now()}`;

            // First 10 requests should be allowed
            for (let i = 0; i < 10; i++) {
                const allowed = await checkSocketRateLimit(
                    userId,
                    'message:send'
                );

                assert.equal(
                    allowed,
                    true,
                    `Request ${i + 1} should be allowed`
                );
            }

            // 11th request should be rejected
            const allowed = await checkSocketRateLimit(
                userId,
                'message:send'
            );

            assert.equal(
                allowed,
                false,
                '11th request should be rate limited'
            );
        }
    );


    // TEST 2 - PER USER
    await t.test(
        'rate limit is isolated per user',
        async () => {

            const userA = `user-a-${Date.now()}`;
            const userB = `user-b-${Date.now()}`;

            // Exhaust User A's message:send limit
            for (let i = 0; i < 10; i++) {
                const allowed = await checkSocketRateLimit(
                    userA,
                    'message:send'
                );

                assert.equal(allowed, true);
            }

            // User A should now be blocked
            const userALimited = await checkSocketRateLimit(
                userA,
                'message:send'
            );

            assert.equal(
                userALimited,
                false,
                'User A should be rate limited'
            );

            // User B should have a completely fresh bucket
            const userBAllowed = await checkSocketRateLimit(
                userB,
                'message:send'
            );

            assert.equal(
                userBAllowed,
                true,
                'User B should not be affected by User A'
            );
        }
    );


    // TEST 3 - PER EVENT
    await t.test(
        'rate limit is isolated per event',
        async () => {

            const userId = `event-test-user-${Date.now()}`;

            // Exhaust message:send
            for (let i = 0; i < 10; i++) {
                const allowed = await checkSocketRateLimit(
                    userId,
                    'message:send'
                );

                assert.equal(allowed, true);
            }

            // message:send should now be blocked
            const messageBlocked = await checkSocketRateLimit(
                userId,
                'message:send'
            );

            assert.equal(
                messageBlocked,
                false,
                'message:send should be rate limited'
            );

            // dm:send has its own bucket
            const dmAllowed = await checkSocketRateLimit(
                userId,
                'dm:send'
            );

            assert.equal(
                dmAllowed,
                true,
                'dm:send should have an independent rate-limit bucket'
            );
        }
    );


    // TEST 4 - DM TYPING
    await t.test(
        'dm typing events are rate limited independently',
        async () => {

            const userId = `dm-typing-user-${Date.now()}`;

            // First 30 typing:start requests should be allowed
            for (let i = 0; i < 30; i++) {
                const allowed = await checkSocketRateLimit(
                    userId,
                    'dm:typing:start'
                );

                assert.equal(
                    allowed,
                    true,
                    `Typing request ${i + 1} should be allowed`
                );
            }

            // 31st should be blocked
            const blocked = await checkSocketRateLimit(
                userId,
                'dm:typing:start'
            );

            assert.equal(
                blocked,
                false,
                '31st typing:start request should be rate limited'
            );

            // typing:stop has its own independent bucket
            const stopAllowed = await checkSocketRateLimit(
                userId,
                'dm:typing:stop'
            );

            assert.equal(
                stopAllowed,
                true,
                'typing:stop should have an independent rate-limit bucket'
            );
        }
    );


    // TEST 5 - ROOM TYPING
    await t.test(
        'room typing events are rate limited independently',
        async () => {

            const userId = `room-typing-user-${Date.now()}`;

            // First 20 typing:start requests should be allowed
            for (let i = 0; i < 20; i++) {
                const allowed = await checkSocketRateLimit(
                    userId,
                    'typing:start'
                );

                assert.equal(
                    allowed,
                    true,
                    `Typing request ${i + 1} should be allowed`
                );
            }

            // 21st should be blocked
            const blocked = await checkSocketRateLimit(
                userId,
                'typing:start'
            );

            assert.equal(
                blocked,
                false,
                '21st typing:start request should be rate limited'
            );

            // typing:stop has its own independent bucket
            const stopAllowed = await checkSocketRateLimit(
                userId,
                'typing:stop'
            );

            assert.equal(
                stopAllowed,
                true,
                'typing:stop should have an independent rate-limit bucket'
            );
        }
    );

});