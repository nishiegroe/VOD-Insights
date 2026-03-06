import React from "react";
import SettingsPanel from "./SettingsPanel";

export default function SettingsUpdatesPanel({
  bindSectionRef,
  updateAvailable,
  checkingLatest,
  canUpdateApp,
  updateApp,
  checkingUpdates,
  latestVersion,
  currentVersion,
  latestError,
  updateMessage,
}) {
  return (
    <SettingsPanel sectionId="updates" bindSectionRef={bindSectionRef}>
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
    </SettingsPanel>
  );
}
