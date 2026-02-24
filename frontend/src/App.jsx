import React, { useEffect, useMemo, useState } from "react";
import { NavLink, Route, Routes, useLocation } from "react-router-dom";
import Home from "./pages/Home.jsx";
import Vods from "./pages/Vods.jsx";
import VodViewer from "./pages/VodViewer.jsx";
import Clips from "./pages/Clips.jsx";
import ClipsViewer from "./pages/ClipsViewer.jsx";
import Settings from "./pages/Settings.jsx";
import CaptureArea from "./pages/CaptureArea.jsx";
import TwitchImport from "./pages/TwitchImport.jsx";

const navLinkClass = ({ isActive }) =>
  isActive ? "link-button active" : "link-button";

const isActiveTwitchJob = (job) => ["queued", "downloading", "scanning"].includes(job.status);

export default function App() {
  const showSessionRecorder = false;
  const [status, setStatus] = useState(null);
  const [notificationData, setNotificationData] = useState({
    bootstrap: null,
    gpu_ocr_install: null,
    twitch_jobs: [],
    patch_notes: []
  });
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [dismissedNotifications, setDismissedNotifications] = useState(() => {
    try {
      const raw = window.localStorage.getItem("vodinsights.dismissedNotifications");
      if (!raw) {
        return new Set();
      }
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        return new Set(parsed);
      }
    } catch (error) {
      // Ignore localStorage errors.
    }
    return new Set();
  });
  const location = useLocation();
  const isVodViewerRoute = location.pathname === "/vods/view";

  const activeTwitchJobs = useMemo(() => {
    return (notificationData.twitch_jobs || []).filter(isActiveTwitchJob);
  }, [notificationData.twitch_jobs]);

  const gpuOcrInstall = notificationData.gpu_ocr_install;
  const gpuOcrInstalling = Boolean(gpuOcrInstall?.running);
  const gpuOcrVisible = Boolean(
    gpuOcrInstall && (gpuOcrInstall.running || gpuOcrInstall.status === "success" || gpuOcrInstall.status === "error")
  );

  const bootstrapBusy = useMemo(() => {
    const bootstrap = notificationData.bootstrap;
    if (!bootstrap) {
      return false;
    }
    if (bootstrap.running) {
      return true;
    }
    if (!bootstrap.required_ready) {
      return true;
    }
    if (bootstrap.install_gpu_ocr && !bootstrap.gpu_ocr_ready) {
      return true;
    }
    return false;
  }, [notificationData.bootstrap]);

  const isDismissed = (key) => dismissedNotifications.has(key);
  const dismissNotification = (key) => {
    setDismissedNotifications((prev) => {
      const next = new Set(prev);
      next.add(key);
      try {
        window.localStorage.setItem(
          "vodinsights.dismissedNotifications",
          JSON.stringify(Array.from(next))
        );
      } catch (error) {
        // Ignore localStorage errors.
      }
      return next;
    });
  };

  const notificationCount =
    (bootstrapBusy && !isDismissed("bootstrap") ? 1 : 0) +
    (gpuOcrVisible && !isDismissed("gpu-ocr-install") ? 1 : 0) +
    activeTwitchJobs.filter((job) => !isDismissed(`twitch:${job.id}`)).length;

  const loadNotifications = async () => {
    const response = await fetch("/api/notifications");
    if (!response.ok) {
      return;
    }
    const payload = await response.json();
    setNotificationData(payload);
  };

  useEffect(() => {
    let isMounted = true;
    const load = async () => {
      const response = await fetch("/api/status");
      const payload = await response.json();
      if (isMounted) {
        setStatus(payload);
      }
    };

    load().catch(() => {});
    const interval = setInterval(() => {
      load().catch(() => {});
    }, 5000);
    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, []);

  useEffect(() => {
    let isMounted = true;
    const load = async () => {
      try {
        await loadNotifications();
      } catch (error) {
        // Ignore notification fetch errors.
      }
    };
    load().catch(() => {});
    const interval = setInterval(() => {
      if (isMounted) {
        load().catch(() => {});
      }
    }, notificationsOpen ? 3000 : 10000);
    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, [notificationsOpen]);

  return (
    <div className={`app ${isVodViewerRoute ? "app-vod-viewer" : ""}`}>
      {!isVodViewerRoute ? (
        <header className="header">
          <div>
            <h1 className="brand-title brand-title-main">
              <img src="/logo.png" alt="" className="brand-logo brand-logo-main" aria-hidden="true" />
              <span>VOD Insights</span>
            </h1>
          </div>
          <div className="status">
            <div className="header-actions">
              <NavLink className={navLinkClass} to="/">
                Home
              </NavLink>
              <NavLink id="nav-vods-link" className={navLinkClass} to="/vods">
                VODs
              </NavLink>
              <NavLink className={navLinkClass} to="/clips">
                Clips
              </NavLink>
              <NavLink className={navLinkClass} to="/settings">
                Settings
              </NavLink>
              <div className="notification-wrapper">
                <button
                  type="button"
                  className="notification-bell"
                  onClick={() => setNotificationsOpen((prev) => !prev)}
                  aria-label="Open notifications"
                  title="Notifications"
                >
                  <svg viewBox="0 0 24 24" role="img" aria-hidden="true">
                    <path d="M12 22a2.5 2.5 0 0 0 2.5-2.5h-5A2.5 2.5 0 0 0 12 22zm7-6V11a7 7 0 0 0-5.5-6.8V3.5a1.5 1.5 0 0 0-3 0v.7A7 7 0 0 0 5 11v5l-2 2v1h18v-1l-2-2z" />
                  </svg>
                  {notificationCount > 0 ? (
                    <span className="notification-count">{notificationCount}</span>
                  ) : null}
                </button>
                {notificationsOpen ? (
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
                      {gpuOcrVisible && !isDismissed("gpu-ocr-install") ? (
                        <div className="notification-item">
                          <button
                            type="button"
                            className="notification-dismiss"
                            onClick={() => dismissNotification("gpu-ocr-install")}
                            aria-label="Dismiss GPU OCR notification"
                            title="Dismiss"
                          >
                            ×
                          </button>
                          <div className="notification-title">GPU OCR</div>
                          <div className="notification-body">
                            {gpuOcrInstall?.message || "Installing GPU OCR dependencies..."}
                          </div>
                          <div className="notification-meta">
                            {gpuOcrInstall?.status === "error"
                              ? "Failed"
                              : gpuOcrInstall?.status === "success"
                              ? "Completed"
                              : gpuOcrInstall?.step_total
                              ? `Step ${gpuOcrInstall.step || 0} of ${gpuOcrInstall.step_total}`
                              : "Installing"}
                          </div>
                          {gpuOcrInstall?.status !== "error" ? (
                            <div className="notification-progress">
                              <div
                                className={`notification-progress-bar${
                                  gpuOcrInstall?.step_total ? "" : " indeterminate"
                                }`}
                                style={
                                  gpuOcrInstall?.step_total
                                    ? {
                                        width: `${Math.max(
                                          5,
                                          Math.round(
                                            ((gpuOcrInstall.step || 0) / gpuOcrInstall.step_total) * 100
                                          )
                                        )}%`
                                      }
                                    : gpuOcrInstall?.status === "success"
                                    ? { width: "100%" }
                                    : undefined
                                }
                              ></div>
                            </div>
                          ) : null}
                        </div>
                      ) : null}
                      {activeTwitchJobs.length > 0 ? (
                        activeTwitchJobs
                          .filter((job) => !isDismissed(`twitch:${job.id}`))
                          .map((job) => (
                            <div className="notification-item" key={job.id}>
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
                            <div className="notification-meta">{job.status}</div>
                            {job.progress != null ? (
                              <div className="notification-progress">
                                <div
                                  className="notification-progress-bar"
                                  style={{ width: `${job.progress}%` }}
                                ></div>
                              </div>
                            ) : null}
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
                ) : null}
              </div>
              {showSessionRecorder ? (
                <span className={`badge ${status?.bookmark_running ? "on" : "off"}`}>
                  {status?.bookmark_running ? "Recording Active" : "Idle"}
                </span>
              ) : null}
            </div>
          </div>
        </header>
      ) : null}
      <main className={isVodViewerRoute ? "app-main-vod-viewer" : undefined}>
        <Routes>
          <Route path="/" element={<Home status={status} />} />
          <Route path="/vods" element={<Vods status={status} />} />
          <Route path="/vods/view" element={<VodViewer />} />
          <Route path="/clips" element={<Clips />} />
          <Route path="/clips/view" element={<ClipsViewer />} />
          <Route path="/settings" element={<Settings status={status} />} />
          <Route path="/twitch-import" element={<TwitchImport />} />
          <Route path="/capture-area" element={<CaptureArea status={status} />} />
        </Routes>
      </main>
    </div>
  );
}
