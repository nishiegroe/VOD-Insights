import React from "react";
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
import {
  CaptureAreaPageSkeleton,
  ClipsPageSkeleton,
  ClipsViewerPageSkeleton,
  HomePageSkeleton,
  OverlayToolPageSkeleton,
  SettingsPageSkeleton,
  TwitchImportPageSkeleton,
  VodViewerPageSkeleton,
  VodsPageSkeleton,
} from "./components/PageSkeletons.jsx";
import useAppShell from "./hooks/useAppShell";

export default function App() {
  const showSessionRecorder = false;
  const {
    activeTwitchJobs,
    bootstrapBusy,
    dismissNotification,
    isDismissed,
    notificationCount,
    notificationData,
    notificationsOpen,
    setNotificationsOpen,
    status,
  } = useAppShell();
  const location = useLocation();
  const useSlimHeader = location.pathname === "/vods/view" || location.pathname === "/clips/view";
  const isVodViewerRoute = location.pathname === "/vods/view";
  const isClipsViewerRoute = location.pathname === "/clips/view";
  const isSettingsRoute = location.pathname === "/settings";
  const isOverlayToolRoute = location.pathname === "/overlay-tool";
  const forceSkeletons =
    typeof window !== "undefined"
    && new URLSearchParams(window.location.search).get("forceSkeletons") === "1";

  let forcedSkeleton = null;
  if (forceSkeletons) {
    switch (location.pathname) {
      case "/":
        forcedSkeleton = <HomePageSkeleton />;
        break;
      case "/vods":
        forcedSkeleton = <VodsPageSkeleton />;
        break;
      case "/vods/view":
        forcedSkeleton = <VodViewerPageSkeleton />;
        break;
      case "/clips":
        forcedSkeleton = <ClipsPageSkeleton />;
        break;
      case "/clips/view":
        forcedSkeleton = <ClipsViewerPageSkeleton />;
        break;
      case "/settings":
        forcedSkeleton = <SettingsPageSkeleton />;
        break;
      case "/twitch-import":
        forcedSkeleton = <TwitchImportPageSkeleton />;
        break;
      case "/capture-area":
        forcedSkeleton = <CaptureAreaPageSkeleton />;
        break;
      case "/overlay-tool":
        forcedSkeleton = <OverlayToolPageSkeleton />;
        break;
      default:
        forcedSkeleton = null;
    }
  }

  return (
    <div className={`app ${isVodViewerRoute ? "app-vod-viewer" : ""} ${isClipsViewerRoute ? "app-clips-viewer" : ""} ${isSettingsRoute ? "app-settings" : ""} ${isOverlayToolRoute ? "app-overlay-tool" : ""}`}>
      {!useSlimHeader ? (
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
      <main className={isVodViewerRoute ? "app-main-vod-viewer" : isClipsViewerRoute ? "app-main-clips-viewer" : isOverlayToolRoute ? "app-main-overlay-tool" : undefined}>
        {forcedSkeleton ? (
          forcedSkeleton
        ) : (
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
        )}
      </main>
    </div>
  );
}
