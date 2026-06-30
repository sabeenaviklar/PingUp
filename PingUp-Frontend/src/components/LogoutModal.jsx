import { useEffect, useRef } from 'react';

export default function LogoutModal({ showLogoutModal, setShowLogoutModal, setShowProfileMenu, onLogout }) {
  const cancelBtnRef = useRef(null);

  useEffect(() => {
    const handleEsc = (e) => {
      if (e.key === "Escape") {
        setShowLogoutModal(false);
      }
    };

    if (showLogoutModal) {
      window.addEventListener("keydown", handleEsc);
      cancelBtnRef.current?.focus();
    }

    return () => {
      window.removeEventListener("keydown", handleEsc);
    };
  }, [showLogoutModal, setShowLogoutModal]);

  if (!showLogoutModal) return null;

  return (
    <div
      className="logout-modal-overlay"
      role="dialog"
      aria-modal="true"
      aria-labelledby="logout-modal-title"
      aria-describedby="logout-modal-description"
      onClick={() => setShowLogoutModal(false)}
    >
      <div
        className="logout-modal"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 id="logout-modal-title">Log Out?</h3>

        <p id="logout-modal-description">
          Are you sure you want to log out of your account?
        </p>

        <div className="logout-modal-actions">
          <button
            className="logout-cancel-btn"
            ref={cancelBtnRef}
            onClick={() => setShowLogoutModal(false)}
          >
           ❌ Cancel
          </button>

          <button
            className="logout-confirm-btn"
            onClick={() => {
              setShowProfileMenu(false);
              setShowLogoutModal(false);
              onLogout();
            }}
          >
           🚪 Log Out
          </button>
        </div>
      </div>
    </div>
  );
}
