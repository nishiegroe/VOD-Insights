import React from "react";
import { NavLink } from "react-router-dom";
import BrandTitle from "./BrandTitle";
import NotificationPanel from "./NotificationPanel";

const navLinkClass = ({ isActive }) =>
  isActive ? "link-button active" : "link-button";

export default function AppHeader({
  showSessionRecorder,
  status,
  notificationsOpen,
  setNotificationsOpen,
  notificationCount,
  bootstrapBusy,
  notificationData,
  activeTwitchJobs,
  isDismissed,
  dismissNotification,
}) {
  return (
    <header className="header">
      <div>
        <BrandTitle
          as="h1"
          text="VOD Insights"
          logoClassName="brand-logo brand-logo-main"
          titleClassName="brand-title brand-title-main"
        />
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
              <NotificationPanel
                bootstrapBusy={bootstrapBusy}
                notificationData={notificationData}
                activeTwitchJobs={activeTwitchJobs}
                isDismissed={isDismissed}
                dismissNotification={dismissNotification}
              />
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
  );
}
