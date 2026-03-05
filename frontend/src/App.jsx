import React, { useEffect, useMemo, useState } from "react";
import { Route, Routes, useLocation } from "react-router-dom";
import Home from "./pages/Home.jsx";
import Vods from "./pages/Vods.jsx";
import VodViewer from "./pages/VodViewer.jsx";
import Clips from "./pages/Clips.jsx";
import ClipsViewer from "./pages/ClipsViewer.jsx";
import Settings from "./pages/Settings.jsx";
import CaptureArea from "./pages/CaptureArea.jsx";
import TwitchImport from "./pages/TwitchImport.jsx";
import OverlayTool from "./pages/OverlayTool.jsx";
import AppHeader from "./components/AppHeader.jsx";
import { apiFetch } from "./api/client";

const isActiveTwitchJob = (job) => ["queued", "downloading", "scanning"].includes(job.status);

export default function App() {
  const showSessionRecorder = false;
  const [status, setStatus] = useState(null);
  const [notificationData, setNotificationData] = useState({
    bootstrap: null,
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
  const isSettingsRoute = location.pathname === "/settings";
  const isOverlayToolRoute = location.pathname === "/overlay-tool";

  const activeTwitchJobs = useMemo(() => {
    return (notificationData.twitch_jobs || []).filter(isActiveTwitchJob);
  }, [notificationData.twitch_jobs]);

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
    activeTwitchJobs.filter((job) => !isDismissed(`twitch:${job.id}`)).length;

  const loadNotifications = async () => {
    const response = await apiFetch("/api/notifications");
    if (!response.ok) {
      return;
    }
    const payload = await response.json();
    setNotificationData(payload);
  };

  useEffect(() => {
    let isMounted = true;
    const load = async () => {
      const response = await apiFetch("/api/status");
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
    <div className={`app ${isVodViewerRoute ? "app-vod-viewer" : ""} ${isSettingsRoute ? "app-settings" : ""} ${isOverlayToolRoute ? "app-overlay-tool" : ""}`}>
      {!isVodViewerRoute ? (
        <AppHeader
          showSessionRecorder={showSessionRecorder}
          status={status}
          notificationsOpen={notificationsOpen}
          setNotificationsOpen={setNotificationsOpen}
          notificationCount={notificationCount}
          bootstrapBusy={bootstrapBusy}
          notificationData={notificationData}
          activeTwitchJobs={activeTwitchJobs}
          isDismissed={isDismissed}
          dismissNotification={dismissNotification}
        />
      ) : null}
      <main className={isVodViewerRoute ? "app-main-vod-viewer" : isOverlayToolRoute ? "app-main-overlay-tool" : undefined}>
        <Routes>
          <Route path="/" element={<Home status={status} />} />
          <Route path="/vods" element={<Vods status={status} />} />
          <Route path="/vods/view" element={<VodViewer />} />
          <Route path="/clips" element={<Clips />} />
          <Route path="/clips/view" element={<ClipsViewer />} />
          <Route path="/settings" element={<Settings status={status} />} />
          <Route path="/twitch-import" element={<TwitchImport />} />
          <Route path="/capture-area" element={<CaptureArea status={status} />} />
          <Route path="/overlay-tool" element={<OverlayTool />} />
        </Routes>
      </main>
    </div>
  );
}
