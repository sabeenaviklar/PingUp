import { useState } from 'react';
import { apiFetch } from '../api';

export default function SearchPanel({ channelId, dmId, token, onClose }) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [hasSearched, setHasSearched] = useState(false);

  const handleSearch = async (e) => {
    e.preventDefault();
    if (!query.trim()) return;

    setLoading(true);
    setError(null);
    setHasSearched(true);

    try {
      let endpoint = `/api/search?q=${encodeURIComponent(query)}`;
      if (channelId) endpoint += `&channelId=${channelId}`;
      if (dmId) endpoint += `&dmId=${dmId}`;

      const res = await apiFetch(endpoint, {
        headers: token ? { Authorization: `Bearer ${token}` } : {}
      });

      if (!res.ok) {
        throw new Error('Search failed');
      }

      const data = await res.json();
      setResults(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const highlightText = (text, highlight) => {
    if (!highlight.trim() || !text) return text;
    const parts = text.split(new RegExp(`(${highlight})`, 'gi'));
    return parts.map((part, i) =>
      part.toLowerCase() === highlight.toLowerCase() ? (
        <span key={i} className="search-highlight">{part}</span>
      ) : part
    );
  };

  return (
    <div className="search-panel">
      <div className="search-panel-header">
        <h3>Search</h3>
        <button className="search-panel-close" onClick={onClose} title="Close search">✕</button>
      </div>
      
      <div className="search-panel-body">
        <form onSubmit={handleSearch} className="search-form">
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search messages..."
            autoFocus
            className="search-input"
          />
          <button type="submit" disabled={loading} className="search-btn">
            {loading ? '⏳' : '🔍'}
          </button>
        </form>

        {error && <div className="search-error">{error}</div>}

        <div className="search-results">
          {results.length === 0 && !loading && hasSearched && (
            <div className="search-no-results">No results found for "{query}"</div>
          )}
          
          {results.map((msg) => (
            <div key={msg.id} className="search-result-item">
              <div className="search-result-meta">
                <span className="search-result-author">{msg.username || msg.senderUsername}</span>
                <span className="search-result-time">
                  {new Date(msg.timestamp).toLocaleString()}
                </span>
              </div>
              <div className="search-result-text">
                {highlightText(msg.text, query)}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
