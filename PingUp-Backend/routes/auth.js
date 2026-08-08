const express = require('express');
const router = express.Router();
const rateLimit = require('express-rate-limit');
const User = require('../models/User');
const { generateToken, generateRefreshToken, verifyRefreshToken, requireAuth } = require('../middleware/auth');
const { ROLES } = require('../data/store');
const ServerSettings = require('../models/ServerSettings');

// Rate limiter for authentication routes: limits each IP to 15 login/register attempts per 15 minutes
const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 15,
    message: { error: 'Too many authentication attempts from this IP, please try again after 15 minutes.' },
    standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
    legacyHeaders: false, // Disable the `X-RateLimit-*` headers
});

router.post('/register', authLimiter, async (req, res) => {
    try {
        const { username, password, email, displayName } = req.body;
        if (!username?.trim() || !password)
            return res.status(400).json({ error: 'Username and password required.' });

        const exists = await User.findOne({ username: username.trim().toLowerCase() });
        if (exists) return res.status(409).json({ error: 'Username already taken.' });

        let user = await User.create({
            username: username.trim().toLowerCase(),
            password,
            role: ROLES.MEMBER,
            isFirst: false,
            displayName: displayName?.trim() || username.trim(),
            email: email?.trim() || '',
        });

        const adminLock = await ServerSettings.findOneAndUpdate(
            { key: 'admin_initialized' },
            { $setOnInsert: { key: 'admin_initialized', value: user._id.toString() } },
            { upsert: true, new: true }
        );

        if (adminLock.value === user._id.toString()) {
            user.role = ROLES.ADMIN;
            user.isFirst = true;
            await user.save();
        }

        const isFirst = user.isFirst;

        const accessToken = generateToken(user);
        const refreshToken = generateRefreshToken(user);

        user.refreshToken = refreshToken;

        await user.save();

        res.cookie('token', accessToken, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
            maxAge: 8 * 60 * 60 * 1000 // 8 hours
        });

        res.status(201).json({
            accessToken,
            refreshToken,
            user: user.toPrivateProfile(),
            roleMessage: isFirst
                  ? '👑 You are the ADMIN — full system control granted.'
                  : '👋 Welcome! You joined as a member.',
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Server error.' });
    }
});

router.post('/login', authLimiter, async (req, res) => {
    try {
        const { username, password } = req.body;
        const user = await User.findOne({ username: username?.trim().toLowerCase() });
        if (!user || !(await user.comparePassword(password)))
            return res.status(401).json({ error: 'Invalid credentials.' });
        if (user.banned)
            return res.status(403).json({ error: 'You have been banned.' });

        user.loginCount += 1;

        const accessToken = generateToken(user);
        const refreshToken = generateRefreshToken(user);
        user.refreshToken = refreshToken;

        await user.save();

        res.cookie('token', accessToken, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
            maxAge: 8 * 60 * 60 * 1000 // 8 hours
        });

        res.json({
            accessToken,
            refreshToken,
            user: user.toPrivateProfile()
        });
    } catch (err) {
        res.status(500).json({ error: 'Server error.' });
    }
});

router.get('/me', requireAuth, async (req, res) => {
    try {
        const user = await User.findById(req.user.id);
        if (!user) return res.status(404).json({ error: 'User not found.' });
        res.json({ user: user.toPrivateProfile() });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Server error.' });
    }
});

router.post('/refresh', async (req, res) => {
    const refreshToken =
        req.body && typeof req.body === 'object' ? req.body.refreshToken : undefined;

    if (!refreshToken || typeof refreshToken !== 'string') {
        return res.status(400).json({
            error: 'Invalid refresh token format.'
        });
    }

    const decoded = verifyRefreshToken(refreshToken);
    if (!decoded) {
        return res.status(403).json({
            error: 'Invalid or expired refresh token'
        });
    }

    try {
        const user = await User.findById(decoded.id);

        if (!user || user.refreshToken !== refreshToken) {
            return res.status(403).json({
                error: 'Invalid refresh token'
            });
        }
        if (user.banned) {
            return res.status(403).json({
                error: 'You have been banned.'
            });
        }

        const accessToken = generateToken(user);
        res.json({ accessToken });

    } catch (err) {
        res.status(500).json({
            error: 'Server error.'
        });
    }
});

router.post('/logout', async (req, res) => {
    try {
        const refreshToken =
            req.body && typeof req.body === 'object' ? req.body.refreshToken : undefined;
        
        if (!refreshToken || typeof refreshToken !== 'string') {
            return res.status(400).json({
                error: 'Invalid refresh token format.'
            });
        }

        const user = await User.findOne({ refreshToken });

        if (user) {
            user.refreshToken = null;
            await user.save();
        }

        res.clearCookie('token', {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
        });

        res.json({
            message: 'Logged out successfully'
        });

    } catch (err) {
        res.status(500).json({
            error: 'Server error.'
        });
    }
});

module.exports = router;
