import React, { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";

export default function Vods({ status }) {
  const [vods, setVods] = useState([]);
  const [remaining, setRemaining] = useState(0);
  const [loadingAll, setLoadingAll] = useState(false);
  const [splitLoading, setSplitLoading] = useState({});
  const [toast, setToast] = useState(null);
  const [showAll, setShowAll] = useState(false);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [uploadState, setUploadState] = useState({
    fileName: "No file selected",
    progress: 0,
    status: "Waiting for upload...",
    uploading: false,
  });
  const [recordingDir, setRecordingDir] = useState(null);
  const [configLoaded, setConfigLoaded] = useState(false);
  const navigate = useNavigate();
  const eventSourceRef = useRef(null);
  const fileInputRef = useRef(null);
  const dropRef = useRef(null);
  const toastTimerRef = useRef(null);

  const showToast = (message, type = "error", action = null) => {
    if (toastTimerRef.current) {
      clearTimeout(toastTimerRef.current);
    }
    setToast({ message, type, action });
    toastTimerRef.current = setTimeout(() => {
      setToast(null);
    }, 4000);
  };

  const openBackendLog = async () => {
    try {
      await fetch("/api/open-backend-log", { method: "POST" });
    } catch (error) {
      // Ignore log open failures.
    }
  };

  const loadVods = async (all = showAll) => {
    const endpoint = all ? "/api/vods?all=1" : "/api/vods";
    const response = await fetch(endpoint);
    const payload = await response.json();
    setVods(payload.vods || []);
    setRemaining(payload.remaining_count || 0);
    return payload;
  };

  const loadConfig = async () => {
    const configRes = await fetch("/api/config");
    const config = await configRes.json();
    const replayDir = config.replay?.directory || "";
    setRecordingDir(replayDir);
    setConfigLoaded(true);
    return replayDir;
  };

  useEffect(() => {
    const init = async () => {
      const replayDir = await loadConfig();
      if (replayDir) {
        await loadVods(false);
      }
    };
    init().catch(() => {});
  }, []);

  useEffect(() => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
    }

    // Only start EventSource if recording directory is configured
    if (!recordingDir) {
      return;
    }

    const params = new URLSearchParams();
    if (showAll) {
      params.set("all", "1");
    }
    const source = new EventSource(`/api/vods/stream?${params.toString()}`);
    eventSourceRef.current = source;

    source.onmessage = (event) => {
      try {
        const payload = JSON.parse(event.data);
        setVods(payload.vods || []);
        setRemaining(payload.remaining_count || 0);
      } catch (error) {
        // Ignore invalid payloads.
      }
    };

    source.onerror = () => {
      source.close();
      eventSourceRef.current = null;
      setTimeout(() => {
        loadVods(showAll).catch(() => {});
      }, 3000);
    };

    return () => {
      source.close();
      eventSourceRef.current = null;
    };
  }, [showAll, recordingDir]);

  const handleLoadAll = async () => {
    setLoadingAll(true);
    setShowAll(true);
    await loadVods(true);
    setLoadingAll(false);
  };

  const handleSplit = async (vod) => {
    const sessionPath = vod.sessions?.[0] && vod.sessions[0].path;
    if (!sessionPath) return;
    setSplitLoading((prev) => ({ ...prev, [vod.path]: true }));
    try {
      const response = await fetch("/api/split-selected", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ vod_path: vod.path, session_path: sessionPath }),
      });
      if (response.ok) {
        navigate("/clips");
      }
    } finally {
      setSplitLoading((prev) => ({ ...prev, [vod.path]: false }));
    }
  };

  const handleDeleteVod = async (vod) => {
    const label = vod.pretty_time || vod.name || "this VOD";
    const confirmed = window.confirm(`Delete ${label}? This will remove the file from disk.`);
    if (!confirmed) return;
    try {
      const response = await fetch("/api/vods/delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ path: vod.path }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok || payload.ok === false) {
        throw new Error(payload.error || "Failed to delete VOD");
      }
      await loadVods(showAll);
    } catch (error) {
      showToast(error.message || "Failed to delete VOD");
    }
  };

  const formatDuration = (seconds) => {
    if (!Number.isFinite(seconds) || seconds <= 0) return "";
    const total = Math.round(seconds);
    const hrs = Math.floor(total / 3600);
    const mins = Math.floor((total % 3600) / 60);
    const secs = total % 60;
    const parts = [];
    if (hrs > 0) parts.push(`${hrs} hr`);
    if (mins > 0 || hrs > 0) parts.push(`${mins} min`);
    parts.push(`${secs} sec`);
    return parts.join(" ");
  };

  const handleScan = async (vod) => {
    setVods((prev) =>
      prev.map((item) =>
        item.path === vod.path ? { ...item, scanning: true, scan_progress: 0 } : item
      )
    );
    try {
      const response = await fetch("/api/vod-ocr", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ vod_path: vod.path }),
      });
      if (!response.ok) {
        throw new Error("Scan request failed.");
      }
      setTimeout(async () => {
        try {
          const payload = await loadVods(showAll);
          const updated = (payload.vods || []).find((item) => item.path === vod.path);
          if (updated && (updated.scanning || updated.scanned)) {
            return;
          }
          showToast("Scan did not start. Click to open the backend log.", "error", "open-backend-log");
        } catch (error) {
          showToast("Unable to confirm scan status.");
        }
      }, 1500);
    } catch (error) {
      setVods((prev) =>
        prev.map((item) =>
          item.path === vod.path ? { ...item, scanning: false } : item
        )
      );
      showToast("Failed to start scan. Please try again.");
    }
  };

  const handleStopScan = async (vod) => {
    try {
      const response = await fetch("/api/stop-vod-ocr", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ vod_path: vod.path }),
      });
      if (response.ok) {
        showToast("Scan stopped.");
        // Reload VODs to sync state from server
        const payload = await loadVods(showAll);
        setVods(payload.vods || []);
      } else {
        const error = await response.json();
        showToast(`Failed to stop scan: ${error.error || "Unknown error"}`);
      }
    } catch (error) {
      console.error("Stop scan error:", error);
      showToast("Failed to stop scan.");
    }
  };

  const handlePauseScan = async (vod) => {
    try {
      const response = await fetch("/api/pause-vod-ocr", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ vod_path: vod.path }),
      });
      if (response.ok) {
        showToast("Scan paused.");
        // Reload VODs to sync state from server
        const payload = await loadVods(showAll);
        setVods(payload.vods || []);
      } else {
        const error = await response.json();
        showToast(`Failed to pause scan: ${error.error || "Unknown error"}`);
      }
    } catch (error) {
      console.error("Pause scan error:", error);
      showToast("Failed to pause scan.");
    }
  };

  const handleResumeScan = async (vod) => {
    try {
      const response = await fetch("/api/resume-vod-ocr", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ vod_path: vod.path }),
      });
      if (response.ok) {
        showToast("Scan resumed.");
        // Reload VODs to sync state from server
        const payload = await loadVods(showAll);
        setVods(payload.vods || []);
      } else {
        const error = await response.json();
        showToast(`Failed to resume scan: ${error.error || "Unknown error"}`);
      }
    } catch (error) {
      console.error("Resume scan error:", error);
      showToast("Failed to resume scan.");
    }
  };

  const handleDeleteSessions = async (vod) => {
    try {
      const response = await fetch("/api/delete-sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ vod_path: vod.path }),
      });
      if (response.ok) {
        setVods((prev) =>
          prev.map((item) =>
            item.path === vod.path ? { ...item, scanned: false, sessions: [] } : item
          )
        );
        showToast("Sessions deleted.");
      } else {
        showToast("Failed to delete sessions.");
      }
    } catch (error) {
      showToast("Failed to delete sessions.");
    }
  };

  const handleConfigureDirectory = async () => {
    const response = await fetch("/api/choose-replay-dir", { method: "POST" });
    const payload = await response.json();
    if (payload.directory) {
      setRecordingDir(payload.directory);
      await loadVods(false);
    }
  };

  const canUpload = useMemo(() => {
    const fileInput = fileInputRef.current;
    return Boolean(fileInput && fileInput.files && fileInput.files[0] && !uploadState.uploading);
  }, [uploadState.uploading]);

  const updateFile = (file) => {
    if (!file) {
      setUploadState({
        fileName: "No file selected",
        progress: 0,
        status: "Waiting for upload...",
        uploading: false,
      });
      return;
    }
    setUploadState({
      fileName: file.name,
      progress: 0,
      status: "Ready to upload.",
      uploading: false,
    });
  };

  const handleFileChange = (event) => {
    const file = event.target.files && event.target.files[0];
    updateFile(file || null);
  };

  const handleDrop = (event) => {
    event.preventDefault();
    const files = event.dataTransfer && event.dataTransfer.files;
    if (!files || !files.length) return;
    if (fileInputRef.current) {
      fileInputRef.current.files = files;
    }
    updateFile(files[0]);
    dropRef.current?.classList.remove("dragging");
  };

  const handleUpload = (event) => {
    event.preventDefault();
    const fileInput = fileInputRef.current;
    const file = fileInput && fileInput.files && fileInput.files[0];
    if (!file) {
      updateFile(null);
      return;
    }

    setUploadState({
      fileName: file.name,
      progress: 0,
      status: "Uploading...",
      uploading: true,
    });

    const formData = new FormData();
    formData.append("vod_file", file);

    const xhr = new XMLHttpRequest();
    xhr.open("POST", "/api/vod-ocr-upload");

    xhr.upload.addEventListener("progress", (evt) => {
      if (!evt.lengthComputable) return;
      const percent = Math.round((evt.loaded / evt.total) * 100);
      setUploadState((prev) => ({
        ...prev,
        progress: percent,
        status: `Uploading... ${percent}%`,
      }));
    });

    xhr.addEventListener("load", () => {
      if (xhr.status >= 200 && xhr.status < 400) {
        setUploadState((prev) => ({
          ...prev,
          progress: 100,
          status: "Upload complete. Starting scan...",
          uploading: false,
        }));
        setShowUploadModal(false);
        loadVods(showAll).catch(() => {});
        return;
      }
      setUploadState((prev) => ({
        ...prev,
        status: "Upload failed. Please try again.",
        uploading: false,
      }));
    });

    xhr.addEventListener("error", () => {
      setUploadState((prev) => ({
        ...prev,
        status: "Upload failed. Please try again.",
        uploading: false,
      }));
    });

    xhr.send(formData);
  };

  const handleDropEnter = (event) => {
    event.preventDefault();
    dropRef.current?.classList.add("dragging");
  };

  const handleDropLeave = (event) => {
    event.preventDefault();
    dropRef.current?.classList.remove("dragging");
  };

  if (!configLoaded) {
    return null; // Don't render anything until config is loaded
  }

  return (
    <section className="grid">
      {!recordingDir ? (
        <section className="card centered" style={{ padding: '3rem 2rem' }}>
          <h2>Welcome to VOD Insights!</h2>
          <p style={{ fontSize: '1.1rem', marginBottom: '1.5rem', color: 'var(--text-secondary)' }}>
            To get started, you need to configure where your Apex Legends recordings are stored.
          </p>
          <p style={{ marginBottom: '2rem', color: 'var(--text-secondary)' }}>
            Point the app to your recordings directory, and it will automatically detect and list your VODs.
            No need to manually import files!
          </p>
          <button
            type="button"
            className="primary"
            style={{ fontSize: '1.1rem', padding: '0.75rem 2rem' }}
            onClick={handleConfigureDirectory}
          >
            Choose VOD Directory
          </button>
        </section>
      ) : (
        <div className="card">
            <div className="card-header-with-actions">
              <h2>Recordings</h2>
              <div className="card-header-actions">
                {status?.dev_mode ? (
                  <button
                    type="button"
                    className="secondary button-compact"
                    onClick={openBackendLog}
                  >
                    Open App Log
                  </button>
                ) : null}
                <button
                  type="button"
                  className="icon-button"
                  onClick={() => setShowUploadModal(true)}
                  title="Upload VOD"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                    <polyline points="17 8 12 3 7 8"></polyline>
                    <line x1="12" y1="3" x2="12" y2="15"></line>
                  </svg>
                </button>
              </div>
            </div>
            {vods.length === 0 ? (
              <p className="hint">No recordings found.</p>
            ) : (
          <div className="vod-list">
            {vods.map((vod) => (
              <div className="vod-item" key={vod.path}>
                <div className="vod-preview">
                  {vod.thumbnail_url ? (
                    <img src={vod.thumbnail_url} alt="VOD event thumbnail" loading="lazy" />
                  ) : (
                    <video controls preload="metadata" src={`/vod-media/${vod.name}`}></video>
                  )}
                </div>
                <div className="vod-info">
                  <div className="vod-title-row">
                    <div className="vod-name">{vod.pretty_time || vod.name}</div>
                    <button
                      type="button"
                      className="icon-button danger vod-delete"
                      onClick={() => handleDeleteVod(vod)}
                      title="Delete VOD"
                      aria-label={`Delete ${vod.pretty_time || vod.name || "VOD"}`}
                      disabled={vod.scanning && !vod.paused}
                    >
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                        <path
                          d="M3 6h18M9 6V4h6v2m-7 4v8m4-8v8m4-8v8"
                          stroke="currentColor"
                          strokeWidth="1.5"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                        <path
                          d="M6 6l1 14h10l1-14"
                          stroke="currentColor"
                          strokeWidth="1.5"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                    </button>
                  </div>
                  <div className="vod-scan-row">
                    <div className="vod-scan">
                      <span
                        className={`led ${vod.scanning && !vod.paused ? "scanning" : vod.scanned ? "on" : vod.paused ? "paused" : "off"}`}
                      ></span>
                      {vod.paused ? "Paused" : vod.scanning ? "Scanning..." : vod.scanned ? "Scanned" : "Not scanned"}
                    </div>
                    {(vod.scanning || vod.paused) && vod.scan_progress != null && (
                      <>
                        <div className="scan-progress" aria-label="Scan progress">
                          <div
                            className="scan-progress-bar"
                            style={{ width: `${vod.scan_progress}%` }}
                          ></div>
                        </div>
                        <div className="scan-progress-text">{vod.scan_progress}%</div>
                      </>
                    )}
                  </div>
                  <div className="vod-meta">{vod.name}</div>
                  <div className="vod-meta">{vod.path}</div>
                  {vod.duration ? (
                    <div className="vod-meta">Duration: {formatDuration(vod.duration)}</div>
                  ) : null}
                </div>
                <div className="vod-actions">
                  <button
                    type="button"
                    className="primary vod-action-button"
                    disabled={!vod.scanned || !vod.sessions || !vod.sessions.length || (vod.scanning && !vod.paused)}
                    onClick={() => {
                      const sessionPath = vod.sessions?.[0]?.path;
                      if (sessionPath) {
                        navigate(`/vods/view?path=${encodeURIComponent(vod.path)}&session=${encodeURIComponent(sessionPath)}`);
                      }
                    }}
                  >
                    View
                  </button>
                  <button
                    type="button"
                    className="secondary vod-action-button"
                    disabled={!vod.scanned || !vod.sessions || !vod.sessions.length || splitLoading[vod.path] || (vod.scanning && !vod.paused)}
                    onClick={() => handleSplit(vod)}
                  >
                    {splitLoading[vod.path] ? "Splitting..." : "Split Clips"}
                  </button>
                  <div style={{ display: "flex", gap: "8px", width: "100%", flexWrap: "wrap" }}>
                    {vod.paused ? (
                      <button
                        type="button"
                        className="primary vod-action-button"
                        onClick={() => handleResumeScan(vod)}
                        style={{ flex: "1 1 auto", minWidth: "110px" }}
                      >
                        Resume
                      </button>
                    ) : (
                      <button
                        type="button"
                        className={vod.scanned ? "secondary vod-action-button" : "primary vod-action-button"}
                        onClick={() => handleScan(vod)}
                        disabled={vod.scanning}
                        style={{ flex: "1 1 auto", minWidth: "110px" }}
                      >
                        {vod.scanning ? "Scanning..." : vod.scanned ? "Rescan" : "Scan"}
                      </button>
                    )}
                    {vod.scanning && !vod.paused && (
                      <>
                        <button
                          type="button"
                          className="secondary"
                          style={{ flex: "1 1 auto", height: "44px", minWidth: "90px" }}
                          onClick={() => handlePauseScan(vod)}
                          title="Pause scanning"
                        >
                          Pause
                        </button>
                        <button
                          type="button"
                          className="danger"
                          style={{ flex: "1 1 auto", height: "44px", minWidth: "80px" }}
                          onClick={() => handleStopScan(vod)}
                          title="Stop scanning"
                        >
                          Stop
                        </button>
                      </>
                    )}
                    {vod.paused && (
                      <button
                        type="button"
                        className="danger"
                        style={{ flex: "1 1 auto", height: "44px", minWidth: "80px" }}
                        onClick={() => handleStopScan(vod)}
                        title="Stop and discard paused scan"
                      >
                        Stop
                      </button>
                    )}
                    {vod.scanned && !vod.scanning && !vod.paused && (
                      <button
                        type="button"
                        className="danger"
                        style={{ flex: "1 1 auto", height: "44px", minWidth: "100px" }}
                        onClick={() => handleDeleteSessions(vod)}
                        title="Delete scan results"
                      >
                        Delete
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
        {remaining > 0 && (
          <div className="vod-load">
            <button type="button" className="secondary" onClick={handleLoadAll} disabled={loadingAll}>
              {loadingAll ? "Loading..." : `Load all (${remaining} more)`}
            </button>
            <div className={`spinner ${loadingAll ? "active" : ""}`}></div>
          </div>
        )}
        </div>
      )}

      {showUploadModal && (
        <div className="modal-overlay" onClick={() => setShowUploadModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Upload & Scan VOD</h2>
              <button
                className="modal-close"
                onClick={() => setShowUploadModal(false)}
                title="Close"
              >
                ×
              </button>
            </div>
            <form onSubmit={handleUpload}>
              <div
                className="file-drop"
                ref={dropRef}
                onClick={() => fileInputRef.current?.click()}
                onDrop={handleDrop}
                onDragOver={handleDropEnter}
                onDragEnter={handleDropEnter}
                onDragLeave={handleDropLeave}
              >
                <div className="file-drop-title">Drag & drop a VOD here</div>
                <div className="file-drop-subtitle">or click to choose a file</div>
                <div className="file-drop-name">{uploadState.fileName}</div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="video/*"
                  onChange={handleFileChange}
                  required
                />
              </div>
              <div
                className={`upload-progress ${uploadState.uploading ? "active" : ""}`}
                aria-live="polite"
              >
                <div
                  className="upload-progress-bar"
                  style={{ width: `${uploadState.progress}%` }}
                ></div>
                <div className="upload-progress-text">{uploadState.status}</div>
              </div>
              <p className="hint">
                Uploads the VOD to the recordings folder, then scans automatically.
              </p>
              <div className="button-row">
                <button type="submit" className="primary" disabled={!canUpload}>
                  Upload & Scan
                </button>
                <button
                  type="button"
                  className="secondary"
                  onClick={() => setShowUploadModal(false)}
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {toast ? (
        <div className="toast-container" role="status" aria-live="polite">
          <button
            type="button"
            className={`toast ${toast.type}`}
            onClick={async () => {
              if (toast.action === "open-backend-log") {
                await openBackendLog();
              }
              setToast(null);
            }}
          >
            {toast.message}
          </button>
        </div>
      ) : null}
    </section>
  );
}
