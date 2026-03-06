import { useEffect, useState } from "react";
import {
  fetchSessionData,
  fetchViewerConfig,
  fetchVodSingle,
} from "../api/vodViewer";
import { buildEventWindowMap } from "../utils/vodViewer";

export default function useVodViewerData(vodPath, initialSession) {
  const [bookmarks, setBookmarks] = useState([]);
  const [vodMeta, setVodMeta] = useState(null);
  const [sessions, setSessions] = useState([]);
  const [selectedSession, setSelectedSession] = useState(initialSession);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [detectionKeywords, setDetectionKeywords] = useState([]);
  const [defaultPreRollSeconds, setDefaultPreRollSeconds] = useState(0);
  const [defaultPostRollSeconds, setDefaultPostRollSeconds] = useState(0);
  const [eventWindowMap, setEventWindowMap] = useState({});
  const [overlayConfig, setOverlayConfig] = useState(null);

  useEffect(() => {
    const loadConfig = async () => {
      try {
        const config = await fetchViewerConfig();
        const keywords = config.detection?.keywords || [];
        const fallbackPre = Number(config.split?.pre_seconds || 0);
        const fallbackPost = Number(config.split?.post_seconds || 0);
        setDetectionKeywords(keywords);
        setDefaultPreRollSeconds(fallbackPre);
        setDefaultPostRollSeconds(fallbackPost);
        setEventWindowMap(
          buildEventWindowMap(keywords, config.split?.event_windows || {}, fallbackPre, fallbackPost)
        );
        const uiConfig = config.ui || {};
        if (uiConfig.overlay_image_path && uiConfig.overlay_enabled !== false) {
          setOverlayConfig({
            url: "/api/overlay/image",
            x: Number.isFinite(Number(uiConfig.overlay_x)) ? Number(uiConfig.overlay_x) : 0.85,
            y: Number.isFinite(Number(uiConfig.overlay_y)) ? Number(uiConfig.overlay_y) : 0.88,
            width: Number.isFinite(Number(uiConfig.overlay_width)) ? Number(uiConfig.overlay_width) : 0.15,
            opacity: Number.isFinite(Number(uiConfig.overlay_opacity)) ? Number(uiConfig.overlay_opacity) : 0.9,
          });
        } else {
          setOverlayConfig(null);
        }
      } catch {
        setDetectionKeywords([]);
        setDefaultPreRollSeconds(0);
        setDefaultPostRollSeconds(0);
        setEventWindowMap({});
      }
    };

    loadConfig();
  }, []);

  useEffect(() => {
    if (!vodPath) {
      setError("No VOD path provided");
      setLoading(false);
      return;
    }

    const loadVodData = async () => {
      try {
        const data = await fetchVodSingle(vodPath);

        if (!data.ok || !data.vod) {
          setError("VOD not found");
          setVodMeta(null);
          return;
        }

        const vod = data.vod;
        setVodMeta(vod);
        setSessions(vod.sessions || []);
        if (!selectedSession && vod.sessions && vod.sessions.length > 0) {
          setSelectedSession(vod.sessions[0].path);
        }
      } catch {
        setError("Failed to load VOD data");
      }
    };

    loadVodData();
  }, [vodPath, selectedSession]);

  useEffect(() => {
    if (!selectedSession) {
      setLoading(false);
      return;
    }

    const loadBookmarks = async () => {
      setLoading(true);
      try {
        const data = await fetchSessionData(selectedSession);

        if (data.ok) {
          setBookmarks(data.bookmarks || []);
          setError(null);
        } else {
          setError(data.error || "Failed to load bookmarks");
          setBookmarks([]);
        }
      } catch {
        setError("Failed to fetch bookmark data");
        setBookmarks([]);
      } finally {
        setLoading(false);
      }
    };

    loadBookmarks();
  }, [selectedSession]);

  return {
    bookmarks,
    setBookmarks,
    vodMeta,
    sessions,
    selectedSession,
    setSelectedSession,
    loading,
    setLoading,
    error,
    setError,
    detectionKeywords,
    defaultPreRollSeconds,
    defaultPostRollSeconds,
    eventWindowMap,
    overlayConfig,
  };
}
