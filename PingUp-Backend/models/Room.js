const mongoose = require('mongoose');

const RoomSchema = new mongoose.Schema({
  name:           { type: String, required: true, unique: true, trim: true },
  description:    { type: String, default: '' },
  emoji:          { type: String, default: '💬' },
  category:       { type: String, default: 'general' },
  order:          { type: Number, default: 0 },
  createdBy:      { type: String, default: 'system' },

  // ── Access control ──────────────────────────────────────────────
  isPrivate:      { type: Boolean, default: false },   // hidden from members
  isReadOnly:     { type: Boolean, default: false },   // members can't send
  isLocked:       { type: Boolean, default: false },   // nobody can send
  
  
  slowModeSeconds: {
    type: Number,
    default: 0
  },

  // Users explicitly allowed in private rooms
  allowedUsers:   [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],

  // Pinned message IDs
  pinnedMessages: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Message' }],
}, { timestamps: true });

module.exports = mongoose.model('Room', RoomSchema);
