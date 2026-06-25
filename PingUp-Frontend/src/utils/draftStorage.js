/**
 * Draft message persistence utilities
 * Handles localStorage operations for draft messages across conversations
 */

const STORAGE_PREFIX = 'draft_';

/**
 * Generates a unique storage key for a draft based on context type and ID
 * @param {string} type - 'channel' or 'dm'
 * @param {string|number} id - channel ID or user ID
 * @returns {string} Storage key
 */
export function getDraftKey(type, id) {
  if (!type || !id) return null;
  return `${STORAGE_PREFIX}${type}_${id}`;
}

/**
 * Saves a draft message to localStorage
 * @param {string} type - 'channel' or 'dm'
 * @param {string|number} id - channel ID or user ID
 * @param {string} text - Draft message text
 */
export function saveDraft(type, id, text) {
  try {
    // Prevent saving empty drafts
    if (!text || !text.trim()) {
      removeDraft(type, id);
      return;
    }
    
    const key = getDraftKey(type, id);
    if (!key) return;
    
    localStorage.setItem(key, text);
  } catch (err) {
    // Silently fail if localStorage is unavailable or full
    console.warn('Failed to save draft:', err);
  }
}

/**
 * Retrieves a draft message from localStorage
 * @param {string} type - 'channel' or 'dm'
 * @param {string|number} id - channel ID or user ID
 * @returns {string|null} Draft message text or null if not found
 */
export function getDraft(type, id) {
  try {
    const key = getDraftKey(type, id);
    if (!key) return null;
    
    const draft = localStorage.getItem(key);
    return draft || null;
  } catch (err) {
    // Silently fail if localStorage is unavailable
    console.warn('Failed to retrieve draft:', err);
    return null;
  }
}

/**
 * Removes a draft message from localStorage
 * @param {string} type - 'channel' or 'dm'
 * @param {string|number} id - channel ID or user ID
 */
export function removeDraft(type, id) {
  try {
    const key = getDraftKey(type, id);
    if (!key) return;
    
    localStorage.removeItem(key);
  } catch (err) {
    // Silently fail if localStorage is unavailable
    console.warn('Failed to remove draft:', err);
  }
}

/**
 * Clears all draft messages from localStorage
 */
export function clearAllDrafts() {
  try {
    const keys = Object.keys(localStorage);
    keys.forEach(key => {
      if (key.startsWith(STORAGE_PREFIX)) {
        localStorage.removeItem(key);
      }
    });
  } catch (err) {
    console.warn('Failed to clear all drafts:', err);
  }
}

/**
 * Checks if localStorage is available
 * @returns {boolean} True if localStorage is available
 */
export function isLocalStorageAvailable() {
  try {
    const testKey = '__draft_test__';
    localStorage.setItem(testKey, 'test');
    localStorage.removeItem(testKey);
    return true;
  } catch {
    return false;
  }
}
