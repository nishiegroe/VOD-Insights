import React from "react";

export default function NotificationPanel({
  bootstrapBusy,
  notificationData,
  activeTwitchJobs,
  isDismissed,
  dismissNotification,
}) {
  return (
    <div className="notification-panel">
      <div className="notification-section">
        <div className="notification-section-title">Downloads</div>
        {bootstrapBusy && notificationData.bootstrap && !isDismissed("bootstrap") ? (
          <div className="notification-item">
            <button
              type="button"
              className="notification-dismiss"
              onClick={() => dismissNotification("bootstrap")}
              aria-label="Dismiss dependency notification"
              title="Dismiss"
            >
              ×
            </button>
            <div className="notification-title">Dependencies</div>
            <div className="notification-body">
              {notificationData.bootstrap.message || "Preparing dependencies..."}
            </div>
            <div className="notification-meta">
              {notificationData.bootstrap.dependency
                ? notificationData.bootstrap.dependency.toUpperCase()
                : "Using Tesseract for now"}
            </div>
            {notificationData.bootstrap.bytes_total > 0 ? (
              <div className="notification-progress">
                <div
                  className="notification-progress-bar"
                  style={{
                    width: `${Math.min(
                      100,
                      Math.round(
                        (notificationData.bootstrap.bytes_downloaded /
                          notificationData.bootstrap.bytes_total) *
                          100
                      )
                    )}%`
                  }}
                ></div>
              </div>
            ) : null}
          </div>
        ) : (
          <div className="notification-empty">No active dependency downloads.</div>
        )}
        {activeTwitchJobs.length > 0 ? (
          activeTwitchJobs
            .filter((job) => !isDismissed(`twitch:${job.id}`))
            .map((job) => (
              <div className="notification-item" key={job.id}>
                {(() => {
                  const progress = Number(job.progress);
                  const clampedProgress = Number.isFinite(progress)
                    ? Math.max(0, Math.min(100, progress))
                    : 0;
                  const updatedAtMs = Date.parse(job.updated_at || job.started_at || "");
                  const ageSeconds = Number.isFinite(updatedAtMs)
                    ? (Date.now() - updatedAtMs) / 1000
                    : null;
                  const isDownloading = job.status === "downloading";
                  const isHeartbeatActive = isDownloading && (ageSeconds == null || ageSeconds < 20);
                  const isLikelyWaitingSegment = isDownloading && ageSeconds != null && ageSeconds >= 20;

                  return (
                    <>
                <button
                  type="button"
                  className="notification-dismiss"
                  onClick={() => dismissNotification(`twitch:${job.id}`)}
                  aria-label="Dismiss Twitch VOD notification"
                  title="Dismiss"
                >
                  ×
                </button>
                <div className="notification-title">Twitch VOD</div>
                <div className="notification-body">{job.url}</div>
                {job.status === "failed" ? (
                  <div className="notification-meta" style={{ color: "#ff8f7d" }}>
                    {job.message || "Download failed"}
                  </div>
                ) : job.progress != null ? (
                  <>
                    <div className="notification-progress">
                      <div
                        className={`notification-progress-bar ${isHeartbeatActive ? "is-active" : ""}`}
                        style={{ width: `${clampedProgress}%` }}
                      ></div>
                      {isHeartbeatActive ? <div className="notification-progress-activity" /> : null}
                    </div>
                    <div className="notification-meta" style={{ display: "flex", justifyContent: "space-between" }}>
                      <span>
                        {job.speed && job.speed !== "0 B/s"
                          ? job.speed
                          : isLikelyWaitingSegment
                          ? "Waiting for next segment..."
                          : job.message || job.status}
                      </span>
                      {job.eta ? <span>ETA {job.eta}</span> : isDownloading ? <span>ETA calculating...</span> : null}
                    </div>
                  </>
                ) : (
                  <div className="notification-meta">{job.status}</div>
                )}
                    </>
                  );
                })()}
              </div>
            ))
        ) : null}
      </div>
      <div className="notification-section">
        <div className="notification-section-title">Patch Notes</div>
        {(notificationData.patch_notes || []).length > 0 ? (
          (notificationData.patch_notes || [])
            .filter((note, index) => {
              const key = `patch:${note?.version || index}`;
              return !isDismissed(key);
            })
            .map((note, index) => (
              <div className="notification-item" key={`patch-${index}`}>
                <button
                  type="button"
                  className="notification-dismiss"
                  onClick={() => dismissNotification(`patch:${note?.version || index}`)}
                  aria-label="Dismiss patch note"
                  title="Dismiss"
                >
                  ×
                </button>
                <div className="notification-title">
                  {typeof note === "string"
                    ? note
                    : note.version
                    ? `Version ${note.version}`
                    : "Update"}
                </div>
                {note?.date ? (
                  <div className="notification-meta">{note.date}</div>
                ) : null}
                {Array.isArray(note?.items) ? (
                  <ul className="notification-body notification-list">
                    {note.items.map((item, itemIndex) => (
                      <li key={`${note?.version || index}-${itemIndex}`}>{item}</li>
                    ))}
                  </ul>
                ) : typeof note === "string" ? null : (
                  <div className="notification-body">{note?.summary || ""}</div>
                )}
              </div>
            ))
        ) : (
          <div className="notification-empty">No patch notes yet.</div>
        )}
      </div>
    </div>
  );
}
