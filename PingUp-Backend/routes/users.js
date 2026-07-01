const express = require('express');
const router = express.Router();
const User = require('../models/User');
const { ROLES, hasPermission } = require('../data/store');
const { authHeader } = require('../utils/helpers');

router.get('/', async (req, res) => {
    const decoded = authHeader(req, res);
    if (!decoded) return;
    const me = await User.findById(decoded.id);

    if (!hasPermission(me.role, ROLES.MODERATOR))
        return res.status(403).json({ error: 'Forbidden' });

    const users = await User.find();
    res.json(users.map(u => ({
        id: u._id.toString(),
        username: u.username,
        role: u.role,
        displayName: u.displayName,
        online: u.online,
        banned: u.banned || false,
        createdAt: u.createdAt,
        loginCount: u.loginCount,
    })));
});

router.put('/profile', async (req, res) => {
    try {
        const decoded = authHeader(req, res);
        if (!decoded) return;
        const updates = {
            ...(req.body.username !== undefined ? { username: req.body.username.trim().toLowerCase() } : {}),
            ...(req.body.displayName !== undefined ? { displayName: req.body.displayName.trim() } : {}),
            ...(req.body.email !== undefined ? { email: req.body.email.trim() } : {}),
            ...(req.body.phone !== undefined ? { phone: req.body.phone.trim() } : {}),
        };
        const user = await User.findByIdAndUpdate(decoded.id, updates, {
          new: true,
          runValidators: true
        });
        if (!user) return res.status(404).json({ error: 'User not found.' });
        res.json({ user: user.toPrivateProfile() });
    }catch (err) {
        if (err?.code === 11000 && err?.keyPattern?.username) {
           return res.status(409).json({ error: 'Username already taken.' });
        }
        console.error(err);
        return res.status(500).json({ error: 'Server error.' });
    }
});

module.exports = router;
