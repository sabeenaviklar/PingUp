export default function EditHistoryModal({ showEditHistory, setShowEditHistory }) {
  if (!showEditHistory) return null;

  return (
    <div className="msg-edit-history-overlay" onClick={() => setShowEditHistory(null)}>
      <div className="msg-edit-history-modal" onClick={e => e.stopPropagation()}>
        <div className="msg-edit-history-header">
          <h3>Edit History</h3>
          <button 
            className="msg-edit-history-close"
            onClick={() => setShowEditHistory(null)}
          >✕</button>
        </div>
        <div className="msg-edit-history-content">
          {showEditHistory.editHistory && showEditHistory.editHistory.length > 0 ? (
            showEditHistory.editHistory.map((edit, idx) => (
              <div key={idx} className="msg-edit-history-entry">
                <div className="msg-edit-history-timestamp">
                  Edit {idx + 1} - {new Date(edit.editedAt).toLocaleString()}
                </div>
                <div className="msg-edit-history-original">
                  <strong>Before:</strong>
                  <p>{edit.originalText}</p>
                </div>
                <div className="msg-edit-history-edited">
                  <strong>After:</strong>
                  <p>{edit.editedText}</p>
                </div>
                {edit.editedBy && (
                  <div className="msg-edit-history-editor">
                    <em>Edited by moderator</em>
                  </div>
                )}
              </div>
            ))
          ) : (
            <p className="msg-edit-history-empty">No edit history</p>
          )}
        </div>
      </div>
    </div>
  );
}
