import React, { useEffect, useMemo, useRef, useState } from "react";

const toCommaList = (value) => (Array.isArray(value) ? value.join(", ") : "");
const parseKeywords = (value) =>
  String(value || "")
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);

export default function Settings({ status }) {
  const showSessionRecorder = false;
  const [form, setForm] = useState(null);
  const [saveState, setSaveState] = useState("idle");
  const [saveError, setSaveError] = useState("");
  const [checkingLatest, setCheckingLatest] = useState(false);
  const [checkingUpdates, setCheckingUpdates] = useState(false);
  const [currentVersion, setCurrentVersion] = useState("");
  const [latestVersion, setLatestVersion] = useState("");
  const [updateAvailable, setUpdateAvailable] = useState(false);
  const [latestError, setLatestError] = useState("");
  const [updateMessage, setUpdateMessage] = useState("");
  const [gpuStatus, setGpuStatus] = useState("");
  const [gpuTesting, setGpuTesting] = useState(false);
  const [newKeyword, setNewKeyword] = useState("");
  const [activeSection, setActiveSection] = useState("capture");
  const [overlayUploading, setOverlayUploading] = useState(false);
  const [overlayStatus, setOverlayStatus] = useState("");

  const replaceFileInputRef = useRef(null);
  const autosaveTimerRef = useRef(null);
  const saveStateTimerRef = useRef(null);
  const didHydrateRef = useRef(false);
  const lastSavedPayloadRef = useRef("");
  const sectionRefs = useRef({});

  const obsConnected = status?.obs_connected ?? false;
  const isDesktop = Boolean(window?.aetDesktop);
  const canUpdateApp = Boolean(window?.aetDesktop?.updateApp);
  const canBrowseReplayDir = isDesktop;

  const loadData = async () => {
    const configResponse = await fetch("/api/config");
    const config = await configResponse.json();
    const nextForm = {
      capture_left: config.capture?.left ?? 0,
      capture_top: config.capture?.top ?? 0,
      capture_width: config.capture?.width ?? 0,
      capture_height: config.capture?.height ?? 0,
      capture_fps: config.capture?.fps ?? 30,
      capture_scale: config.capture?.scale ?? 1,
      capture_threshold: config.capture?.threshold ?? 0,
      capture_backend: config.capture?.backend ?? "auto",
      ocr_interval: config.ocr?.interval_seconds ?? 1,
      ocr_engine: config.ocr?.engine ?? "tesseract",
      detection_keywords: toCommaList(config.detection?.keywords),
      detection_cooldown: config.detection?.cooldown_seconds ?? 2,
      record_start: config.recording?.start_on_launch ?? false,
      record_stop: config.recording?.stop_on_exit ?? false,
      record_split: config.recording?.run_split_on_exit ?? false,
      replay_dir: config.replay?.directory ?? "",
      split_pre: config.split?.pre_seconds ?? 0,
      split_post: config.split?.post_seconds ?? 0,
      split_event_windows: config.split?.event_windows ?? {},
      overlay_image_path: config.ui?.overlay_image_path ?? "",
      overlay_enabled: config.ui?.overlay_enabled !== false,
      overlay_opacity: Number.isFinite(Number(config.ui?.overlay_opacity)) ? Number(config.ui.overlay_opacity) : 0.9,
    };
    setForm(nextForm);
    lastSavedPayloadRef.current = JSON.stringify(nextForm);
    didHydrateRef.current = true;
    setSaveState("idle");
    setSaveError("");
  };

  const updateField = (field, value) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const updateKeywords = (keywords) => {
    setForm((prev) => {
      const existing = prev?.split_event_windows || {};
      const nextWindows = {};
      const fallbackPre = Number(prev?.split_pre ?? 0);
      const fallbackPost = Number(prev?.split_post ?? 0);

      keywords.forEach((keyword) => {
        const current = existing[keyword] || {};
        nextWindows[keyword] = {
          pre_seconds: Number(current.pre_seconds ?? fallbackPre),
          post_seconds: Number(current.post_seconds ?? fallbackPost),
        };
      });

      return {
        ...prev,
        detection_keywords: keywords.join(", "),
        split_event_windows: nextWindows,
      };
    });
  };

  const updateKeywordWindow = (keyword, field, value) => {
    setForm((prev) => {
      const windows = { ...(prev?.split_event_windows || {}) };
      const current = windows[keyword] || {
        pre_seconds: Number(prev?.split_pre ?? 0),
        post_seconds: Number(prev?.split_post ?? 0),
      };
      windows[keyword] = {
        ...current,
        [field]: value,
      };
      return {
        ...prev,
        split_event_windows: windows,
      };
    });
  };

  const addKeyword = () => {
    const candidate = newKeyword.trim();
    if (!candidate) {
      return;
    }
    const existing = parseKeywords(form?.detection_keywords || "");
    const exists = existing.some((keyword) => keyword.toLowerCase() === candidate.toLowerCase());
    if (exists) {
      setNewKeyword("");
      return;
    }
    updateKeywords([...existing, candidate]);
    setNewKeyword("");
  };

  const removeKeyword = (keywordToRemove) => {
    const existing = parseKeywords(form?.detection_keywords || "");
    updateKeywords(existing.filter((keyword) => keyword !== keywordToRemove));
  };

  const saveConfig = async (nextForm) => {
    const payload = JSON.stringify(nextForm);
    if (payload === lastSavedPayloadRef.current) {
      return;
    }

    setSaveState("saving");
    setSaveError("");

    try {
      const response = await fetch("/api/config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: payload,
      });
      if (!response.ok) {
        throw new Error("Failed to save settings");
      }
      lastSavedPayloadRef.current = payload;
      setSaveState("saved");
      clearTimeout(saveStateTimerRef.current);
      saveStateTimerRef.current = setTimeout(() => {
        setSaveState("idle");
      }, 1400);
    } catch (error) {
      setSaveState("error");
      setSaveError(error?.message || "Failed to save settings");
    }
  };

  const browseReplayDir = async () => {
    if (!canBrowseReplayDir) {
      return;
    }
    const response = await fetch("/api/choose-replay-dir", { method: "POST" });
    const payload = await response.json();
    if (payload.directory && form) {
      updateField("replay_dir", payload.directory);
    }
  };

  const startSession = async () => {
    await fetch("/api/control/start", { method: "POST" });
  };

  const stopSession = async () => {
    await fetch("/api/control/stop", { method: "POST" });
  };

  const testGpuOcr = async () => {
    setGpuTesting(true);
    setGpuStatus("");
    try {
      const response = await fetch("/api/ocr-gpu-status");
      const payload = await response.json();
      if (!response.ok || !payload.ok) {
        setGpuStatus(payload.error || "GPU check failed");
      } else if (payload.available) {
        setGpuStatus("✓ CUDA GPU detected");
      } else {
        setGpuStatus("✗ No CUDA GPU detected");
      }
    } catch (error) {
      setGpuStatus(error.message || "GPU check failed");
    } finally {
      setGpuTesting(false);
    }
  };

  const checkLatestVersion = async () => {
    if (checkingLatest) {
      return;
    }

    setCheckingLatest(true);
    setLatestError("");
    try {
      const response = await fetch("/api/update/latest");
      const payload = await response.json();
      if (!response.ok || !payload?.ok) {
        setLatestError(payload?.error || "Could not fetch latest version.");
        setUpdateAvailable(false);
        return;
      }

      const latest = String(payload.latest_version || "").trim();
      const current = String(payload.current_version || "").trim();

      setCurrentVersion(current);
      setLatestVersion(latest);

      if (!latest) {
        setLatestError("Latest published version is unavailable right now.");
        setUpdateAvailable(false);
        return;
      }

      setUpdateAvailable(Boolean(current && latest !== current));
    } catch (error) {
      setLatestError(error?.message || "Could not fetch latest version.");
      setUpdateAvailable(false);
    } finally {
      setCheckingLatest(false);
    }
  };

  useEffect(() => {
    loadData().catch(() => {});
    checkLatestVersion().catch(() => {});
  }, []);

  const updateApp = async () => {
    if (!canUpdateApp || checkingUpdates) {
      return;
    }

    setCheckingUpdates(true);
    setUpdateMessage("");
    try {
      const result = await window.aetDesktop.updateApp();
      const status = result?.status;
      if (status === "busy") {
        setUpdateMessage("An update check is already in progress.");
      } else if (status === "installing") {
        setUpdateMessage("Launching installer...");
      } else if (status === "up-to-date") {
        setUpdateMessage("You are on the latest version.");
      } else if (status === "not-packaged") {
        setUpdateMessage("Update checks are available only in installed desktop builds.");
      } else if (status === "unsupported-platform") {
        setUpdateMessage("Update checks are currently supported on Windows desktop builds.");
      } else if (status === "disabled") {
        setUpdateMessage("Updater is currently disabled.");
      } else if (status === "metadata-error") {
        setUpdateMessage(result?.error || "Could not check for updates.");
      } else {
        setUpdateMessage("Update action completed.");
      }
    } catch (error) {
      setUpdateMessage(error?.message || "Could not check for updates.");
    } finally {
      setCheckingUpdates(false);
    }
  };

  const sliders = useMemo(
    () => ({
      split_pre: Number(form?.split_pre ?? 0),
      split_post: Number(form?.split_post ?? 0),
    }),
    [form]
  );

  const keywordRows = useMemo(() => parseKeywords(form?.detection_keywords || ""), [form?.detection_keywords]);

  const sections = useMemo(() => {
    const navSections = [
      { id: "capture", label: "Capture" },
      { id: "detection", label: "Detection" },
      { id: "clips", label: "Clips" },
      { id: "ocr", label: "OCR & Performance" },
      { id: "overlay", label: "Overlay" },
      { id: "updates", label: "Updates" },
    ];
    return navSections;
  }, []);

  useEffect(() => {
    if (!form || !didHydrateRef.current) {
      return;
    }

    clearTimeout(autosaveTimerRef.current);
    autosaveTimerRef.current = setTimeout(() => {
      saveConfig(form).catch(() => {});
    }, 500);

    return () => {
      clearTimeout(autosaveTimerRef.current);
    };
  }, [form]);

  useEffect(() => {
    const nodes = sections
      .map((section) => sectionRefs.current[section.id])
      .filter(Boolean);
    if (!nodes.length) {
      return undefined;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((entry) => entry.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio);
        if (visible.length) {
          setActiveSection(visible[0].target.dataset.sectionId);
        }
      },
      {
        root: null,
        threshold: [0.2, 0.45, 0.7],
        rootMargin: "-20% 0px -45% 0px",
      }
    );

    nodes.forEach((node) => observer.observe(node));

    return () => observer.disconnect();
  }, [sections]);

  useEffect(
    () => () => {
      clearTimeout(autosaveTimerRef.current);
      clearTimeout(saveStateTimerRef.current);
    },
    []
  );

  const jumpToSection = (sectionId) => {
    const target = sectionRefs.current[sectionId];
    if (!target) {
      return;
    }
    setActiveSection(sectionId);
    target.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const bindSectionRef = (sectionId) => (node) => {
    sectionRefs.current[sectionId] = node;
  };

  const saveStateLabel =
    saveState === "saving"
      ? "Saving..."
      : saveState === "saved"
        ? "Saved"
        : saveState === "error"
          ? "Save failed"
          : "All changes saved";

  if (!form) {
    return <p className="hint">Loading settings...</p>;
  }

  return (
    <div className="settings-page">
      {showSessionRecorder ? (
        <section className="card controls centered">
          <h2>Apex Session Recorder</h2>
          <div className="button-row">
            <button
              type="button"
              className="primary"
              disabled={!obsConnected}
              onClick={startSession}
            >
              Start Recording Session
            </button>
            <button type="button" className="danger" onClick={stopSession}>
              End Session
            </button>
          </div>
          <p className="hint">Start/Stop controls run the bookmarks mode and can auto-split on exit.</p>
          {!obsConnected && (
            <p className="hint">OBS is not detected. Start OBS to begin a session.</p>
          )}
        </section>
      ) : null}

      <section className="card settings-shell">
        <header className="settings-header-row">
          <div>
            <h2>Settings</h2>
            <p className="hint">Organized by workflow: capture, detection, clips, OCR, and updates.</p>
          </div>
          <div className={`settings-save-indicator ${saveState}`}>
            {saveStateLabel}
          </div>
        </header>
        {saveState === "error" && saveError ? <p className="hint settings-save-error">{saveError}</p> : null}

        <div className="settings-layout">
          <nav className="settings-nav" aria-label="Settings sections">
            {sections.map((section) => (
              <button
                key={section.id}
                type="button"
                className={`settings-nav-link ${activeSection === section.id ? "active" : ""}`}
                onClick={() => jumpToSection(section.id)}
              >
                {section.label}
              </button>
            ))}
          </nav>

          <div className="settings-content">
            <section
              className="settings-panel"
              ref={bindSectionRef("capture")}
              data-section-id="capture"
            >
              <h3>Capture</h3>
              <p className="hint">Tune the on-screen region used for OCR.</p>
              <div className="input-row">
                <button
                  type="button"
                  className="secondary"
                  onClick={() => (window.location.href = "/capture-area")}
                >
                  Open Capture Area Tool
                </button>
              </div>
              <div className="section-grid">
                <label>
                  Left
                  <input
                    type="number"
                    value={form.capture_left}
                    onChange={(event) => updateField("capture_left", event.target.value)}
                  />
                </label>
                <label>
                  Top
                  <input
                    type="number"
                    value={form.capture_top}
                    onChange={(event) => updateField("capture_top", event.target.value)}
                  />
                </label>
                <label>
                  Width
                  <input
                    type="number"
                    value={form.capture_width}
                    onChange={(event) => updateField("capture_width", event.target.value)}
                  />
                </label>
                <label>
                  Height
                  <input
                    type="number"
                    value={form.capture_height}
                    onChange={(event) => updateField("capture_height", event.target.value)}
                  />
                </label>
              </div>

              <details className="settings-advanced">
                <summary>Advanced</summary>
                <div className="settings-advanced-grid">
                  <label>
                    Capture FPS
                    <input
                      type="number"
                      value={form.capture_fps}
                      onChange={(event) => updateField("capture_fps", event.target.value)}
                    />
                  </label>
                  <label>
                    Capture Scale
                    <input
                      type="number"
                      min="0"
                      step="0.1"
                      value={form.capture_scale}
                      onChange={(event) => updateField("capture_scale", event.target.value)}
                    />
                  </label>
                  <label>
                    Threshold
                    <input
                      type="number"
                      value={form.capture_threshold}
                      onChange={(event) => updateField("capture_threshold", event.target.value)}
                    />
                  </label>
                  <label>
                    Capture Backend
                    <select
                      value={form.capture_backend}
                      onChange={(event) => updateField("capture_backend", event.target.value)}
                    >
                      <option value="auto">Auto</option>
                      <option value="dxcam">DXCAM</option>
                      <option value="mss">MSS</option>
                    </select>
                  </label>
                </div>
              </details>
            </section>

            <section
              className="settings-panel"
              ref={bindSectionRef("detection")}
              data-section-id="detection"
            >
              <h3>Detection</h3>
              <p className="hint">Define which killfeed terms create clip bookmarks.</p>
              <div className="settings-keyword-add">
                <input
                  type="text"
                  value={newKeyword}
                  onChange={(event) => setNewKeyword(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      event.preventDefault();
                      addKeyword();
                    }
                  }}
                  placeholder="Add keyword (e.g. killed)"
                />
                <button type="button" className="secondary" onClick={addKeyword}>
                  Add Keyword
                </button>
              </div>
              <div className="settings-event-grid">
                <div className="settings-event-grid-head">Keyword</div>
                <div className="settings-event-grid-head">Pre-roll (s)</div>
                <div className="settings-event-grid-head">Post-roll (s)</div>
                {keywordRows.map((keyword) => {
                  const row = form.split_event_windows?.[keyword] || {};
                  return (
                    <React.Fragment key={keyword}>
                      <div className="settings-event-keyword-row">
                        <button
                          type="button"
                          className="secondary settings-keyword-delete"
                          onClick={() => removeKeyword(keyword)}
                          title={`Delete keyword ${keyword}`}
                          aria-label={`Delete keyword ${keyword}`}
                        >
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
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
                        <span className="settings-event-keyword">{keyword}</span>
                      </div>
                      <label className="slider-label settings-event-slider">
                        <div className="slider-title">
                          <span>{Number(row.pre_seconds ?? sliders.split_pre)}s</span>
                        </div>
                        <input
                          type="range"
                          min="0"
                          max="120"
                          step="1"
                          value={row.pre_seconds ?? sliders.split_pre}
                          onChange={(event) => updateKeywordWindow(keyword, "pre_seconds", event.target.value)}
                        />
                      </label>
                      <label className="slider-label settings-event-slider">
                        <div className="slider-title">
                          <span>{Number(row.post_seconds ?? sliders.split_post)}s</span>
                        </div>
                        <input
                          type="range"
                          min="0"
                          max="120"
                          step="1"
                          value={row.post_seconds ?? sliders.split_post}
                          onChange={(event) => updateKeywordWindow(keyword, "post_seconds", event.target.value)}
                        />
                      </label>
                    </React.Fragment>
                  );
                })}
              </div>
              <details className="settings-advanced">
                <summary>Advanced</summary>
                <div className="settings-advanced-grid">
                  <label>
                    Detection Cooldown (seconds)
                    <input
                      type="number"
                      min="0"
                      step="0.1"
                      value={form.detection_cooldown}
                      onChange={(event) => updateField("detection_cooldown", event.target.value)}
                    />
                  </label>
                  <label>
                    Default Pre-roll (seconds)
                    <input
                      type="number"
                      min="0"
                      step="1"
                      value={form.split_pre}
                      onChange={(event) => updateField("split_pre", event.target.value)}
                    />
                  </label>
                  <label>
                    Default Post-roll (seconds)
                    <input
                      type="number"
                      min="0"
                      step="1"
                      value={form.split_post}
                      onChange={(event) => updateField("split_post", event.target.value)}
                    />
                  </label>
                </div>
              </details>
            </section>

            <section
              className="settings-panel"
              ref={bindSectionRef("clips")}
              data-section-id="clips"
            >
              <h3>Clips</h3>
              <p className="hint">Configure recordings path and clip output location.</p>
              <label>Recordings Directory</label>
              <div className="input-row">
                <input
                  type="text"
                  value={form.replay_dir}
                  onChange={(event) => updateField("replay_dir", event.target.value)}
                />
                {canBrowseReplayDir ? (
                  <button type="button" className="secondary" onClick={browseReplayDir}>
                    Browse
                  </button>
                ) : null}
              </div>
              <p className="hint">
                Clips will be saved to: {form.replay_dir ? `${form.replay_dir}/clips` : "(set recordings directory first)"}
              </p>
            </section>

            <section
              className="settings-panel"
              ref={bindSectionRef("ocr")}
              data-section-id="ocr"
            >
              <h3>OCR &amp; Performance</h3>
              <label>
                OCR Engine
                <select
                  value={form.ocr_engine}
                  onChange={(event) => updateField("ocr_engine", event.target.value)}
                >
                  <option value="tesseract">Tesseract (CPU)</option>
                  <option value="easyocr">EasyOCR (GPU capable)</option>
                </select>
              </label>
              <div className="input-row settings-ocr-actions">
                <button type="button" className="secondary" onClick={testGpuOcr} disabled={gpuTesting}>
                  {gpuTesting ? "Testing..." : "Test GPU OCR"}
                </button>
              </div>
              {gpuStatus ? <p className="hint settings-inline-status">{gpuStatus}</p> : null}

              <details className="settings-advanced">
                <summary>Advanced</summary>
                <div className="settings-advanced-grid">
                  <label>
                    OCR Interval (seconds)
                    <input
                      type="number"
                      min="0.1"
                      step="0.1"
                      value={form.ocr_interval}
                      onChange={(event) => updateField("ocr_interval", event.target.value)}
                    />
                  </label>
                </div>
              </details>
            </section>

            <section
              className="settings-panel"
              ref={bindSectionRef("overlay")}
              data-section-id="overlay"
            >
              <h3>Overlay</h3>
              <p className="hint">
                Add a logo or image that appears over the video on the VOD Viewer and Clips pages. The image is not burned into video files.
              </p>

              {form.overlay_image_path ? (
                <div style={{ display: "flex", alignItems: "center", gap: "14px", padding: "12px 14px", background: "var(--surface-raised, var(--surface))", border: "1px solid var(--border)", borderRadius: "8px", marginBottom: "16px" }}>
                  <img
                    src="/api/overlay/image"
                    alt="overlay preview"
                    style={{ height: "48px", maxWidth: "100px", objectFit: "contain", borderRadius: "4px", flexShrink: 0 }}
                  />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 600, fontSize: "14px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {form.overlay_image_path.split(/[\\/]/).pop()}
                    </div>
                    <div style={{ fontSize: "12px", color: "var(--text-secondary)", marginTop: "2px" }}>Current overlay image</div>
                  </div>
                  <div style={{ display: "flex", gap: "8px", flexShrink: 0, alignItems: "center" }}>
                    <input
                      ref={replaceFileInputRef}
                      type="file"
                      accept="image/png,image/jpeg,image/gif,image/webp"
                      style={{ display: "none" }}
                      onChange={async (event) => {
                        const file = event.target.files?.[0];
                        if (!file) return;
                        setOverlayUploading(true);
                        setOverlayStatus("");
                        try {
                          const fd = new FormData();
                          fd.append("overlay_image", file);
                          const res = await fetch("/api/overlay/upload", { method: "POST", body: fd });
                          const payload = await res.json();
                          if (!res.ok || !payload.ok) throw new Error(payload.error || "Upload failed");
                          updateField("overlay_image_path", file.name);
                          setOverlayStatus("Image uploaded.");
                        } catch (err) {
                          setOverlayStatus(err.message || "Upload failed.");
                        } finally {
                          setOverlayUploading(false);
                          event.target.value = "";
                        }
                      }}
                    />
                    <button
                      type="button"
                      className="secondary"
                      style={{ fontSize: "13px", padding: "6px 12px" }}
                      onClick={() => replaceFileInputRef.current?.click()}
                    >
                      {overlayUploading ? "Uploading..." : "Replace"}
                    </button>
                    <button
                      type="button"
                      className="secondary"
                      style={{ fontSize: "13px", padding: "6px 12px" }}
                      onClick={async () => {
                        await fetch("/api/overlay/remove", { method: "POST" });
                        updateField("overlay_image_path", "");
                        setOverlayStatus("Overlay removed.");
                      }}
                    >
                      Remove
                    </button>
                  </div>
                </div>
              ) : (
                <div style={{ marginBottom: "16px" }}>
                  <label style={{ cursor: "pointer" }} title="Choose an image to use as overlay">
                    <input
                      type="file"
                      accept="image/png,image/jpeg,image/gif,image/webp,image/svg+xml"
                      style={{ display: "none" }}
                      onChange={async (event) => {
                        const file = event.target.files?.[0];
                        if (!file) return;
                        setOverlayUploading(true);
                        setOverlayStatus("");
                        try {
                          const fd = new FormData();
                          fd.append("overlay_image", file);
                          const res = await fetch("/api/overlay/upload", { method: "POST", body: fd });
                          const payload = await res.json();
                          if (!res.ok || !payload.ok) throw new Error(payload.error || "Upload failed");
                          updateField("overlay_image_path", file.name);
                          setOverlayStatus("Image uploaded.");
                        } catch (err) {
                          setOverlayStatus(err.message || "Upload failed.");
                        } finally {
                          setOverlayUploading(false);
                          event.target.value = "";
                        }
                      }}
                    />
                    <span className="secondary" style={{ display: "inline-block", padding: "6px 14px", borderRadius: "6px", border: "1px solid var(--border)", cursor: "pointer", fontSize: "14px" }}>
                      {overlayUploading ? "Uploading..." : "Upload Image"}
                    </span>
                  </label>
                </div>
              )}

              {overlayStatus ? (
                <p className="hint settings-inline-status" style={{ marginTop: "-8px", marginBottom: "12px" }}>{overlayStatus}</p>
              ) : null}

              {form.overlay_image_path ? (
                <>
                  <label className="check-row" style={{ display: "flex", marginBottom: "16px" }}>
                    <input
                      type="checkbox"
                      checked={form.overlay_enabled}
                      onChange={(event) => updateField("overlay_enabled", event.target.checked)}
                    />
                    <span>Show overlay on VODs and clips</span>
                  </label>
                  <label className="slider-label">
                    <div className="slider-title">
                      <span>Opacity: {Math.round(form.overlay_opacity * 100)}%</span>
                    </div>
                    <input
                      type="range"
                      min="5"
                      max="100"
                      step="1"
                      value={Math.round(form.overlay_opacity * 100)}
                      onChange={(event) => updateField("overlay_opacity", Number(event.target.value) / 100)}
                    />
                  </label>
                  <div style={{ marginTop: "16px", display: "flex", alignItems: "center", gap: "12px" }}>
                    <button
                      type="button"
                      className="secondary"
                      onClick={() => (window.location.href = "/overlay-tool")}
                    >
                      Open Overlay Placement Tool
                    </button>
                    <span className="hint" style={{ margin: 0 }}>Drag to position and set size.</span>
                  </div>
                </>
              ) : null}
            </section>

            <section
              className="settings-panel"
              ref={bindSectionRef("updates")}
              data-section-id="updates"
            >
              <div className="settings-update-header">
                <h3>Updates</h3>
                <span className={`settings-update-state ${updateAvailable ? "available" : "current"}`}>
                  {checkingLatest ? "Checking for updates..." : updateAvailable ? "Update available" : "Up to date"}
                </span>
              </div>
              <p className="hint">Version status is checked automatically when this page opens.</p>
              <div className="settings-update-overview">
                <div className="settings-update-row">
                  <span className="settings-update-label">Installed Version</span>
                  <span className="settings-update-value">{currentVersion || "Unknown"}</span>
                </div>
                <div className="settings-update-row">
                  <span className="settings-update-label">Latest Version</span>
                  <span className="settings-update-value">{checkingLatest ? "Checking..." : (latestVersion || "Unavailable")}</span>
                </div>
              </div>
              {canUpdateApp ? (
                <button
                  type="button"
                  className="secondary"
                  onClick={updateApp}
                  disabled={checkingUpdates || checkingLatest || !updateAvailable}
                >
                  {checkingUpdates ? "Updating..." : "Update App"}
                </button>
              ) : null}
              {latestError ? <p className="hint settings-inline-status">{latestError}</p> : null}
              {updateMessage ? <p className="hint settings-inline-status">{updateMessage}</p> : null}
            </section>
          </div>
        </div>

        {showSessionRecorder ? (
          <div className="settings-panel">
            <h3>Recording Controls</h3>
            <label className="check-row">
              <input
                type="checkbox"
                checked={Boolean(form.record_start)}
                onChange={(event) => updateField("record_start", event.target.checked)}
              />
              Start recording on launch
            </label>
            <label className="check-row">
              <input
                type="checkbox"
                checked={Boolean(form.record_stop)}
                onChange={(event) => updateField("record_stop", event.target.checked)}
              />
              Stop recording on exit
            </label>
            <label className="check-row">
              <input
                type="checkbox"
                checked={Boolean(form.record_split)}
                onChange={(event) => updateField("record_split", event.target.checked)}
              />
              Auto-split on exit
            </label>
          </div>
        ) : null}

      </section>
    </div>
  );
}
