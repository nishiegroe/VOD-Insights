import React from "react";
import DownloadVODModal from "../components/DownloadVODModal";
import WelcomeSetupCard from "../components/WelcomeSetupCard";
import { VodsPageSkeleton } from "../components/PageSkeletons";
import { formatDuration } from "../utils/formatDuration";
import useVodsPage from "../hooks/useVodsPage";

export default function Vods({ status }) {
  const {
    canUpload,
    completeWizard,
    configLoaded,
    currentWizard,
    dropRef,
    fileInputRef,
    handleConfigureDirectory,
    handleDeleteVod,
    handleDrop,
    handleDropEnter,
    handleDropLeave,
    handleFileChange,
    handleLoadAll,
    handleOpenBackendLog,
    handleScan,
    handleSplit,
    handleStopScan,
    handleUpload,
    isLastWizardStep,
    loadingAll,
    navigate,
    recordingDir,
    remaining,
    resetWizardForDev,
    setShowDownloadModal,
    setShowUploadModal,
    setToast,
    setWizardStep,
    showDownloadModal,
    showUploadModal,
    splitLoading,
    toast,
    uploadState,
    vods,
    wizardPanelStyle,
    wizardSpotlightRect,
    wizardStep,
    wizardSteps,
    wizardVisible,
  } = useVodsPage();

  if (!configLoaded) {
    return <VodsPageSkeleton />;
  }

  return (
    <section className="grid">
      {!recordingDir ? (
        <WelcomeSetupCard onChooseDirectory={handleConfigureDirectory} />
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
                      onClick={handleOpenBackendLog}
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
                await handleOpenBackendLog();
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
