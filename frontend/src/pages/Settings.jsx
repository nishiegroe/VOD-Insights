import React from "react";
import SettingsCapturePanel from "../components/SettingsCapturePanel";
import SettingsClipsPanel from "../components/SettingsClipsPanel";
import SettingsDetectionPanel from "../components/SettingsDetectionPanel";
import SettingsOcrPanel from "../components/SettingsOcrPanel";
import SettingsOverlayPanel from "../components/SettingsOverlayPanel";
import SettingsRecordingControlsPanel from "../components/SettingsRecordingControlsPanel";
import SettingsSectionNav from "../components/SettingsSectionNav";
import SettingsSessionRecorderCard from "../components/SettingsSessionRecorderCard";
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
        <SettingsSessionRecorderCard
          obsConnected={obsConnected}
          startSession={startSession}
          stopSession={stopSession}
        />
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
            <SettingsCapturePanel
              bindSectionRef={bindSectionRef}
              form={form}
              updateField={updateField}
            />

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

            <SettingsClipsPanel
              bindSectionRef={bindSectionRef}
              form={form}
              updateField={updateField}
              canBrowseReplayDir={canBrowseReplayDir}
              browseReplayDir={browseReplayDir}
            />

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
          <SettingsRecordingControlsPanel form={form} updateField={updateField} />
        ) : null}

      </section>
    </div>
  );
}
