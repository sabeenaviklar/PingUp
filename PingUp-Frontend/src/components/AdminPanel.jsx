import { useState, useEffect } from 'react';
import { apiFetch } from '../api';
import AdminChannelsTab from './AdminChannelsTab';
import AdminUsersTab from './AdminUsersTab';
import AdminRolesTab from './AdminRolesTab';

export default function AdminPanel({ currentUser, socket, categories, token, onClose, allowUserChannelCreation }) {
  const [tab,         setTab]         = useState('channels'); // 'channels' | 'users' | 'roles'
  const [allUsers,    setAllUsers]    = useState([]);
  const [loadingUsers,setLoadingUsers]= useState(false);
  const [notification,setNotification]= useState('');
  const [settings,    setSettings]    = useState({
    allowUserChannelCreation: allowUserChannelCreation ?? true,
  });


  // Fetch all users for user management
  useEffect(() => {
    if (tab !== 'users' && tab !== 'roles') return;
    
    let isMounted = true;
    const timer = setTimeout(() => {
      if (isMounted) setLoadingUsers(true);
    }, 0);

    apiFetch('/api/users', {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    })
      .then(r => r.json())
      .then(data => {
        if (isMounted) {
          setAllUsers(data);
          setLoadingUsers(false);
        }
      })
      .catch(() => {
        if (isMounted) {
          setLoadingUsers(false);
        }
      });

    return () => {
      isMounted = false;
      clearTimeout(timer);
    };
  }, [tab, token]);

  function notify(msg) {
    setNotification(msg);
    setTimeout(() => setNotification(''), 3000);
  }

  // ── Channel controls ────────────────────────────────────────────
  function handleToggleReadOnly(ch) {
    socket?.emit('channel:toggleReadOnly', { channelId: ch.id });
    notify(`Toggled read-only for #${ch.name}`);
  }
  function handleToggleLock(ch) {
    socket?.emit('channel:toggleLock', { channelId: ch.id });
    notify(`Toggled lock for #${ch.name}`);
  }
  function handleTogglePrivate(ch) {
    socket?.emit('channel:togglePrivate', { channelId: ch.id });
    notify(`Toggled private for #${ch.name}`);
  }
  function handleDeleteChannel(ch) {
    if (!confirm(`Delete #${ch.name} and all its messages?`)) return;
    socket?.emit('channel:delete', { channelId: ch.id });
    notify(`Deleted #${ch.name}`);
  }
  function handleRenameChannel(ch) {
    const newName = prompt(`Rename #${ch.name} to:`, ch.name);
    if (!newName?.trim() || newName.trim() === ch.name) return;
    socket?.emit('channel:rename', { channelId: ch.id, newName: newName.trim() });
    notify(`Renamed #${ch.name} → ${newName}`);
  }

  // ── User controls ───────────────────────────────────────────────
  function handleSetRole(userId, role) {
    socket?.emit('user:setrole', { targetId: userId, role });
    setAllUsers(prev => prev.map(u => u.id === userId ? { ...u, role } : u));
    notify(`Role updated to ${role}`);
  }
  function handleKick(userId, username) {
    if (!confirm(`Kick ${username}?`)) return;
    socket?.emit('user:kick', { targetId: userId });
    notify(`Kicked ${username}`);
  }
  function handleBan(userId, username) {
    if (!confirm(`Ban ${username}? They won't be able to log in.`)) return;
    socket?.emit('user:ban', { targetId: userId });
    setAllUsers(prev => prev.map(u => u.id === userId ? { ...u, banned: true } : u));
    notify(`Banned ${username}`);
  }


  return (
    <div className="admin-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="admin-panel">

        {/* Header */}
        <div className="admin-header">
          <div className="admin-header-left">
            <span className="admin-crown">👑</span>
            <h2 className="admin-title">Admin Panel</h2>
            <span className="admin-badge">{currentUser.username}</span>
          </div>
          <button className="admin-close" onClick={onClose}>✕</button>
        </div>

        {/* Notification toast */}
        {notification && (
          <div className="admin-notif">{notification}</div>
        )}

        {/* Tabs */}
        <div className="admin-tabs">
          {['channels', 'users', 'roles','settings'].map(t => (
            <button
              key={t}
              className={`admin-tab ${tab === t ? 'active' : ''}`}
              onClick={() => setTab(t)}
            >
              {t === 'channels' && '🏠 Channels'}
              {t === 'users'    && '👥 Users'}
              {t === 'roles'    && '🔰 Roles'}
              {t === 'settings' && '⚙️ Settings'}
            </button>
          ))}
        </div>

        <div className="admin-body">

          {/* ── Channels tab ───────────────────────────────────── */}
          {tab === 'channels' && (
            <AdminChannelsTab
              categories={categories}
              socket={socket}
              notify={notify}
              handleToggleReadOnly={handleToggleReadOnly}
              handleToggleLock={handleToggleLock}
              handleTogglePrivate={handleTogglePrivate}
              handleRenameChannel={handleRenameChannel}
              handleDeleteChannel={handleDeleteChannel}
            />
          )}

          {/* ── Users tab ───────────────────────────────────────── */}
          {tab === 'users' && (
            <AdminUsersTab
              loadingUsers={loadingUsers}
              allUsers={allUsers}
              currentUser={currentUser}
              handleKick={handleKick}
              handleBan={handleBan}
            />
          )}

          {/* ── Roles tab ───────────────────────────────────────── */}
          {tab === 'roles' && (
            <AdminRolesTab
              loadingUsers={loadingUsers}
              allUsers={allUsers}
              handleSetRole={handleSetRole}
            />
          )}

          {/* ── Settings tab ──────────────────────────────────────── */}
          {tab === 'settings' && (
            <div className="admin-section">
              <p className="admin-hint">
                Control server-wide permissions and feature toggles.
              </p>
              <div className="admin-setting-row">
                <div className="admin-setting-info">
                  <span className="admin-setting-label">
                    Allow members/moderators to create channels
                  </span>
                  <span className="admin-setting-desc">
                    When enabled, non-admin users can create new 
                    channels in any category.
                  </span>
                </div>
                <button
                  className={`admin-toggle ${settings.allowUserChannelCreation ? 'on' : 'off'}`}
                  onClick={() => {
                    const newValue = !settings.allowUserChannelCreation;
                    setSettings(prev => ({ ...prev, allowUserChannelCreation: newValue }));
                    socket?.emit('settings:update', {
                      key: 'allowUserChannelCreation',
                      value: newValue,
                    });
                    notify(`Channel creation ${newValue ? 'enabled' : 'disabled'} for all users`);
                  }}
                >
                  {settings.allowUserChannelCreation ? '✅ ON' : '❌ OFF'}
                </button>
              </div>
            </div>
          )}
        
        </div>
      </div>
    </div>
  );
}
