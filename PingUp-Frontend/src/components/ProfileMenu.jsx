import { useState, useEffect } from 'react';

const STATUS_ICONS = {
  online: '🟢',
  idle: '🌙',
  dnd: '⛔',
  invisible: '👻'
};

const STATUS_LABELS = {
  online: 'Online',
  idle: 'Idle',
  dnd: 'Do Not Disturb',
  invisible: 'Invisible'
};

export default function ProfileMenu({
  socket,
  showProfileMenu,
  currentUser,
  onOpenProfile,
  setShowProfileMenu,
  muted,
  setMuted,
  deafened,
  setDeafened,
  isOwner,
  onOpenAdmin,
  setShowNewCategory,
  setShowLogoutModal,
}) {
  const [editingCustom, setEditingCustom] = useState(false);
  const [customInput, setCustomInput] = useState(currentUser?.customStatus || '');
  const [currentStatus, setCurrentStatus] = useState(currentUser?.status || 'online');

  useEffect(() => {
    setCustomInput(currentUser?.customStatus || '');
    setCurrentStatus(currentUser?.status || 'online');
  }, [currentUser]);

  if (!showProfileMenu) return null;

  function setStatus(status) {
    setCurrentStatus(status);
    if (socket) socket.emit('user:status:update', { status });
  }

  function saveCustomStatus() {
    if (socket) socket.emit('user:status:update', { customStatus: customInput });
    setEditingCustom(false);
  }

  return (
    <div className="dm-profile-menu">
      <div className="dm-profile-menu-header">
        <div className={`dm-pm-avatar avatar-${currentUser.role}`}>
          {currentUser.username[0].toUpperCase()}
        </div>
        <div>
          <div className="dm-pm-name">{currentUser.username}</div>
          <div className={`dm-pm-role role-${currentUser.role}`}>{currentUser.role}</div>
          <div className="dm-pm-status">{STATUS_ICONS[currentStatus]} {STATUS_LABELS[currentStatus]}</div>
        </div>
      </div>

      <div className="dm-pm-divider" />

      {/* Set Status */}
      <div className="dm-pm-section-label" style={{ padding: '0 12px 6px', fontSize: '12px', color: 'var(--text-muted)' }}>Set Status</div>
      <div className="dm-pm-status-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px', padding: '0 8px' }}>
        {Object.keys(STATUS_LABELS).map(key => (
          <button 
            key={key}
            className={`dm-pm-item ${currentStatus === key ? 'active' : ''}`}
            onClick={() => setStatus(key)}
            style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '6px', fontSize: '13px' }}
          >
            {STATUS_ICONS[key]} {STATUS_LABELS[key]}
          </button>
        ))}
      </div>

      <div className="dm-pm-divider" />

      {/* Custom Status */}
      <div className="dm-pm-section-label" style={{ padding: '0 12px 6px', fontSize: '12px', color: 'var(--text-muted)' }}>Custom Status</div>
      {editingCustom ? (
        <div style={{ padding: '0 8px', display: 'flex', gap: '4px' }}>
          <input 
            autoFocus
            type="text" 
            placeholder="What's on your mind?"
            value={customInput} 
            onChange={e => setCustomInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && saveCustomStatus()}
            maxLength={100}
            style={{ flex: 1, padding: '6px', borderRadius: '4px', border: 'none', background: 'var(--bg-tertiary)', color: '#fff' }}
          />
          <button onClick={saveCustomStatus} style={{ padding: '6px 12px', background: 'var(--brand)', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>Save</button>
        </div>
      ) : (
        <button 
          className="dm-pm-item"
          onClick={() => setEditingCustom(true)}
        >
          ✏️ {customInput || 'Set a custom status...'}
        </button>
      )}

      <div className="dm-pm-divider" />

      <button
        className="dm-pm-item"
        onClick={() => { onOpenProfile(); setShowProfileMenu(false); }}
      >👤 View Profile</button>
      <button
        className="dm-pm-item"
        onClick={() => setMuted(v => !v)}
      >{muted ? '🎙️ Unmute' : '🔇 Mute Microphone'}</button>
      <button
        className="dm-pm-item"
        onClick={() => setDeafened(v => !v)}
      >{deafened ? '🎧 Undeafen' : '🔕 Deafen'}</button>

      {isOwner && (
        <>
          <div className="dm-pm-divider" />
          <div className="dm-pm-section-label">👑 Owner Controls</div>

          <button
            className="dm-pm-item"
            onClick={() => {
              onOpenAdmin?.();
              setShowProfileMenu(false);
            }}
          >🛡️ Admin Panel</button>

          <button
            className="dm-pm-item"
            onClick={() => {
              setShowNewCategory(true);
              setShowProfileMenu(false);
            }}
          >📁 New Category</button>
        </>
      )}

      <div className="dm-pm-divider" />

      <button
        className="dm-pm-item danger" onClick={() => {
          setShowLogoutModal(true);
        }} >
        🚪 Log Out
      </button>
    </div>
  );
}
