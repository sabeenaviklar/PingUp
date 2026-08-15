const CHANNEL_EMOJIS = ['💬','🌿','⚙️','📢','🎲','💡','📋','🔒','🌐','🎯','🧪','📌'];

function ChannelStatusBadges({ ch }) {
  return (
    <div className="dm-ch-status-badges">
      {ch.isReadOnly && <span className="dm-ch-badge dm-ch-badge-ro" title="Read-only">🔇</span>}
      {ch.isLocked   && <span className="dm-ch-badge dm-ch-badge-lk" title="Locked">🔒</span>}
      {ch.isPrivate  && <span className="dm-ch-badge dm-ch-badge-pv" title="Private">👁️</span>}
    </div>
  );
}

export default function ChannelCategory({
  cat,
  collapsed,
  toggleCollapse,
  canCreateChannel,
  showNewChannel,
  setShowNewChannel,
  handleDeleteCategory,
  chForm,
  setChForm,
  handleCreateChannel,
  isChannelActive,
  handleChannelClick,
  hoveredChannel,
  setHoveredChannel,
  isOwner,
  socket,
  handleDeleteChannel
}) {
  return (
    <div className="dm-category-group">
      <div
        className="dm-category-header"
        role="button"
        tabIndex={0}
        aria-expanded={collapsed[cat.id] ? 'false' : 'true'}
        onClick={() => toggleCollapse(cat.id)}
        onKeyDown={(e) => {
          // Ignore key events that originate from nested interactive elements
          if (e.target !== e.currentTarget) return;
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            toggleCollapse(cat.id);
          }
        }}
      >
        <span className="dm-cat-arrow">{collapsed[cat.id] ? '▶' : '▼'}</span>
        <span className="dm-cat-label">{cat.name}</span>

        {canCreateChannel && (
          <div className="dm-cat-owner-btns">
            <button
              className="dm-cat-icon-btn"
              title="Add channel"
              aria-label="Add channel"
              onClick={e => {
                e.stopPropagation();
                setShowNewChannel(showNewChannel === cat.id ? null : cat.id);
              }}
            >＋</button>
            <button
              className="dm-cat-icon-btn dm-cat-icon-btn-danger"
              title="Delete category"
              aria-label="Delete category"
              onClick={e => handleDeleteCategory(e, cat.id)}
            >✕</button>
          </div>
        )}
      </div>

      {canCreateChannel && showNewChannel === cat.id && (
        <form
          className="dm-new-channel-form"
          onSubmit={e => handleCreateChannel(e, cat.id)}
        >
          <div className="dm-emoji-picker">
            {CHANNEL_EMOJIS.map(em => (
              <button
                key={em} type="button"
                className={`dm-emoji-opt ${chForm.emoji === em ? 'selected' : ''}`}
                aria-label={`Use channel emoji ${em}`}
                aria-pressed={chForm.emoji === em}
                onClick={() => setChForm(f => ({ ...f, emoji: em }))}
              >{em}</button>
            ))}
          </div>
          <input
            placeholder="channel-name"
            value={chForm.name}
            onChange={e => setChForm(f => ({ ...f, name: e.target.value }))}
            autoFocus
          />
          <input
            placeholder="Description (optional)"
            value={chForm.description}
            onChange={e => setChForm(f => ({ ...f, description: e.target.value }))}
          />
          <div className="dm-new-ch-row">
            <button type="submit" className="dm-new-ch-create">Create</button>
            <button
              type="button"
              className="dm-new-ch-cancel"
              onClick={() => setShowNewChannel(null)}
            >Cancel</button>
          </div>
        </form>
      )}

      {!collapsed[cat.id] && cat.channels.map(ch => (
        <div
          key={ch.id}
          className={`dm-channel-row ${isChannelActive(ch) ? 'active' : ''} ${ch.isLocked ? 'ch-locked' : ''} ${ch.isReadOnly ? 'ch-readonly' : ''}`}
          onClick={() => handleChannelClick(ch)}
          onMouseEnter={() => setHoveredChannel(ch.id)}
          onMouseLeave={() => setHoveredChannel(null)}
        >
          <span className="dm-ch-hash">#</span>
          <span className="dm-ch-emoji">{ch.emoji || '💬'}</span>
          <span className="dm-ch-name">{ch.name}</span>

          <ChannelStatusBadges ch={ch} />

          {isOwner && hoveredChannel === ch.id && (
            <div className="dm-ch-hover-actions">
              <button
                className={`dm-ch-quick-btn ${ch.isReadOnly ? 'active' : ''}`}
                title="Toggle read-only"
                aria-label="Toggle read-only"
                onClick={e => {
                  e.stopPropagation();
                  socket?.emit('channel:toggleReadOnly', { channelId: ch.id });
                }}
              >🔇</button>
              <button
                className={`dm-ch-quick-btn ${ch.isLocked ? 'active' : ''}`}
                title="Toggle lock"
                aria-label="Toggle lock"
                onClick={e => {
                  e.stopPropagation();
                  socket?.emit('channel:toggleLock', { channelId: ch.id });
                }}
              >🔒</button>
              <button
                className={`dm-ch-quick-btn ${ch.isPrivate ? 'active' : ''}`}
                title="Toggle private"
                aria-label="Toggle private"
                onClick={e => {
                  e.stopPropagation();
                  socket?.emit('channel:togglePrivate', { channelId: ch.id });
                }}
              >👁️</button>
              <select
                className="dm-ch-slowmode-select"
                value={ch.slowModeSeconds || 0}
                onClick={(e) => e.stopPropagation()}
                onChange={(e) => {
                  e.stopPropagation();
                  socket?.emit('channel:setSlowMode', {
                    channelId: ch.id,
                    seconds: Number(e.target.value),
                  });
                }}
              >
                <option value={0}>Off</option>
                <option value={5}>5s</option>
                <option value={10}>10s</option>
                <option value={30}>30s</option>
                <option value={60}>60s</option>
              </select>
              <button
                className="dm-ch-del-btn"
                title="Delete channel"
                aria-label="Delete channel"
                onClick={e => handleDeleteChannel(e, ch.id)}
              >🗑️</button>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
