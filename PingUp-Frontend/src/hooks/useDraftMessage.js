import { useState, useEffect, useCallback, useRef } from 'react';
import { saveDraft, getDraft, removeDraft } from '../utils/draftStorage';

export function useDraftMessage(draftType, draftId, debounceMs = 500) {
  const [text, setText] = useState(() => {
    if (!draftType || !draftId) return '';
    return getDraft(draftType, draftId) || '';
  });

  const debounceTimer = useRef(null);

  const handleTextChange = useCallback(
    (newText) => {
      setText(newText);

      if (debounceTimer.current) {
        clearTimeout(debounceTimer.current);
      }

      debounceTimer.current = setTimeout(() => {
        if (draftType && draftId) {
          saveDraft(draftType, draftId, newText);
        }
      }, debounceMs);
    },
    [draftType, draftId, debounceMs]
  );

  const clearDraft = useCallback(() => {
    setText('');

    if (draftType && draftId) {
      removeDraft(draftType, draftId);
    }
  }, [draftType, draftId]);

  useEffect(() => {
    return () => {
      if (debounceTimer.current) {
        clearTimeout(debounceTimer.current);
      }
    };
  }, []);

  return {
    text,
    setText: handleTextChange,
    clearDraft,
  };
}