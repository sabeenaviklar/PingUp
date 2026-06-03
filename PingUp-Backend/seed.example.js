/**
 * seed.example.js
 *
 * Safe template for seeding local development data.
 * Copy this to seed.js and fill in your own values.
 * NEVER commit seed.js — it is in .gitignore.
 *
 * Usage:
 *   1. cp seed.example.js seed.js   (or copy-paste on Windows)
 *   2. Set SEED_ADMIN_PASSWORD etc. in your .env file
 *   3. node seed.js
 */

require('dotenv').config();
const bcrypt = require('bcryptjs');
const mongoose = require('mongoose');
const { v4: uuidv4 } = require('uuid');

// Load passwords from environment — never hardcode these
const ADMIN_PASSWORD  = process.env.SEED_ADMIN_PASSWORD;
const MOD_PASSWORD    = process.env.SEED_MOD_PASSWORD;
const MEMBER_PASSWORD = process.env.SEED_MEMBER_PASSWORD;

if (!ADMIN_PASSWORD || !MOD_PASSWORD || !MEMBER_PASSWORD) {
  console.error(
    'Missing seed passwords. Set SEED_ADMIN_PASSWORD, SEED_MOD_PASSWORD, ' +
    'and SEED_MEMBER_PASSWORD in your .env file.'
  );
  process.exit(1);
}
if (!process.env.MONGO_URI) {
  console.error('Missing MONGO_URI. Set it in PingUp-Backend/.env before running seed.js.');
  process.exit(1);
}

async function seed() {
  await mongoose.connect(process.env.MONGO_URI);
  console.log('Connected to MongoDB');

  // Example: insert seed users
  const users = [
    {
      id: uuidv4(),
      username: 'superadmin',
      password: await bcrypt.hash(ADMIN_PASSWORD, 10),
      role: 'owner',
    },
    {
      id: uuidv4(),
      username: 'moduser',
      password: await bcrypt.hash(MOD_PASSWORD, 10),
      role: 'moderator',
    },
    {
      id: uuidv4(),
      username: 'alice',
      password: await bcrypt.hash(MEMBER_PASSWORD, 10),
      role: 'member',
    },
  ];

  // TODO: replace with your actual User model insert
  console.log('Seed users generated (not inserted — wire up your User model here)');
  console.log(users.map(u => ({ username: u.username, role: u.role })));

  await mongoose.disconnect();
  console.log('Done.');
}

seed().catch(err => {
  console.error('Seed failed:', err);
  process.exit(1);
});