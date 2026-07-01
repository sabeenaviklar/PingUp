const { ROLES, hasPermission } = require('../data/store');
const User = require('../models/User');
const Room = require('../models/Room');
const Message = require('../models/Message');
const { broadcastStructure, broadcastUserList, rollRole, evictUnauthorizedSockets } = require('../utils/helpers');

async function processCommand(io, socket, roomName, text) {
    const [cmd, ...args] = text.slice(1).split(' ');

    const isOwner = hasPermission(socket.user.role, ROLES.ADMIN);
    const isMod = hasPermission(socket.user.role, ROLES.MODERATOR);
    console.log(`[DEBUG] User Role: ${socket.user.role} | isOwner: ${isOwner}`);
    const ok = msg => socket.emit('command:response', { type: 'success', text: `✅ ${msg}` });
    const err = msg => socket.emit('command:response', { type: 'error', text: `❌ ${msg}` });
    const info = msg => socket.emit('command:response', { type: 'help', text: msg });
    const perm = msg => socket.emit('error:permission', msg);

    switch (cmd.toLowerCase()) {

        case 'help':
            info([
                '── General ──',
                '/help                            show this list',
                '/online                          list online users',
                '/whoami                          your info',
                '/rooms                           list all channels',
                '',
                '── Moderation (mod+) ──',
                '/delete <msgId>                  delete a message',
                '/pin <msgId>                     pin a message',
                '/kick <user>                     kick a user',
                '',
                '── Admin Only (admin) ──',
                '/newchannel <cat> <name> [emoji]  create channel',
                '/delchannel <name>               delete channel',
                '/renamechannel <old> <new>       rename channel',
                '/newcategory <name>              create category',
                '/readonly <channel>              toggle read-only',
                '/lock <channel>                  toggle locked',
                '/private <channel>              toggle private',
                '/adduser <channel> <user>        allow user to private room',
                '/removeuser <channel> <user>     remove user from private room',
                '/promote <user> <role>           set role (member/moderator)',
                '/ban <user>                      ban user',
                '/reroll <user>                   re-roll role randomly',
                '/clear                           wipe room messages',
                '/stats                           server stats',
            ].join('\n'));
            break;

        case 'online': {
            const users = await User.find({ online: true });
            info(users.map(u => `${u.username} [${u.role}]`).join('\n') || 'No users online');
            break;
        }

        case 'whoami': {
            const user = await User.findById(socket.user.id);
            info(`Username: ${user.username}\nRole: ${user.role}\nLogins: ${user.loginCount}\nJoined: ${user.createdAt.toDateString()}`);
            break;
        }

        case 'rooms': {
            const rooms = await Room.find().sort({ category: 1, name: 1 });
            info(rooms.map(r =>
                `${r.emoji} #${r.name} [${r.category}]${r.isReadOnly ? ' 🔇' : ''}${r.isLocked ? ' 🔒' : ''}${r.isPrivate ? ' 👁️' : ''}${r.isVoice ? ' 🎵' : ''}`
            ).join('\n'));
            break;
        }

        case 'stats': {
            if (!isOwner) return perm('Only the admin can view stats.');
            const [uc, mc, rc, oc] = await Promise.all([
                User.countDocuments(),
                Message.countDocuments({ deleted: false }),
                Room.countDocuments(),
                User.countDocuments({ online: true }),
            ]);
            info(`📊 Server Stats\nUsers: ${uc} (${oc} online)\nChannels: ${rc}\nMessages: ${mc}`);
            break;
        }

        case 'delete': {
            if (!isMod) return perm('Moderators only.');
            const msg = await Message.findByIdAndUpdate(
                args[0], { deleted: true, text: '[message deleted]' }, { new: true }
            );
            if (!msg) return err('Message not found.');
            io.to(roomName).emit('message:deleted', { id: args[0] });
            ok('Message deleted.');
            break;
        }

        case 'pin': {
            if (!isMod) return perm('Moderators only.');
            const msg = await Message.findById(args[0]);
            if (!msg) return err('Message not found.');
            const room = await Room.findOne({ name: roomName });
            if (!room) return err('Room not found.');
            const already = room.pinnedMessages.some(id => id.toString() === args[0]);
            if (already) {
                room.pinnedMessages = room.pinnedMessages.filter(id => id.toString() !== args[0]);
                await room.save();
                io.to(roomName).emit('message:unpinned', { id: args[0] });
                ok('Message unpinned.');
            } else {
                room.pinnedMessages.push(args[0]);
                await room.save();
                io.to(roomName).emit('message:pinned', {
                    id: args[0], text: msg.text, pinnedBy: socket.user.username,
                });
                ok('Message pinned.');
            }
            break;
        }

        case 'kick': {
            if (!isMod) return perm('Moderators only.');
            const target = await User.findOne({ username: args[0], online: true });
            if (!target) return err('User not found or offline.');
            if (target.role === ROLES.ADMIN) return err('Cannot kick the admin.');
            if (socket.user.role === ROLES.MODERATOR && target.role !== ROLES.MEMBER)
                return err('Moderators can only kick members.');
            const ts = [...io.sockets.sockets.values()].find(s => s.user?.id === target._id.toString());
            if (ts) { ts.emit('kicked', { by: socket.user.username }); ts.disconnect(true); }
            ok(`${args[0]} kicked.`);
            io.emit('room:notification', { text: `👢 ${args[0]} was kicked`, type: 'system' });
            break;
        }

        case 'newchannel': {
            if (!isOwner) return perm('Admin only.');
            const [catName, chName, emoji] = args;
            if (!catName || !chName) return err('Usage: /newchannel <category> <name> [emoji]');
            const exists = await Room.findOne({ name: chName.toLowerCase() });
            if (exists) return err(`#${chName} already exists.`);
            const room = await Room.create({
                name: chName.toLowerCase().replace(/\s+/g, '-'),
                description: `Created by ${socket.user.username}`,
                emoji: emoji || '💬',
                category: catName,
                createdBy: socket.user.username,
            });
            await broadcastStructure(io);
            ok(`Channel #${room.name} created in [${catName}].`);
            io.emit('room:notification', { text: `# ${room.name} created`, type: 'system' });
            break;
        }

        case 'delchannel': {
            if (!isOwner) return perm('Admin only.');
            const room = await Room.findOneAndDelete({ name: args[0]?.toLowerCase() });
            if (!room) return err(`#${args[0]} not found.`);
            await Message.deleteMany({ roomName: args[0] });
            await broadcastStructure(io);
            ok(`#${args[0]} deleted.`);
            break;
        }

        case 'renamechannel': {
            if (!isOwner) return perm('Admin only.');
            const [oldName, newName] = args;
            if (!oldName || !newName) return err('Usage: /renamechannel <old> <new>');
            const formattedNewName = newName.toLowerCase().replace(/\s+/g, '-');
            const room = await Room.findOneAndUpdate(
                { name: oldName.toLowerCase() },
                { name: formattedNewName },
                { new: true }
            );
            if (!room) return err(`#${oldName} not found.`);
            await Message.updateMany({ roomName: oldName.toLowerCase() }, { roomName: formattedNewName });
            await broadcastStructure(io);
            ok(`#${oldName} → #${newName}.`);
            break;
        }

        case 'newcategory': {
            if (!isOwner) return perm('Admin only.');
            const catName = args.join(' ');
            if (!catName) return err('Usage: /newcategory <name>');
            await Room.create({
                name: `${catName.toLowerCase().replace(/\s+/g, '-')}-general`,
                description: `Default channel`,
                emoji: '💬',
                category: catName,
                createdBy: socket.user.username,
            });
            await broadcastStructure(io);
            ok(`Category "${catName}" created.`);
            break;
        }

        case 'readonly': {
            if (!isOwner) return perm('Admin only.');
            const room = await Room.findOne({ name: args[0]?.toLowerCase() });
            if (!room) return err(`#${args[0]} not found.`);
            room.isReadOnly = !room.isReadOnly;
            await room.save();
            await broadcastStructure(io);
            const { roomToChannel } = require('../utils/helpers');
            io.to(room.name).emit('room:settings', roomToChannel(room));
            ok(`#${room.name} is now ${room.isReadOnly ? 'read-only 🔇' : 'writable ✍️'}.`);
            break;
        }

        case 'lock': {
            if (!isOwner) return perm('Admin only.');
            const room = await Room.findOne({ name: args[0]?.toLowerCase() });
            if (!room) return err(`#${args[0]} not found.`);
            room.isLocked = !room.isLocked;
            await room.save();
            await broadcastStructure(io);
            const { roomToChannel } = require('../utils/helpers');
            io.to(room.name).emit('room:settings', roomToChannel(room));
            ok(`#${room.name} is now ${room.isLocked ? 'locked 🔒' : 'unlocked 🔓'}.`);
            break;
        }

        case 'private': {
            if (!isOwner) return perm('Admin only.');
            const room = await Room.findOne({ name: args[0]?.toLowerCase() });
            if (!room) return err(`#${args[0]} not found.`);
            room.isPrivate = !room.isPrivate;
            await room.save();
            await evictUnauthorizedSockets(io, room);
            await broadcastStructure(io);
            ok(`#${room.name} is now ${room.isPrivate ? 'private 👁️' : 'public 🌐'}.`);
            break;
        }

        case 'adduser': {
            if (!isOwner) return perm('Admin only.');
            const [chName, uname] = args;
            const room = await Room.findOne({ name: chName?.toLowerCase() });
            const target = await User.findOne({ username: uname });
            if (!room) return err(`#${chName} not found.`);
            if (!target) return err(`User "${uname}" not found.`);
            if (!room.allowedUsers.includes(target._id)) {
                room.allowedUsers.push(target._id);
                await room.save();
            }
            await broadcastStructure(io);
            ok(`${uname} added to #${chName}.`);
            break;
        }

        case 'removeuser': {
            if (!isOwner) return perm('Admin only.');
            const [chName, uname] = args;
            const room = await Room.findOne({ name: chName?.toLowerCase() });
            const target = await User.findOne({ username: uname });
            if (!room) return err(`#${chName} not found.`);
            if (!target) return err(`User "${uname}" not found.`);
            room.allowedUsers = room.allowedUsers.filter(id => id.toString() !== target._id.toString());
            await room.save();
            await broadcastStructure(io);
            ok(`${uname} removed from #${chName}.`);
            break;
        }

        case 'promote': {
            if (!isOwner) return perm('Admin only.');
            const [targetName, newRole] = args;
            if (![ROLES.MODERATOR, ROLES.MEMBER].includes(newRole))
                return err('Role must be: moderator or member');
            const targetUser = await User.findOne({ username: targetName });
            if (!targetUser) return err('User not found.');
            if (targetUser.role === ROLES.ADMIN)
                return err('Cannot change the admin role.');
            await User.updateOne({ _id: targetUser._id }, { role: newRole });
            const ls = [...io.sockets.sockets.values()].find(s => s.user?.id === targetUser._id.toString());
            if (ls) { ls.user.role = newRole; ls.emit('role:updated', { role: newRole }); }
            await broadcastUserList(io);
            ok(`${targetName} is now ${newRole}.`);
            io.emit('room:notification', { text: `🔰 ${targetName} → ${newRole}`, type: 'system' });
            break;
        }

        case 'ban': {
            if (!isOwner) return perm('Admin only.');
            const target = await User.findOne({ username: args[0] });
            if (!target) return err('User not found.');
            if (target.role === ROLES.ADMIN) return err('Cannot ban the admin.');
            target.banned = true;
            await target.save();
            const ts = [...io.sockets.sockets.values()].find(s => s.user?.id === target._id.toString());
            if (ts) { ts.emit('kicked', { by: `${socket.user.username} (banned)` }); ts.disconnect(true); }
            ok(`${args[0]} banned.`);
            io.emit('room:notification', { text: `🔨 ${args[0]} was banned`, type: 'system' });
            break;
        }

        case 'reroll': {
            if (!isOwner) return perm('Admin only.');
            const target = await User.findOne({ username: args[0] });
            if (!target) return err('User not found.');
            if (target.role === ROLES.ADMIN) return err('Cannot reroll the admin.');
            const newRole = rollRole();
            target.role = newRole;
            await target.save();
            const ls = [...io.sockets.sockets.values()].find(s => s.user?.id === target._id.toString());
            if (ls) { ls.user.role = newRole; ls.emit('role:updated', { role: newRole }); }
            await broadcastUserList(io);
            ok(`🎲 ${args[0]} rerolled → ${newRole.toUpperCase()}`);
            io.emit('room:notification', { text: `🎲 ${args[0]}'s role rerolled to ${newRole}`, type: 'system' });
            break;
        }

        case 'clear': {
            if (!isOwner) return perm('Admin only.');
            await Message.updateMany({ roomName }, { deleted: true, text: '[message deleted]' });
            io.to(roomName).emit('room:cleared');
            ok(`#${roomName} cleared.`);
            break;
        }

        default:
            err(`Unknown command: /${cmd}. Type /help`);
    }
}

module.exports = {
    processCommand
};
