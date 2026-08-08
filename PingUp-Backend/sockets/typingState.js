// sockets/typingState.js
// Server-side per-user typing state with automatic expiry.
//
// typing:start / dm:typing:start events are fire-and-forget: if a user closes
// their tab or drops offline mid-typing, the client's typing:stop never
// arrives and other users would see "X is typing…" forever. This module
// tracks who is typing in which target (channel id, room name, or "dm:<conv>")
// and guarantees a typing:false broadcast either when typing stops, when the
// TTL expires with no heartbeat, or when the user's socket disconnects.
//
// Clients refresh typing:start every ~2s while actively typing (see
// MessageInput.jsx / DMChat.jsx), so the 4s TTL is never hit during normal use
// — it only acts as a safety net for abandonded sessions.

let TYPING_TTL_MS = 4000;

// target (channelId, roomName, or "dm:<convId>") -> Map(userId -> entry)
// entry: { username, timer, emit }
//   emit(username, typing) — broadcasts the typing update for this target.
const typingState = new Map();

function setTypingTTL(ms) {
    TYPING_TTL_MS = ms;
}

// Remove (and clear the timer of) the entry for (target, userId), if any.
function takeEntry(target, userId) {
    const map = typingState.get(target);
    if (!map) return null;
    const entry = map.get(userId);
    if (!entry) return null;
    clearTimeout(entry.timer);
    map.delete(userId);
    if (map.size === 0) typingState.delete(target);
    return entry;
}

// Record that `userId` is typing in `target`. The first call broadcasts
// typing:true to announce the indicator; heartbeat refreshes (the client
// re-emits typing:start every ~2s) silently replace the expiry timer.
function startTyping(target, userId, username, emit) {
    const hadEntry = !!(typingState.get(target)?.get(userId));
    takeEntry(target, userId);
    let map = typingState.get(target);
    if (!map) {
        map = new Map();
        typingState.set(target, map);
    }
    const timer = setTimeout(() => {
        const entry = takeEntry(target, userId);
        // TTL expired with no heartbeat — clear the indicator for everyone.
        if (entry) entry.emit(entry.username, false);
    }, TYPING_TTL_MS);
    map.set(userId, { username, timer, emit });
    if (!hadEntry) emit(username, true);
}

// Stop typing in `target` and broadcast typing:false immediately.
function stopTyping(target, userId) {
    const entry = takeEntry(target, userId);
    if (entry) entry.emit(entry.username, false);
}

// Called when a user's socket disconnects mid-typing. Clears every target the
// user was typing in (channel, room, or DM) and broadcasts typing:false so the
// indicator never sticks for the remaining users.
function clearUserTyping(userId) {
    for (const [target, map] of typingState) {
        const entry = takeEntry(target, userId);
        if (entry) entry.emit(entry.username, false);
    }
}

module.exports = {
    startTyping,
    stopTyping,
    clearUserTyping,
    setTypingTTL,
};
