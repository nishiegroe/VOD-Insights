/**
 * Multi-VOD Comparison Modal Component
 * Allows users to create a comparison session with 2-3 VODs
 *
 * Features:
 * - Fetch available VODs from backend
 * - Select 2-3 VODs for comparison
 * - Optional session name (defaults to "Comparison-{date}")
 * - Sync mode toggle (Global/Independent)
 * - Create session and navigate to comparison page
 *
 * Created: 2026-03-02
 */

import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

export default function MultiVodModal({ isOpen, onClose }) {
  const navigate = useNavigate();
  
  const [vodList, setVodList] = useState([]);
  const [selectedVods, setSelectedVods] = useState([]);
  const [sessionName, setSessionName] = useState('');
  const [syncMode, setSyncMode] = useState('global'); // 'global' or 'independent'
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  // Fetch VOD list when modal opens
  useEffect(() => {
    if (isOpen) {
      fetchVodList();
    }
  }, [isOpen]);

  const fetchVodList = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch('/api/sessions/multi-vod/vods/list');
      if (!response.ok) {
        throw new Error('Failed to fetch VOD list');
      }
      const data = await response.json();
      setVodList(data.vods || []);
    } catch (err) {
      setError(err.message || 'Failed to load VODs');
      setVodList([]);
    } finally {
      setLoading(false);
    }
  };

  const handleVodToggle = (vodPath) => {
    setSelectedVods((prev) => {
      if (prev.includes(vodPath)) {
        // Remove if already selected
        return prev.filter((p) => p !== vodPath);
      } else {
        // Add if we haven't reached the limit
        if (prev.length < 3) {
          return [...prev, vodPath];
        }
        return prev;
      }
    });
  };

  const generateDefaultSessionName = () => {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    return `Comparison-${year}${month}${day}-${hours}${minutes}`;
  };

  const handleSubmit = async () => {
    // Validation
    if (selectedVods.length < 2 || selectedVods.length > 3) {
      setError('Please select 2-3 VODs');
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      const finalSessionName = sessionName.trim() || generateDefaultSessionName();

      // Build VOD objects array with full metadata from selected VOD paths
      const selectedVodObjects = selectedVods.map((vodPath) => {
        const vodInfo = vodList.find((v) => v.path === vodPath);
        if (!vodInfo) {
          throw new Error(`VOD not found: ${vodPath}`);
        }
        return {
          vod_id: vodInfo.vod_id,
          name: vodInfo.name || vodInfo.display_name || vodPath.split(/[/\\]/).pop(),
          path: vodPath,
        };
      });

      console.log('[DEBUG] Sending payload to backend:', {
        vods: selectedVodObjects,
        name: finalSessionName,
      });

      const response = await fetch('/api/sessions/multi-vod', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          vods: selectedVodObjects,  // ✅ Correct field name
          name: finalSessionName,    // ✅ Correct field name
          // sync_mode removed - backend doesn't use it
        }),
      });

      const data = await response.json();

      if (!response.ok || !data.ok) {
        throw new Error(data.error || 'Failed to create comparison session');
      }

      // Navigate to comparison page with session ID
      const sessionId = data.session.session_id;  // ✅ Updated to use session object
      handleClose();
      navigate(`/comparison?session=${encodeURIComponent(sessionId)}`);
    } catch (err) {
      setError(err.message || 'Failed to create session');
    } finally {
      setSubmitting(false);
    }
  };

  const handleClose = () => {
    setSelectedVods([]);
    setSessionName('');
    setSyncMode('global');
    setError(null);
    onClose();
  };

  if (!isOpen) return null;

  const isValidSelection = selectedVods.length >= 2 && selectedVods.length <= 3;

  return (
    <div className="modal-overlay" onClick={handleClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Create Multi-VOD Comparison</h2>
          <button className="modal-close" onClick={handleClose} disabled={submitting}>
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
            >
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', padding: '0' }}>
          {/* Error Message */}
          {error && (
            <div
              style={{
                padding: '12px 16px',
                background: 'rgba(255, 112, 67, 0.12)',
                border: '1px solid rgba(255, 112, 67, 0.5)',
                borderRadius: '8px',
                color: '#ffd0c0',
                fontSize: '14px',
                display: 'flex',
                gap: '8px',
                alignItems: 'flex-start',
              }}
            >
              <span style={{ fontSize: '16px', flexShrink: 0 }}>⚠️</span>
              <span>{error}</span>
            </div>
          )}

          {/* VOD Selection Section */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <label style={{ fontSize: '13px', color: '#9fb0b7', fontWeight: '600' }}>
              Select VODs ({selectedVods.length}/3)
            </label>
            <p style={{ fontSize: '12px', color: '#9fb0b7', margin: '0 0 8px 0' }}>
              Select 2-3 VODs to compare
            </p>

            {loading ? (
              <div style={{ textAlign: 'center', padding: '20px', color: '#9fb0b7' }}>
                Loading VODs...
              </div>
            ) : vodList.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '20px', color: '#9fb0b7' }}>
                No VODs found. <a href="/vods" style={{ color: '#ffb347' }}>Add a VOD</a>
              </div>
            ) : (
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '8px',
                  maxHeight: '300px',
                  overflowY: 'auto',
                  paddingRight: '4px',
                }}
              >
                {vodList.map((vod) => (
                  <label
                    key={vod.path}
                    style={{
                      display: 'flex',
                      alignItems: 'flex-start',
                      gap: '10px',
                      padding: '10px 12px',
                      background: selectedVods.includes(vod.path)
                        ? 'rgba(255, 179, 71, 0.1)'
                        : '#0c171b',
                      border: selectedVods.includes(vod.path)
                        ? '1px solid rgba(255, 179, 71, 0.5)'
                        : '1px solid #1f3640',
                      borderRadius: '8px',
                      cursor: selectedVods.length >= 3 && !selectedVods.includes(vod.path)
                        ? 'not-allowed'
                        : 'pointer',
                      opacity: selectedVods.length >= 3 && !selectedVods.includes(vod.path)
                        ? 0.5
                        : 1,
                      transition: 'background 0.2s ease, border-color 0.2s ease',
                    }}
                    onMouseEnter={(e) => {
                      if (selectedVods.length < 3 || selectedVods.includes(vod.path)) {
                        e.currentTarget.style.borderColor = '#ffb347';
                      }
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.borderColor = selectedVods.includes(vod.path)
                        ? 'rgba(255, 179, 71, 0.5)'
                        : '#1f3640';
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={selectedVods.includes(vod.path)}
                      onChange={() => handleVodToggle(vod.path)}
                      disabled={
                        selectedVods.length >= 3 && !selectedVods.includes(vod.path)
                      }
                      style={{
                        width: '18px',
                        height: '18px',
                        cursor: 'pointer',
                        flexShrink: 0,
                        marginTop: '1px',
                      }}
                      aria-label={`Select ${vod.display_name || vod.name}`}
                    />
                    <div style={{ flex: 1 }}>
                      <div
                        style={{
                          fontSize: '14px',
                          fontWeight: '500',
                          color: '#f4f7f8',
                          marginBottom: '4px',
                        }}
                      >
                        {vod.display_name || vod.name || vod.path.split(/[/\\]/).pop()}
                      </div>
                      <div style={{ fontSize: '12px', color: '#9fb0b7' }}>
                        {vod.duration && (
                          <span>Duration: {formatDuration(vod.duration)} • </span>
                        )}
                        {vod.resolution && <span>Resolution: {vod.resolution}</span>}
                      </div>
                    </div>
                  </label>
                ))}
              </div>
            )}
          </div>

          {/* Session Name Section */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <label style={{ fontSize: '13px', color: '#9fb0b7', fontWeight: '600' }}>
              Session Name (Optional)
            </label>
            <input
              type="text"
              value={sessionName}
              onChange={(e) => setSessionName(e.target.value)}
              placeholder={generateDefaultSessionName()}
              disabled={submitting}
              style={{
                width: '100%',
                padding: '10px 12px',
                background: '#0c171b',
                border: '1px solid #1f3640',
                borderRadius: '8px',
                color: '#f4f7f8',
                fontSize: '13px',
                transition: 'border-color 0.2s ease',
                cursor: submitting ? 'not-allowed' : 'text',
                opacity: submitting ? 0.6 : 1,
              }}
              onFocus={(e) => {
                if (!submitting) {
                  e.target.style.borderColor = '#ffb347';
                }
              }}
              onBlur={(e) => {
                e.target.style.borderColor = '#1f3640';
              }}
              aria-label="Session name"
            />
            <p style={{ fontSize: '12px', color: '#9fb0b7', margin: '4px 0 0 0' }}>
              Defaults to "Comparison-{'{date}'}" if left empty
            </p>
          </div>

          {/* Sync Mode Section */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <label style={{ fontSize: '13px', color: '#9fb0b7', fontWeight: '600' }}>
              Sync Mode
            </label>
            <div style={{ display: 'flex', gap: '8px' }}>
              <label
                style={{
                  flex: 1,
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '10px 12px',
                  background: syncMode === 'global'
                    ? 'rgba(255, 179, 71, 0.1)'
                    : '#0c171b',
                  border: syncMode === 'global'
                    ? '1px solid rgba(255, 179, 71, 0.5)'
                    : '1px solid #1f3640',
                  borderRadius: '8px',
                  cursor: submitting ? 'not-allowed' : 'pointer',
                  opacity: submitting ? 0.6 : 1,
                  transition: 'background 0.2s ease, border-color 0.2s ease',
                }}
                onMouseEnter={(e) => {
                  if (!submitting) {
                    e.currentTarget.style.borderColor = '#ffb347';
                  }
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = syncMode === 'global'
                    ? 'rgba(255, 179, 71, 0.5)'
                    : '#1f3640';
                }}
              >
                <input
                  type="radio"
                  name="syncMode"
                  value="global"
                  checked={syncMode === 'global'}
                  onChange={(e) => setSyncMode(e.target.value)}
                  disabled={submitting}
                  style={{ cursor: 'pointer' }}
                  aria-label="Global sync mode"
                />
                <div>
                  <div style={{ fontSize: '13px', fontWeight: '500', color: '#f4f7f8' }}>
                    Global
                  </div>
                  <div style={{ fontSize: '11px', color: '#9fb0b7' }}>
                    All videos play in sync
                  </div>
                </div>
              </label>

              <label
                style={{
                  flex: 1,
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '10px 12px',
                  background: syncMode === 'independent'
                    ? 'rgba(255, 179, 71, 0.1)'
                    : '#0c171b',
                  border: syncMode === 'independent'
                    ? '1px solid rgba(255, 179, 71, 0.5)'
                    : '1px solid #1f3640',
                  borderRadius: '8px',
                  cursor: submitting ? 'not-allowed' : 'pointer',
                  opacity: submitting ? 0.6 : 1,
                  transition: 'background 0.2s ease, border-color 0.2s ease',
                }}
                onMouseEnter={(e) => {
                  if (!submitting) {
                    e.currentTarget.style.borderColor = '#ffb347';
                  }
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = syncMode === 'independent'
                    ? 'rgba(255, 179, 71, 0.5)'
                    : '#1f3640';
                }}
              >
                <input
                  type="radio"
                  name="syncMode"
                  value="independent"
                  checked={syncMode === 'independent'}
                  onChange={(e) => setSyncMode(e.target.value)}
                  disabled={submitting}
                  style={{ cursor: 'pointer' }}
                  aria-label="Independent sync mode"
                />
                <div>
                  <div style={{ fontSize: '13px', fontWeight: '500', color: '#f4f7f8' }}>
                    Independent
                  </div>
                  <div style={{ fontSize: '11px', color: '#9fb0b7' }}>
                    Videos play separately
                  </div>
                </div>
              </label>
            </div>
          </div>
        </div>

        {/* Footer Buttons */}
        <div
          style={{
            display: 'flex',
            gap: '12px',
            paddingTop: '16px',
            borderTop: '1px solid #1f3640',
            justifyContent: 'flex-end',
          }}
        >
          <button className="secondary" onClick={handleClose} disabled={submitting}>
            Cancel
          </button>
          <button
            className="primary"
            onClick={handleSubmit}
            disabled={!isValidSelection || submitting}
            style={{
              opacity: !isValidSelection || submitting ? 0.5 : 1,
              cursor: !isValidSelection || submitting ? 'not-allowed' : 'pointer',
              minWidth: '140px',
            }}
            aria-label="Create comparison session"
          >
            {submitting ? 'Creating...' : 'Create Comparison'}
          </button>
        </div>
      </div>
    </div>
  );
}

/**
 * Format seconds into a human-readable duration string
 * @param {number} seconds - Duration in seconds
 * @returns {string} - Formatted duration (e.g., "1:30:45")
 */
function formatDuration(seconds) {
  if (!Number.isFinite(seconds)) return '—';
  const hrs = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);

  if (hrs > 0) {
    return `${hrs}:${mins.toString().padStart(2, '0')}:${secs
      .toString()
      .padStart(2, '0')}`;
  }
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}
