import React, { useEffect, useState } from "react";
import { NavLink, Route, Routes } from "react-router-dom";
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

export default function App() {
  const showSessionRecorder = false;
  const [status, setStatus] = useState(null);

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

  return (
    <div className="app">
      <header className="header">
        <div>
          <h1>Apex Event Tracker</h1>
        </div>
        <div className="status">
          <div className="header-actions">
            <NavLink className={navLinkClass} to="/">
              Home
            </NavLink>
            <NavLink className={navLinkClass} to="/vods">
              VODs
            </NavLink>
            <NavLink className={navLinkClass} to="/clips">
              Clips
            </NavLink>
            <NavLink className={navLinkClass} to="/settings">
              Settings
            </NavLink>
            {showSessionRecorder ? (
              <span className={`badge ${status?.bookmark_running ? "on" : "off"}`}>
                {status?.bookmark_running ? "Recording Active" : "Idle"}
              </span>
            ) : null}
          </div>
        </div>
      </header>
      <main>
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
