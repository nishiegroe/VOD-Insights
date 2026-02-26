/**
 * Twitch VOD Download Modal Component
 * Allows users to download Twitch VODs directly in the application
 *
 * Created: 2026-02-26
 */

import React, { useState, useEffect } from 'react';
import '../styles/vod-download-modal.css';

export default function DownloadVODModal({ isOpen, onClose, onDownloadStart }) {
  const [url, setUrl] = useState('');
  const [isDownloading, setIsDownloading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [jobId, setJobId] = useState(null);
  const [error, setError] = useState(null);
  const [speed, setSpeed] = useState('0 B/s');
  const [eta, setEta] = useState('unknown');
  const [toolsReady, setToolsReady] = useState(null);
  const pollIntervalRef = React.useRef(null);

  // Check if tools are ready when modal opens
  useEffect(() => {
    if (isOpen) {
      checkTools();
    }
  }, [isOpen]);

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

    pollIntervalRef.current = setInterval(async () => {
      try {
        const response = await fetch(`/api/vod/progress/${jId}`);
        const data = await response.json();

        if (!response.ok) {
          setError('Failed to get progress');
          clearInterval(pollIntervalRef.current);
          return;
        }

        setProgress(data.percentage || 0);
        setSpeed(data.speed || '0 B/s');
        setEta(data.eta || 'calculating...');

        if (data.status === 'completed') {
          clearInterval(pollIntervalRef.current);
          setIsDownloading(false);
          // Keep modal open for a moment to show completion
          setTimeout(() => {
            handleClose();
          }, 1500);
        } else if (data.status === 'error') {
          clearInterval(pollIntervalRef.current);
          setError(data.error || 'Download failed');
          setIsDownloading(false);
        }
      } catch (err) {
        // Silently ignore polling errors during download
        console.error('Progress fetch error:', err);
      }
    }, 1000);
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
    setSpeed('0 B/s');
    setEta('unknown');
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={handleClose}>
      <div className="modal-content vod-download-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>🎥 Download Twitch VOD</h2>
          <button className="modal-close" onClick={handleClose} disabled={isDownloading}>
            ×
          </button>
        </div>

        <div className="modal-body">
          {error && (
            <div className="error-message">
              <span className="error-icon">⚠️</span>
              <span>{error}</span>
            </div>
          )}

          {toolsReady === false && !error && (
            <div className="warning-message">
              <span className="warning-icon">⚙️</span>
              <span>yt-dlp is not installed. Install with: <code>pip install yt-dlp</code></span>
            </div>
          )}

          <div className="form-group">
            <label htmlFor="vod-url">Twitch VOD URL:</label>
            <input
              id="vod-url"
              type="text"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://twitch.tv/videos/123456789"
              disabled={isDownloading || !toolsReady}
              className="url-input"
              onKeyPress={(e) => {
                if (e.key === 'Enter' && !isDownloading && toolsReady) {
                  handleDownload();
                }
              }}
            />
            <div className="input-help">
              Example: <code>https://twitch.tv/videos/123456789</code>
            </div>
          </div>

          {isDownloading && (
            <div className="progress-container">
              <div className="progress-info">
                <div className="progress-label">
                  <span>Downloading...</span>
                  <span className="progress-percentage">{progress}%</span>
                </div>
                <progress
                  className="progress-bar"
                  value={progress}
                  max="100"
                ></progress>
              </div>

              <div className="progress-details">
                <div className="progress-detail">
                  <span className="detail-label">Speed:</span>
                  <span className="detail-value">{speed}</span>
                </div>
                <div className="progress-detail">
                  <span className="detail-label">ETA:</span>
                  <span className="detail-value">{eta}</span>
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="modal-footer">
          <button
            className="btn btn-secondary"
            onClick={handleClose}
            disabled={isDownloading}
          >
            {isDownloading ? 'Downloading...' : 'Close'}
          </button>
          <button
            className="btn btn-primary"
            onClick={handleDownload}
            disabled={isDownloading || !toolsReady || !url.trim()}
          >
            {isDownloading ? 'Downloading...' : 'Download VOD'}
          </button>
        </div>
      </div>
    </div>
  );
}
