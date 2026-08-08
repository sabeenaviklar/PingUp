/**
 * Normalizes a base URL by removing any trailing slashes.
 * @param {string} url 
 * @returns {string}
 */
export function normalizeBaseUrl(url) {
  if (!url || typeof url !== 'string') return '';
  return url.trim().replace(/\/+$/, '');
}

/**
 * Resolves the active base URL for API calls.
 * Inline Architecture Decision:
 * When VITE_API_URL is omitted or empty, we return an empty string ('') rather than
 * hardcoding the production Render URL.
 * Returning '' ensures requests use relative paths (e.g., '/api/users'), which allows
 * Vite's development server proxy (configured in vite.config.js: /api -> http://localhost:3001)
 * to seamlessly route API calls to the local backend during offline development without CORS blocks.
 * In production deployments, setting VITE_API_URL overrides this behavior.
 * @returns {string}
 */
export function getBaseUrl() {
  const envUrl = import.meta.env?.VITE_API_URL;
  return envUrl ? normalizeBaseUrl(envUrl) : '';
}

/**
 * Constructs a full API URL for the given endpoint.
 * @param {string} endpoint - API route (e.g. '/api/users' or 'api/dm')
 * @param {string} [overrideBaseUrl] - Optional base URL override (primarily for testing)
 * @returns {string}
 */
export function getApiUrl(endpoint, overrideBaseUrl) {
  const baseUrl = overrideBaseUrl !== undefined ? normalizeBaseUrl(overrideBaseUrl) : getBaseUrl();
  const cleanEndpoint = !endpoint ? '' : endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
  return `${baseUrl}${cleanEndpoint}`;
}

export function apiFetch(endpoint, options = {}) {
  options.credentials = 'credentials' in options ? options.credentials : 'include';
  return fetch(getApiUrl(endpoint), options);
}

