import React, { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import DownloadVODModal from "../components/DownloadVODModal";

export default function Vods({ status }) {
  const WIZARD_STEP_START_SCAN = 1;
  const WIZARD_STEP_LET_IT_RUN = 2;
  const [vods, setVods] = useState([]);
  const [remaining, setRemaining] = useState(0);
  const [loadingAll, setLoadingAll] = useState(false);
  const [splitLoading, setSplitLoading] = useState({});
  const [toast, setToast] = useState(null);
  const [showAll, setShowAll] = useState(false);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [showDownloadModal, setShowDownloadModal] = useState(false);
  const [uploadState, setUploadState] = useState({
    fileName: "No file selected",
    progress: 0,
    status: "Waiting for upload...",
    uploading: false,
  });
  const [recordingDir, setRecordingDir] = useState(null);
  const [configLoaded, setConfigLoaded] = useState(false);
  const [wizardCompleted, setWizardCompleted] = useState(null);
  const [wizardVisible, setWizardVisible] = useState(false);
  const [wizardStep, setWizardStep] = useState(0);
  const [wizardSpotlightRect, setWizardSpotlightRect] = useState(null);
  const [wizardPanelStyle, setWizardPanelStyle] = useState(null);
  const navigate = useNavigate();
  const eventSourceRef = useRef(null);
  const fileInputRef = useRef(null);
  const dropRef = useRef(null);
  const toastTimerRef = useRef(null);

  const completeWizard = async () => {
    setWizardCompleted(true);
    setWizardVisible(false);
    try {
      await fetch("/api/config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ wizard_vods_completed: true }),
      });
    } catch (error) {
      // Ignore persistence errors.
    }
  };

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

  const resetWizardForDev = async () => {
    try {
      const response = await fetch("/api/config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ wizard_vods_completed: false }),
      });
      if (!response.ok) {
        throw new Error("Failed to reset wizard state.");
      }
      setWizardCompleted(false);
      setWizardStep(0);
      setWizardVisible(true);
      showToast("Wizard reset.", "info");
    } catch (error) {
      showToast(error.message || "Failed to reset wizard state.");
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
    setWizardCompleted(Boolean(config.ui?.vods_wizard_completed));
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
    if (!configLoaded || wizardCompleted === null) {
      return;
    }
    if (wizardCompleted) {
      return;
    }
    setWizardVisible(true);
    setWizardStep(0);
  }, [configLoaded, wizardCompleted]);

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
    const label = vod.display_title || vod.pretty_time || vod.name || "this VOD";
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
    if (wizardVisible && wizardStep === WIZARD_STEP_START_SCAN) {
      setWizardStep(WIZARD_STEP_LET_IT_RUN);
    }
    try {
      if (vod.scanned) {
        const clearResponse = await fetch("/api/delete-sessions", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ vod_path: vod.path }),
        });
        if (!clearResponse.ok) {
          throw new Error("Failed to clear previous scan results.");
        }
      }

      setVods((prev) =>
        prev.map((item) =>
          item.path === vod.path
            ? { ...item, scanning: true, scan_progress: 0, scanned: false, sessions: [] }
            : item
        )
      );

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

  const hasScanStarted = useMemo(
    () => vods.some((item) => item.scanning || item.paused || item.scanned),
    [vods]
  );

  const hasScanResults = useMemo(
    () => vods.some((item) => item.scanned && item.sessions && item.sessions.length > 0),
    [vods]
  );

  const wizardSteps = [
    {
      title: "Welcome",
      body: "This quick setup shows you how to get from raw recordings to viewable events and clips.",
      ready: true,
      targetSelector: null,
    },
    {
      title: "Start a scan",
      body: "On a VOD card, click Scan. This analyzes the video and detects events to build sessions.",
      body2:
        "Because this app uses image text recognition, you can customize it in Settings with the 'Capture Area' tool and 'Detection Keywords' options to tune it for other games.",
      ready: hasScanStarted,
      targetSelector: ".vod-item .vod-scan-trigger",
    },
    {
      title: "Let it run",
      body: "Scanning can take a while, especially on longer videos. You can monitor progress in the status bar.",
      body2: "For faster processing, turn on GPU OCR in Settings if you have a supported GPU.",
      ready: hasScanResults,
      targetSelector: ".vod-item .vod-scan-row",
    },
    {
      title: "View and clip",
      body: "When scan results are ready, you can watch back the vod, or view your clips!",
      details: [
        "'Watch VOD' opens a video player with your VOD's events highlighted.",
        "'Split into clips' creates clips from the events detected during scan.",
      ],
      ready: hasScanResults,
      targetSelector: ".vod-item .vod-primary-actions",
    },
  ];

  const currentWizard = wizardSteps[wizardStep];
  const isLastWizardStep = wizardStep === wizardSteps.length - 1;

  useEffect(() => {
    if (!wizardVisible) {
      setWizardSpotlightRect(null);
      setWizardPanelStyle(null);
      return;
    }

    const updateWizardPosition = () => {
      const selector = currentWizard?.targetSelector;
      if (!selector) {
        setWizardSpotlightRect(null);
        setWizardPanelStyle(null);
        return;
      }

      const target = document.querySelector(selector);
      if (!target) {
        setWizardSpotlightRect(null);
        setWizardPanelStyle(null);
        return;
      }

      const rect = target.getBoundingClientRect();
      const padding = 8;
      const viewportWidth = window.innerWidth;
      const viewportHeight = window.innerHeight;
      const spotlight = {
        top: Math.max(8, rect.top - padding),
        left: Math.max(8, rect.left - padding),
        width: Math.min(viewportWidth - 16, rect.width + padding * 2),
        height: Math.min(viewportHeight - 16, rect.height + padding * 2),
      };

      const panelWidth = Math.min(460, viewportWidth - 24);
      const estimatedPanelHeight = 290;
      let panelLeft = spotlight.left;
      if (panelLeft + panelWidth > viewportWidth - 12) {
        panelLeft = viewportWidth - panelWidth - 12;
      }
      panelLeft = Math.max(12, panelLeft);

      let panelTop = spotlight.top + spotlight.height + 12;
      if (panelTop + estimatedPanelHeight > viewportHeight - 12) {
        panelTop = Math.max(12, spotlight.top - estimatedPanelHeight - 12);
      }

      setWizardSpotlightRect(spotlight);
      setWizardPanelStyle({
        top: `${panelTop}px`,
        left: `${panelLeft}px`,
        width: `${panelWidth}px`,
      });
    };

    updateWizardPosition();
    window.addEventListener("resize", updateWizardPosition);
    window.addEventListener("scroll", updateWizardPosition, true);
    return () => {
      window.removeEventListener("resize", updateWizardPosition);
      window.removeEventListener("scroll", updateWizardPosition, true);
    };
  }, [wizardVisible, currentWizard, vods, recordingDir, showAll]);

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
          <h2 className="brand-title brand-title-welcome">
            <img src="/logo.png" alt="" className="brand-logo brand-logo-welcome" aria-hidden="true" />
            <span>Welcome to VOD Insights!</span>
          </h2>
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
                  <>
                    <button
                      type="button"
                      className="secondary button-compact"
                      onClick={resetWizardForDev}
                    >
                      Reset Wizard
                    </button>
                    <button
                      type="button"
                      className="secondary button-compact"
                      onClick={openBackendLog}
                    >
                      Open App Log
                    </button>
                  </>
                ) : null}
                <button
                  type="button"
                  className="secondary button-compact"
                  onClick={() => setShowDownloadModal(true)}
                  title="Download Twitch VOD"
                  style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="currentColor" style={{ flexShrink: 0 }}>
                    <path d="M11.571 4.714h1.715v5.143H11.57zm4.715 0H18v5.143h-1.714zM6 0L1.714 4.286v15.428h5.143V24l4.286-4.286h3.428L22.286 12V0zm14.571 11.143l-3.428 3.428h-3.429l-3 3v-3H6.857V1.714h13.714z"/>
                  </svg>
                  Download VOD
                </button>
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
            {vods.map((vod) => {
              const splitNeedsScan = !vod.scanned || !vod.sessions || !vod.sessions.length;
              const splitDisabled =
                splitNeedsScan || splitLoading[vod.path] || (vod.scanning && !vod.paused);

              return (
              <div className="vod-item" key={vod.path}>
                <div className="vod-preview">
                  {vod.thumbnail_url ? (
                    <img src={vod.thumbnail_url} alt="VOD event thumbnail" loading="lazy" />
                  ) : (
                    <video controls preload="none" src={`/vod-media/${vod.name}`}></video>
                  )}
                </div>
                <div className="vod-info">
                  <div className="vod-title-row">
                    <div className="vod-name">{vod.display_title || vod.pretty_time || vod.name}</div>
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
                  <div className="vod-primary-actions">
                    <button
                      type="button"
                      className={`${vod.scanning || !vod.scanned ? "secondary" : "primary"} vod-action-button`}
                      onClick={() => {
                        const sessionPath = vod.sessions?.[0]?.path;
                        const base = `/vods/view?path=${encodeURIComponent(vod.path)}`;
                        const target = sessionPath
                          ? `${base}&session=${encodeURIComponent(sessionPath)}`
                          : base;
                        navigate(target);
                      }}
                    >
                      Watch VOD
                    </button>
                    <span
                      title={splitNeedsScan ? "Scan this VOD first to enable clipping." : ""}
                      style={{ display: "contents" }}
                    >
                      <button
                        type="button"
                        className="secondary vod-action-button"
                        disabled={splitDisabled}
                        onClick={() => handleSplit(vod)}
                      >
                        {splitLoading[vod.path] ? "Splitting..." : "Split into clips"}
                      </button>
                    </span>
                  </div>
                  <div style={{ display: "flex", gap: "8px", width: "100%", flexWrap: "wrap" }}>
                    <button
                      type="button"
                      className={`${vod.scanning || vod.paused || !vod.scanned ? "primary" : "tertiary"} vod-action-button vod-scan-trigger`}
                      onClick={() => handleScan(vod)}
                      disabled={vod.scanning || vod.paused}
                      style={{ flex: "1 1 auto", minWidth: "110px" }}
                    >
                      {vod.paused ? "Paused" : vod.scanning ? "Scanning..." : vod.scanned ? "Rescan" : "Scan"}
                    </button>
                    {(vod.scanning || vod.paused) && (
                      <button
                        type="button"
                        className="danger"
                        style={{ flex: "1 1 auto", height: "44px", minWidth: "80px" }}
                        onClick={() => handleStopScan(vod)}
                        title={vod.paused ? "Stop and discard paused scan" : "Stop scanning"}
                      >
                        Stop
                      </button>
                    )}
                  </div>
                </div>
              </div>
              );
            })}
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

      <DownloadVODModal
        isOpen={showDownloadModal}
        onClose={() => setShowDownloadModal(false)}
        onDownloadStart={() => {
          setShowDownloadModal(false);
        }}
      />

      {wizardVisible ? (
        <div
          className={`onboarding-overlay ${wizardSpotlightRect ? "has-target" : ""}`}
          role="dialog"
          aria-modal="true"
          aria-label="First-time VOD setup guide"
        >
          {wizardSpotlightRect ? (
            <div
              className="onboarding-spotlight"
              style={{
                top: `${wizardSpotlightRect.top}px`,
                left: `${wizardSpotlightRect.left}px`,
                width: `${wizardSpotlightRect.width}px`,
                height: `${wizardSpotlightRect.height}px`,
              }}
            ></div>
          ) : null}
          <div
            className={`onboarding-panel ${wizardSpotlightRect ? "floating" : "centered"}`}
            style={wizardPanelStyle || undefined}
          >
            <div className="onboarding-header">
              <h3>First-time setup guide</h3>
            </div>
            <div className="onboarding-step">Step {wizardStep + 1} of {wizardSteps.length}</div>
            <h4>{currentWizard.title}</h4>
            <p>{currentWizard.body}</p>
            {currentWizard.body2 ? <p>{currentWizard.body2}</p> : null}
            {Array.isArray(currentWizard.details) && currentWizard.details.length ? (
              <ul className="onboarding-list">
                {currentWizard.details.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            ) : null}
            <div className="onboarding-actions">
              <button
                type="button"
                className="secondary"
                onClick={completeWizard}
              >
                Skip
              </button>
              <button
                type="button"
                className="secondary"
                onClick={() => setWizardStep((prev) => Math.max(0, prev - 1))}
                disabled={wizardStep === 0}
              >
                Back
              </button>
              {isLastWizardStep ? (
                <button
                  type="button"
                  className="primary"
                  onClick={completeWizard}
                  disabled={!currentWizard.ready}
                >
                  Finish
                </button>
              ) : (
                <button
                  type="button"
                  className="primary"
                  onClick={() => setWizardStep((prev) => Math.min(wizardSteps.length - 1, prev + 1))}
                  disabled={!currentWizard.ready}
                >
                  Next
                </button>
              )}
            </div>
          </div>
        </div>
      ) : null}
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
