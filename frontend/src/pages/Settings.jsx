import React from "react";
import SettingsPanel from "../components/SettingsPanel";
import SettingsSectionNav from "../components/SettingsSectionNav";
import SettingsUpdatesPanel from "../components/SettingsUpdatesPanel";
import useSettingsPage from "../hooks/useSettingsPage";

export default function Settings({ status }) {
  const showSessionRecorder = false;
  const obsConnected = status?.obs_connected ?? false;
  const {
    form,
    saveState,
    saveError,
    checkingLatest,
    checkingUpdates,
    currentVersion,
    latestVersion,
    updateAvailable,
    latestError,
    updateMessage,
    gpuStatus,
    gpuTesting,
    newKeyword,
    setNewKeyword,
    activeSection,
    overlayUploading,
    overlayStatus,
    replaceFileInputRef,
    canUpdateApp,
    canBrowseReplayDir,
    sliders,
    keywordRows,
    sections,
    updateField,
    updateKeywordWindow,
    addKeyword,
    removeKeyword,
    browseReplayDir,
    startSession,
    stopSession,
    testGpuOcr,
    jumpToSection,
    bindSectionRef,
    updateApp,
    saveStateLabel,
    handleOverlayFileChange,
    handleOverlayRemove,
    openOverlayReplacePicker,
  } = useSettingsPage();

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
          <SettingsSectionNav
            sections={sections}
            activeSection={activeSection}
            jumpToSection={jumpToSection}
          />

          <div className="settings-content">
            <SettingsPanel
              sectionId="capture"
              bindSectionRef={bindSectionRef}
              title="Capture"
              subtitle="Tune the on-screen region used for OCR."
            >
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
            </SettingsPanel>

            <SettingsPanel
              sectionId="detection"
              bindSectionRef={bindSectionRef}
              title="Detection"
              subtitle="Define which killfeed terms create clip bookmarks."
            >
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
            </SettingsPanel>

            <SettingsPanel
              sectionId="clips"
              bindSectionRef={bindSectionRef}
              title="Clips"
              subtitle="Configure recordings path and clip output location."
            >
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
            </SettingsPanel>

            <SettingsPanel
              sectionId="ocr"
              bindSectionRef={bindSectionRef}
              title="OCR & Performance"
            >
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
            </SettingsPanel>

            <SettingsPanel
              sectionId="overlay"
              bindSectionRef={bindSectionRef}
              title="Overlay"
              subtitle="Add a logo or image that appears over the video on the VOD Viewer and Clips pages. The image is not burned into video files."
            >

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
                      onChange={handleOverlayFileChange}
                    />
                    <button
                      type="button"
                      className="secondary"
                      style={{ fontSize: "13px", padding: "6px 12px" }}
                      onClick={openOverlayReplacePicker}
                    >
                      {overlayUploading ? "Uploading..." : "Replace"}
                    </button>
                    <button
                      type="button"
                      className="secondary"
                      style={{ fontSize: "13px", padding: "6px 12px" }}
                      onClick={handleOverlayRemove}
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
                      onChange={handleOverlayFileChange}
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
            </SettingsPanel>

            <SettingsUpdatesPanel
              bindSectionRef={bindSectionRef}
              updateAvailable={updateAvailable}
              checkingLatest={checkingLatest}
              canUpdateApp={canUpdateApp}
              updateApp={updateApp}
              checkingUpdates={checkingUpdates}
              latestVersion={latestVersion}
              currentVersion={currentVersion}
              latestError={latestError}
              updateMessage={updateMessage}
            />
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
