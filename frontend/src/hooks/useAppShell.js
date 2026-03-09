import { useEffect, useMemo, useState } from "react";
import { apiFetch } from "../api/client";

const isVisibleTwitchJob = (job) => ["queued", "downloading", "scanning", "failed"].includes(job.status);

export default function useAppShell() {
  const [status, setStatus] = useState(null);
  const [notificationData, setNotificationData] = useState({
    bootstrap: null,
    twitch_jobs: [],
    patch_notes: [],
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

  const activeTwitchJobs = useMemo(() => {
    return (notificationData.twitch_jobs || []).filter(isVisibleTwitchJob);
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

  return {
    activeTwitchJobs,
    bootstrapBusy,
    dismissNotification,
    isDismissed,
    notificationCount,
    notificationData,
    notificationsOpen,
    setNotificationsOpen,
    status,
  };
}
