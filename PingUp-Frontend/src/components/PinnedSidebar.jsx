import MarkdownMessage from './MarkdownMessage';

export default function PinnedSidebar({ showPinnedSidebar, setShowPinnedSidebar, pinnedMessages, isMod, handlePin }) {
  if (!showPinnedSidebar) return null;

  return (
    <>
      <div
        className="msg-pinned-overlay"
        onClick={() => setShowPinnedSidebar(false)}
      />

      <div className="msg-pinned-sidebar">
        <div className="msg-pinned-sidebar-header">
          <h3>📌 Pinned Messages</h3>
          <button
            className="msg-pinned-close"
            onClick={() => setShowPinnedSidebar(false)}
          >
            ✕
          </button>
        </div>

        {pinnedMessages.length === 0 ? (
          <div className="msg-pinned-empty">
            <p>📌 No pinned messages in this channel</p>
          </div>
        ) : (
          pinnedMessages.map((msg) => (
            <div
              key={msg.id}
              className="msg-pinned-sidebar-item"
              role="button"
              tabIndex={0}
              onClick={(e) => {
                e.stopPropagation();
                document
                  .getElementById(`message-${msg.id}`)
                  ?.scrollIntoView({
                    behavior: "smooth",
                    block: "center",
                  });
                setShowPinnedSidebar(false);
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  e.stopPropagation();
                  document
                    .getElementById(`message-${msg.id}`)
                    ?.scrollIntoView({
                      behavior: "smooth",
                      block: "center",
                    });
                  setShowPinnedSidebar(false);
                }
              }}
            >
              <strong>{msg.username}</strong>
              <span className="msg-pinned-time">
                {new Date(msg.timestamp).toLocaleString()}
              </span>
              <MarkdownMessage content={msg.text || ""} truncate={true} />
              {isMod && (
                <button
                  className="msg-pinned-unpin"
                  onClick={(e) => {
                    e.stopPropagation();
                    handlePin(msg.id);
                  }}
                >
                  Unpin
                </button>
              )}
            </div>
          ))
        )}
      </div>
    </>
  );
}
