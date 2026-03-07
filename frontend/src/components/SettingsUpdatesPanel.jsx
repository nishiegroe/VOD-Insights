import React from "react";
import SettingsPanel from "./SettingsPanel";

function parseSemverCore(version) {
  if (typeof version !== "string") {
    return null;
  }
  const match = version.match(/(\d+)\.(\d+)\.(\d+)/);
  if (!match) {
    return null;
  }
  return [Number(match[1]), Number(match[2]), Number(match[3])];
}

function compareSemverCore(left, right) {
  for (let i = 0; i < 3; i += 1) {
    if (left[i] > right[i]) {
      return 1;
    }
    if (left[i] < right[i]) {
      return -1;
    }
  }
  return 0;
}

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
  const currentCore = parseSemverCore(currentVersion);
  const latestCore = parseSemverCore(latestVersion);
  const semverComparison = currentCore && latestCore ? compareSemverCore(currentCore, latestCore) : null;

  const isDevPreview = !checkingLatest && semverComparison === 1;
  const hasSemverUpdate = !checkingLatest && semverComparison === -1;
  const showUpdateAvailable = hasSemverUpdate || (!isDevPreview && semverComparison === null && updateAvailable);

  const updateStateText = checkingLatest
    ? "Checking for updates..."
    : isDevPreview
      ? "Release Preview"
      : showUpdateAvailable
        ? "Update available"
        : "Up to date";

  const updateStateClass = showUpdateAvailable ? "available" : isDevPreview ? "preview" : "current";

  return (
    <SettingsPanel sectionId="updates" bindSectionRef={bindSectionRef}>
      <div className="settings-update-header">
        <h3>Updates</h3>
        <span className={`settings-update-state ${updateStateClass}`}>
          {updateStateText}
        </span>
      </div>
      <p className="hint">Version status is checked automatically when this page opens.</p>
      <div className="settings-update-overview">
        <div className="settings-update-row">
          <span className="settings-update-label">Installed Version</span>
          <span className="settings-update-value">{currentVersion || "Unknown"}</span>
        </div>
        <div className="settings-update-row">
          <span className="settings-update-label">Latest Release</span>
          <span className="settings-update-value">{checkingLatest ? "Checking..." : (latestVersion || "Unavailable")}</span>
        </div>
      </div>
      {canUpdateApp ? (
        <button
          type="button"
          className="secondary"
          onClick={updateApp}
          disabled={checkingUpdates || checkingLatest || !showUpdateAvailable}
        >
          {checkingUpdates ? "Updating..." : "Update App"}
        </button>
      ) : null}
      {latestError ? <p className="hint settings-inline-status">{latestError}</p> : null}
      {updateMessage ? <p className="hint settings-inline-status">{updateMessage}</p> : null}
    </SettingsPanel>
  );
}
