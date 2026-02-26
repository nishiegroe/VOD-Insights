/**
 * Twitch VOD Download Modal Component
 * Allows users to download Twitch VODs directly in the application
 *
 * Created: 2026-02-26
 * Updated: 2026-02-26 - Fixed UI styling and progress tracking
 */

import React, { useState, useEffect } from 'react';

export default function DownloadVODModal({ isOpen, onClose, onDownloadStart }) {
  const [url, setUrl] = useState('');
  const [isDownloading, setIsDownloading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [jobId, setJobId] = useState(null);
  const [error, setError] = useState(null);
  const [speed, setSpeed] = useState('—');
  const [eta, setEta] = useState('—');
  const [toolsReady, setToolsReady] = useState(null);
  const [downloadComplete, setDownloadComplete] = useState(false);
  const pollIntervalRef = React.useRef(null);

  // Check if tools are ready when modal opens
  useEffect(() => {
    if (isOpen) {
      checkTools();
      setDownloadComplete(false);
    }
  }, [isOpen]);

  // Cleanup polling interval on unmount
  useEffect(() => {
    return () => {
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
      }
    };
  }, []);

  const checkTools = async () => {
    try {
      const response = await fetch('/api/vod/check-tools');
      const data = await response.json();
      setToolsReady(data.yt_dlp_installed);
      if (!data.yt_dlp_installed) {
        setError('yt-dlp not installed. ' + data.message);
      }
    } catch (err) {
      setError('Failed to check tools: ' + err.message);
      setToolsReady(false);
    }
  };

  const isValidTwitchUrl = (inputUrl) => {
    return /https?:\/\/(www\.)?twitch\.tv\/videos\/\d+/.test(inputUrl);
  };

  const handleDownload = async () => {
    setError(null);

    // Validate URL
    if (!url.trim()) {
      setError('Please enter a Twitch VOD URL');
      return;
    }

    if (!isValidTwitchUrl(url)) {
      setError('Invalid Twitch VOD URL. Example: https://twitch.tv/videos/123456789');
      return;
    }

    if (!toolsReady) {
      setError('yt-dlp is not installed. Please install it first.');
      return;
    }

    try {
      setIsDownloading(true);
      setDownloadComplete(false);
      setError(null);
      setProgress(0);
      setSpeed('—');
      setEta('—');

      const response = await fetch('/api/vod/download', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: url.trim() })
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || 'Failed to start download');
        setIsDownloading(false);
        return;
      }

      setJobId(data.job_id);
      if (onDownloadStart) {
        onDownloadStart(data.job_id);
      }

      // Start polling for progress
      pollProgress(data.job_id);
    } catch (err) {
      setError('Error starting download: ' + err.message);
      setIsDownloading(false);
    }
  };

  const pollProgress = (jId) => {
    // Clear any existing interval
    if (pollIntervalRef.current) {
      clearInterval(pollIntervalRef.current);
    }

    // Start polling every 500ms for more responsive updates
    pollIntervalRef.current = setInterval(async () => {
      try {
        const response = await fetch(`/api/vod/progress/${jId}`);
        const data = await response.json();

        if (!response.ok) {
          // Don't set error for progress polling failures
          return;
        }

        // Update progress display
        setProgress(Math.min(data.percentage || 0, 100));
        setSpeed(data.speed || '—');
        setEta(data.eta || '—');

        if (data.status === 'completed') {
          clearInterval(pollIntervalRef.current);
          setIsDownloading(false);
          setDownloadComplete(true);
          setProgress(100);
          // Auto-close after showing completion
          setTimeout(() => {
            handleClose();
          }, 2000);
        } else if (data.status === 'error') {
          clearInterval(pollIntervalRef.current);
          setError(data.error || 'Download failed');
          setIsDownloading(false);
        }
      } catch (err) {
        // Silently ignore polling errors
        console.error('Progress fetch error:', err);
      }
    }, 500);
  };

  const handleClose = () => {
    if (pollIntervalRef.current) {
      clearInterval(pollIntervalRef.current);
    }
    setUrl('');
    setIsDownloading(false);
    setProgress(0);
    setJobId(null);
    setError(null);
    setSpeed('—');
    setEta('—');
    setDownloadComplete(false);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={handleClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Download Twitch VOD</h2>
          <button className="modal-close" onClick={handleClose} disabled={isDownloading}>
            ×
          </button>
        </div>

        <div style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '16px',
          padding: '0'
        }}>
          {error && (
            <div style={{
              padding: '12px 16px',
              background: 'rgba(255, 112, 67, 0.12)',
              border: '1px solid rgba(255, 112, 67, 0.5)',
              borderRadius: '8px',
              color: '#ffd0c0',
              fontSize: '14px',
              display: 'flex',
              gap: '8px',
              alignItems: 'flex-start'
            }}>
              <span style={{ fontSize: '16px', flexShrink: 0 }}>⚠️</span>
              <span>{error}</span>
            </div>
          )}

          {toolsReady === false && !error && (
            <div style={{
              padding: '12px 16px',
              background: 'rgba(255, 179, 71, 0.1)',
              border: '1px solid rgba(255, 179, 71, 0.3)',
              borderRadius: '8px',
              color: '#ffb347',
              fontSize: '14px',
              display: 'flex',
              gap: '8px',
              alignItems: 'flex-start'
            }}>
              <span style={{ fontSize: '16px', flexShrink: 0 }}>⚙️</span>
              <span>yt-dlp is not installed. Install with: <code style={{
                background: 'rgba(0, 0, 0, 0.3)',
                padding: '2px 6px',
                borderRadius: '4px',
                fontFamily: 'monospace'
              }}>pip install yt-dlp</code></span>
            </div>
          )}

          {!isDownloading && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <label style={{ fontSize: '13px', color: '#9fb0b7', fontWeight: '600' }}>
                Twitch VOD URL
              </label>
              <input
                type="text"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://twitch.tv/videos/123456789"
                disabled={isDownloading || !toolsReady}
                onKeyPress={(e) => {
                  if (e.key === 'Enter' && !isDownloading && toolsReady) {
                    handleDownload();
                  }
                }}
                style={{
                  width: '100%',
                  padding: '10px 12px',
                  background: '#0c171b',
                  border: '1px solid #1f3640',
                  borderRadius: '8px',
                  color: '#f4f7f8',
                  fontFamily: 'monospace',
                  fontSize: '13px',
                  transition: 'border-color 0.2s ease',
                  cursor: !toolsReady ? 'not-allowed' : 'text',
                  opacity: !toolsReady ? 0.6 : 1
                }}
                onFocus={(e) => {
                  if (toolsReady) {
                    e.target.style.borderColor = '#ffb347';
                  }
                }}
                onBlur={(e) => {
                  e.target.style.borderColor = '#1f3640';
                }}
              />
            </div>
          )}

          {isDownloading && (
            <div style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '12px',
              padding: '0'
            }}>
              <div>
                <div style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  marginBottom: '8px',
                  fontSize: '13px'
                }}>
                  <span style={{ color: '#9fb0b7' }}>
                    {downloadComplete ? 'Download Complete!' : 'Downloading...'}
                  </span>
                  <span style={{
                    color: '#ffb347',
                    fontWeight: '600'
                  }}>
                    {progress}%
                  </span>
                </div>
                <div style={{
                  width: '100%',
                  height: '6px',
                  background: 'rgba(255, 179, 71, 0.2)',
                  borderRadius: '3px',
                  overflow: 'hidden'
                }}>
                  <div style={{
                    height: '100%',
                    width: `${progress}%`,
                    background: 'linear-gradient(90deg, #ffb347, #ff7043)',
                    transition: 'width 0.3s ease',
                    borderRadius: '3px'
                  }} />
                </div>
              </div>

              <div style={{
                display: 'grid',
                gridTemplateColumns: '1fr 1fr',
                gap: '8px'
              }}>
                <div style={{
                  padding: '8px 12px',
                  background: 'rgba(12, 23, 27, 0.6)',
                  border: '1px solid #1f3640',
                  borderRadius: '6px',
                  fontSize: '12px'
                }}>
                  <div style={{ color: '#9fb0b7', marginBottom: '4px' }}>Speed</div>
                  <div style={{
                    color: '#ffb347',
                    fontFamily: 'monospace',
                    fontWeight: '600'
                  }}>
                    {speed}
                  </div>
                </div>
                <div style={{
                  padding: '8px 12px',
                  background: 'rgba(12, 23, 27, 0.6)',
                  border: '1px solid #1f3640',
                  borderRadius: '6px',
                  fontSize: '12px'
                }}>
                  <div style={{ color: '#9fb0b7', marginBottom: '4px' }}>ETA</div>
                  <div style={{
                    color: '#ffb347',
                    fontFamily: 'monospace',
                    fontWeight: '600'
                  }}>
                    {eta}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        <div style={{
          display: 'flex',
          gap: '12px',
          paddingTop: '16px',
          borderTop: '1px solid #1f3640',
          justifyContent: 'flex-end'
        }}>
          {!isDownloading && (
            <button
              className="secondary"
              onClick={handleClose}
              style={{
                minWidth: '100px'
              }}
            >
              Cancel
            </button>
          )}
          {!isDownloading && (
            <button
              className="primary"
              onClick={handleDownload}
              disabled={!toolsReady || !url.trim()}
              style={{
                minWidth: '140px',
                opacity: (!toolsReady || !url.trim()) ? 0.5 : 1,
                cursor: (!toolsReady || !url.trim()) ? 'not-allowed' : 'pointer'
              }}
            >
              Download VOD
            </button>
          )}
          {isDownloading && (
            <button
              className="secondary"
              disabled={true}
              style={{
                minWidth: '140px',
                opacity: 0.6
              }}
            >
              {downloadComplete ? 'Closing...' : 'Downloading...'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
