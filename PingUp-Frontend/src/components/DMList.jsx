import { useState, useEffect, useCallback } from 'react';
import { getApiUrl } from '../api';

export default function DMList({ currentUser, token, onlineUsers, onOpenDM, activeDMId, dmNotifications }) {
  const [conversations, setConversations] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);

  // Refactored duplicate useEffect fetch calls into a single memoized callback.
  // Reduces complexity and eliminates duplicate API calling logic.
  const fetchConversations = useCallback(() => {
    if (!token) return;
    fetch(getApiUrl('/api/dm'), {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(r => r.json())
      .then(data => setConversations(Array.isArray(data) ? data : []))
      .catch(() => {});
  }, [token]);

  useEffect(() => {
    fetchConversations();
  }, [fetchConversations, dmNotifications]);

  // Debounced search mechanism.
  // Delaying API calls by 300ms mitigates query flooding on database when typing.
  useEffect(() => {
    if (!searchQuery.trim()) {
      return;
    }

    const delayDebounceFn = setTimeout(() => {
      setIsSearching(true);
      fetch(getApiUrl(`/api/users/search?q=${encodeURIComponent(searchQuery)}`), {
        headers: { Authorization: `Bearer ${token}` },
      })
        .then(r => r.json())
        .then(data => {
          setSearchResults(Array.isArray(data) ? data : []);
          setIsSearching(false);
        })
        .catch(() => {
          setIsSearching(false);
        });
    }, 300);

    return () => clearTimeout(delayDebounceFn);
  }, [searchQuery, token]);

  // Find online users to display (all online users except self)
  const others = onlineUsers.filter(u => u.id !== currentUser.id);

  function startDM(user) {
    const existing = conversations.find(c => c.otherUser?.id === user.id);
    onOpenDM(user, existing?.conversationId || null);
  }

  const roleColor = { owner: 'var(--danger)', moderator: 'var(--mod-color)', member: 'var(--accent)' };

  return (
    <div className="dm-list-panel">
      {/* Search Bar */}
      <div className="dm-search-bar" style={{ margin: '4px 8px 12px 8px' }}>
        <span className="dm-search-icon">🔍</span>
        <input
          type="text"
          className="dm-search-input"
          placeholder="Search all users..."
          value={searchQuery}
          onChange={(e) => {
            const val = e.target.value;
            setSearchQuery(val);
            if (!val.trim()) {
              setSearchResults([]);
            }
          }}
        />
        {searchQuery && (
          <button 
            type="button"
            onClick={() => {
              setSearchQuery('');
              setSearchResults([]);
            }}
            style={{
              background: 'transparent',
              border: 'none',
              color: 'var(--text-muted)',
              cursor: 'pointer',
              fontSize: '0.8rem',
              padding: '0 4px',
            }}
          >
            ✕
          </button>
        )}
      </div>

      {/* Search results view */}
      {searchQuery.trim() !== '' && (
        <div className="dm-list-section" style={{ borderBottom: '1px solid var(--border)', paddingBottom: '10px', marginBottom: '10px' }}>
          <div className="dm-list-label">SEARCH RESULTS</div>
          {isSearching ? (
            <div className="dm-list-empty" style={{ fontSize: '0.8rem', color: 'var(--text-muted)', padding: '8px' }}>Searching...</div>
          ) : searchResults.length > 0 ? (
            searchResults.map(u => {
              const isOnline = onlineUsers.some(online => online.id === u.id);
              return (
                <div key={u.id}
                  className={`dm-list-item ${activeDMId === u.id ? 'active' : ''}`}
                  onClick={() => startDM(u)}>
                  <div className={`dm-list-avatar avatar-${u.role}`} style={{ position: 'relative' }}>
                    {u.username[0].toUpperCase()}
                    {isOnline && <span className="dm-list-dot" style={{ background: 'var(--success)' }} />}
                  </div>
                  <div className="dm-list-info">
                    <span className="dm-list-name" style={{ color: roleColor[u.role] }}>{u.username}</span>
                    <span className="dm-list-sub">{u.role} {isOnline ? '• online' : '• offline'}</span>
                  </div>
                </div>
              );
            })
          ) : (
            <div className="dm-list-empty" style={{ fontSize: '0.8rem', color: 'var(--text-muted)', padding: '8px' }}>No users found</div>
          )}
        </div>
      )}

      {/* Start new DM (Online list) */}
      {searchQuery.trim() === '' && others.length > 0 && (
        <div className="dm-list-section">
          <div className="dm-list-label">ONLINE — START DM</div>
          {others.map(u => (
            <div key={u.id}
              className={`dm-list-item ${activeDMId === u.id ? 'active' : ''}`}
              onClick={() => startDM(u)}>
              <div className={`dm-list-avatar avatar-${u.role}`} style={{ position: 'relative' }}>
                {u.username[0].toUpperCase()}
                <span className="dm-list-dot" style={{ background: 'var(--success)' }} />
              </div>
              <div className="dm-list-info">
                <span className="dm-list-name" style={{ color: roleColor[u.role] }}>{u.username}</span>
                <span className="dm-list-sub">{u.role}</span>
              </div>
              {dmNotifications.filter(n => n.fromId === u.id).length > 0 && (
                <span className="dm-unread-badge">
                  {dmNotifications.filter(n => n.fromId === u.id).length}
                </span>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Recent conversations */}
      {conversations.length > 0 && (
        <div className="dm-list-section">
          <div className="dm-list-label">RECENT</div>
          {conversations.map(c => {
            if (!c.otherUser) return null;
            const isOnline = onlineUsers.find(u => u.id === c.otherUser.id);
            return (
              <div key={c.conversationId}
                className={`dm-list-item ${activeDMId === c.otherUser.id ? 'active' : ''}`}
                onClick={() => onOpenDM(c.otherUser, c.conversationId)}>
                <div className={`dm-list-avatar avatar-${c.otherUser.role}`} style={{ position: 'relative' }}>
                  {c.otherUser.username[0].toUpperCase()}
                  {isOnline && <span className="dm-list-dot" style={{ background: 'var(--success)' }} />}
                </div>
                <div className="dm-list-info">
                  <span className="dm-list-name">{c.otherUser.username}</span>
                  <span className="dm-list-sub">{c.lastMessage?.slice(0, 28)}{c.lastMessage?.length > 28 ? '…' : ''}</span>
                </div>
                {c.unreadCount > 0 && (
                  <span className="dm-unread-badge">{c.unreadCount}</span>
                )}
              </div>
            );
          })}
        </div>
      )}

      {others.length === 0 && conversations.length === 0 && searchQuery.trim() === '' && (
        <div className="dm-list-empty">No users online to message.</div>
      )}
    </div>
  );
}
