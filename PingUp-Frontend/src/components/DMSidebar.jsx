import { useState } from "react";
import LogoutModal from './LogoutModal';
import ProfileMenu from './ProfileMenu';
import ChannelCategory from './ChannelCategory';

const STATUS_COLORS = {
  online:  '#23a55a',
  idle:    '#f0b232',
  dnd:     '#ed4245',
  offline: '#80848e',
};

function StatusDot({ status }) {
  return (
    <span
      className="dm-status-dot"
      style={{ background: STATUS_COLORS[status] || STATUS_COLORS.offline }}
    />
  );
}

export default function DMSidebar({
  currentUser,
  activeRoom,
  activeChannel,
  rooms,
  categories,
  socket,
  onRoomSelect,
  onChannelSelect,
  onLogout,
  onOpenProfile,
  onShowFriends,
  onOpenAdmin,       // ← new prop
  allowUserChannelCreation,
}) {
  const [search,          setSearch]          = useState('');
  const [muted,           setMuted]           = useState(false);
  const [deafened,        setDeafened]        = useState(false);
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const [collapsed,       setCollapsed]       = useState({});
  const [hoveredChannel,  setHoveredChannel]  = useState(null);
  const [showNewCategory, setShowNewCategory] = useState(false);
  const [showNewChannel,  setShowNewChannel]  = useState(null);
  const [catName,         setCatName]         = useState('');
  const [chForm,          setChForm]          = useState({ name: '', description: '', emoji: '💬' });
  const [showLogoutModal, setShowLogoutModal] = useState(false);

  const isOwner = currentUser?.role === 'owner';
  const canCreateChannel = isOwner || !!allowUserChannelCreation;

  // ── Derive display list ─────────────────────────────────────────
  const displayCategories = (() => {
    if (categories?.length) {
      return categories.map(cat => ({
        ...cat,
        channels: cat.channels.filter(ch =>
          !search || ch.name.toLowerCase().includes(search.toLowerCase())
        ),
      }));
    }
    const filtered = (rooms || []).filter(r =>
      !search || r.name.toLowerCase().includes(search.toLowerCase())
    );
    return filtered.length
      ? [{ id: 'cat-legacy', name: '✦ channels', channels: filtered }]
      : [];
  })();

  function handleChannelClick(ch) {
    if (onChannelSelect) onChannelSelect(ch);
    else if (onRoomSelect) onRoomSelect(ch);
  }

  function isChannelActive(ch) {
    if (activeChannel) return activeChannel.id === ch.id;
    if (activeRoom)    return activeRoom.name === ch.name;
    return false;
  }

  const toggleCollapse = (catId) =>
    setCollapsed(prev => ({ ...prev, [catId]: !prev[catId] }));

  function handleCreateCategory(e) {
    e.preventDefault();
    if (!catName.trim()) return;
    socket?.emit('category:create', { name: catName.trim() });
    setCatName('');
    setShowNewCategory(false);
  }

  function handleCreateChannel(e, categoryId) {
    e.preventDefault();
    if (!chForm.name.trim()) return;
    socket?.emit('channel:create', {
      categoryId,
      name:        chForm.name.trim(),
      description: chForm.description.trim(),
      emoji:       chForm.emoji,
    });
    setChForm({ name: '', description: '', emoji: '💬' });
    setShowNewChannel(null);
  }

  function handleDeleteChannel(e, channelId) {
    e.stopPropagation();
    if (!confirm('Delete this channel and all its messages?')) return;
    socket?.emit('channel:delete', { channelId });
  }

  function handleDeleteCategory(e, categoryId) {
    e.stopPropagation();
    if (!confirm('Delete this entire category and all its channels?')) return;
    socket?.emit('category:delete', { categoryId });
  }

  // ── Channel status badge ────────────────────────────────────────

  return (
    <div className="dm-sidebar">

      {/* ── Top search ── */}
      <div className="dm-search-bar">
        <span className="dm-search-icon">🔍</span>
        <input
          className="dm-search-input"
          placeholder="Search channels…"
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
      </div>

      {/* ── Nav items ── */}
      <nav className="dm-nav">
        <div
          className="dm-nav-item"
          onClick={() => { setShowProfileMenu(false); onShowFriends?.(); }}
        >
          <span className="dm-nav-icon">👥</span>
          Friends &amp; Online
        </div>
        <div
          className="dm-nav-item"
          onClick={() => { setShowProfileMenu(false); onShowFriends?.(); }}
        >
          <span className="dm-nav-icon">✉️</span>
          Direct Messages
        </div>

        {/* Admin Panel shortcut — owner only */}
        {isOwner && onOpenAdmin && (
          <button
            className="dms-admin-btn"
            onClick={() => { setShowProfileMenu(false); onOpenAdmin(); }}
          >
            <span>👑</span>
            Admin Panel
          </button>
        )}
      </nav>

      <div className="dm-sidebar-divider" />

      {/* ── Categories + Channels ── */}
      <div className="dm-channels-scroll">

        {displayCategories.map(cat => (
          <ChannelCategory
            key={cat.id}
            cat={cat}
            collapsed={collapsed}
            toggleCollapse={toggleCollapse}
            canCreateChannel={canCreateChannel}
            showNewChannel={showNewChannel}
            setShowNewChannel={setShowNewChannel}
            handleDeleteCategory={handleDeleteCategory}
            chForm={chForm}
            setChForm={setChForm}
            handleCreateChannel={handleCreateChannel}
            isChannelActive={isChannelActive}
            handleChannelClick={handleChannelClick}
            hoveredChannel={hoveredChannel}
            setHoveredChannel={setHoveredChannel}
            isOwner={isOwner}
            socket={socket}
            handleDeleteChannel={handleDeleteChannel}
          />
        ))}

        {/* New Category — owner only */}
        {isOwner && (
          <div className="dm-add-category-wrap">
            {showNewCategory ? (
              <form className="dm-new-cat-form" onSubmit={handleCreateCategory}>
                <input
                  placeholder="Category name"
                  value={catName}
                  onChange={e => setCatName(e.target.value)}
                  autoFocus
                />
                <div className="dm-new-ch-row">
                  <button type="submit" className="dm-new-ch-create">Create</button>
                  <button
                    type="button"
                    className="dm-new-ch-cancel"
                    onClick={() => setShowNewCategory(false)}
                  >Cancel</button>
                </div>
              </form>
            ) : (
              <button
                className="dm-add-cat-btn"
                onClick={() => setShowNewCategory(true)}
              >
                ＋ New Category
              </button>
            )}
          </div>
        )}
      </div>

      {/* ── Bottom User Bar ── */}
      <div className="dm-user-bar">
        <div
          className="dm-user-info"
          onClick={() => setShowProfileMenu(v => !v)}
          title="View Profile"
        >
          <div className={`dm-user-avatar avatar-${currentUser.role}`}>
            {currentUser.username[0].toUpperCase()}
            <StatusDot status="online" />
          </div>
          <div className="dm-user-text">
            <span className="dm-user-name">{currentUser.username}</span>
            <span className={`dm-user-role role-${currentUser.role}`}>
              {currentUser.role}
            </span>
          </div>
        </div>

        <div className="dm-user-actions">
          <button
            className={`dm-action-btn ${muted ? 'active-danger' : ''}`}
            title={muted ? 'Unmute' : 'Mute'}
            onClick={() => setMuted(v => !v)}
          >{muted ? '🔇' : '🎙️'}</button>
          <button
            className={`dm-action-btn ${deafened ? 'active-danger' : ''}`}
            title={deafened ? 'Undeafen' : 'Deafen'}
            onClick={() => setDeafened(v => !v)}
          >{deafened ? '🔕' : '🎧'}</button>
          <button
            className="dm-action-btn"
            title="Settings"
            onClick={() => setShowProfileMenu(v => !v)}
          >⚙️</button>
        </div>

        <ProfileMenu
          socket={socket}
          showProfileMenu={showProfileMenu}
          currentUser={currentUser}
          onOpenProfile={onOpenProfile}
          setShowProfileMenu={setShowProfileMenu}
          muted={muted}
          setMuted={setMuted}
          deafened={deafened}
          setDeafened={setDeafened}
          isOwner={isOwner}
          onOpenAdmin={onOpenAdmin}
          setShowNewCategory={setShowNewCategory}
          setShowLogoutModal={setShowLogoutModal}
        />

        <LogoutModal
          showLogoutModal={showLogoutModal}
          setShowLogoutModal={setShowLogoutModal}
          setShowProfileMenu={setShowProfileMenu}
          onLogout={onLogout}
        />
      </div>
    </div>
  );
}
