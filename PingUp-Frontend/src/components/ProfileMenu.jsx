import { useEffect, useRef } from 'react';

export default function ProfileMenu({
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
  const menuRef = useRef(null);

  // Basic modal focus management: focus the first item on open, keep Tab
  // focus inside the menu, close on Escape, and restore focus on close.
  useEffect(() => {
    if (!showProfileMenu) return;

    const previouslyFocused = document.activeElement;

    // Focus the first focusable item when the menu opens
    menuRef.current?.querySelector('button')?.focus();

    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        setShowProfileMenu(false);
        return;
      }
      if (e.key === 'Tab') {
        const focusables = menuRef.current?.querySelectorAll('button');
        if (!focusables || focusables.length === 0) return;
        const first = focusables[0];
        const last = focusables[focusables.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      // Restore focus to the element that opened the menu
      if (previouslyFocused && typeof previouslyFocused.focus === 'function') {
        previouslyFocused.focus();
      }
    };
  }, [showProfileMenu, setShowProfileMenu]);

  if (!showProfileMenu) return null;

  return (
    <div
      className="dm-profile-menu"
      ref={menuRef}
      role="dialog"
      aria-modal="true"
      aria-label="Profile and settings menu"
    >
      <div className="dm-profile-menu-header">
        <div className={`dm-pm-avatar avatar-${currentUser.role}`}>
          {currentUser.username[0].toUpperCase()}
        </div>
        <div>
          <div className="dm-pm-name">{currentUser.username}</div>
          <div className={`dm-pm-role role-${currentUser.role}`}>{currentUser.role}</div>
          <div className="dm-pm-status">🟢 Online</div>
        </div>
      </div>

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
          // Close the menu so its focus trap doesn't stay active over the modal
          setShowProfileMenu(false);
        }} >
        🚪 Log Out
      </button>
    </div>
  );
}
