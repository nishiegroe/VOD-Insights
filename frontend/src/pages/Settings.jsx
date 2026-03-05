import React from "react";
import SettingsDetectionPanel from "../components/SettingsDetectionPanel";
import SettingsOcrPanel from "../components/SettingsOcrPanel";
import SettingsPanel from "../components/SettingsPanel";
import SettingsOverlayPanel from "../components/SettingsOverlayPanel";
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

            <SettingsDetectionPanel
              bindSectionRef={bindSectionRef}
              newKeyword={newKeyword}
              setNewKeyword={setNewKeyword}
              addKeyword={addKeyword}
              keywordRows={keywordRows}
              form={form}
              sliders={sliders}
              removeKeyword={removeKeyword}
              updateKeywordWindow={updateKeywordWindow}
              updateField={updateField}
            />

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

            <SettingsOcrPanel
              bindSectionRef={bindSectionRef}
              form={form}
              updateField={updateField}
              testGpuOcr={testGpuOcr}
              gpuTesting={gpuTesting}
              gpuStatus={gpuStatus}
            />

            <SettingsOverlayPanel
              bindSectionRef={bindSectionRef}
              form={form}
              replaceFileInputRef={replaceFileInputRef}
              handleOverlayFileChange={handleOverlayFileChange}
              openOverlayReplacePicker={openOverlayReplacePicker}
              overlayUploading={overlayUploading}
              handleOverlayRemove={handleOverlayRemove}
              overlayStatus={overlayStatus}
              updateField={updateField}
            />

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
