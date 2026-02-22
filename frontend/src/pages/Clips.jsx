import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";

const INITIAL_CLIPS_PER_DAY = 6;

const formatDateLabel = (dateKey) => {
  if (!dateKey || dateKey === "unknown") return "Unknown session";
  const date = new Date(`${dateKey}T00:00:00`);
  const day = date.getDate();
  const suffix = day >= 11 && day <= 13 ? "th" : { 1: "st", 2: "nd", 3: "rd" }[day % 10] || "th";
  return date.toLocaleDateString("en-US", {
    weekday: "long",
    month: "short",
    day: "numeric",
  }).replace(day.toString(), `${day}${suffix}`);
};

export default function Clips() {
  const [clipDays, setClipDays] = useState([]);
  const [dayClips, setDayClips] = useState({});
  const [dayLoading, setDayLoading] = useState({});
  const [dayTotals, setDayTotals] = useState({});
  const [dayLoadedCount, setDayLoadedCount] = useState({});
  const [expandedDays, setExpandedDays] = useState({});
  const [clipsDir, setClipsDir] = useState("");
  const [recordingDir, setRecordingDir] = useState(null);
  const [configLoaded, setConfigLoaded] = useState(false);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const fetchClipDays = async (replayDir) => {
    if (!replayDir) {
      setClipDays([]);
      setDayClips({});
      setExpandedDays({});
      setClipsDir("");
      return;
    }
    setLoading(true);
    try {
      const clipsRes = await fetch("/api/clips/days");
      const payload = await clipsRes.json();
      const days = payload.days || [];
      setClipDays(days);
      setDayClips({});
      setDayTotals({});
      setDayLoadedCount({});
      setExpandedDays(
        days.reduce((acc, day) => {
          acc[day.day] = true;
          return acc;
        }, {})
      );
      setClipsDir(`${replayDir}/clips`);
      await Promise.all(
        days.map((day) =>
          fetchDayClips(day.day, { offset: 0, limit: INITIAL_CLIPS_PER_DAY, append: false })
        )
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const load = async () => {
      const configRes = await fetch("/api/config");
      const config = await configRes.json();
      const replayDir = config.replay?.directory || "";
      setRecordingDir(replayDir);
      setConfigLoaded(true);

      await fetchClipDays(replayDir);
    };

    load().catch(() => {});
  }, []);

  useEffect(() => {
    const handleFocus = () => {
      if (recordingDir) {
        fetchClipDays(recordingDir).catch(() => {});
      }
    };
    window.addEventListener("focus", handleFocus);
    return () => window.removeEventListener("focus", handleFocus);
  }, [recordingDir]);

  const fetchDayClips = async (
    dayKey,
    { offset = 0, limit = INITIAL_CLIPS_PER_DAY, append = false } = {}
  ) => {
    setDayLoading((prev) => ({ ...prev, [dayKey]: true }));
    try {
      const params = new URLSearchParams({
        date: dayKey,
        offset: String(offset),
      });
      if (Number.isFinite(limit)) {
        params.set("limit", String(limit));
      }
      const res = await fetch(`/api/clips/by-day?${params.toString()}`);
      const payload = await res.json();
      const clips = payload.clips || [];
      const total = Number.isFinite(payload.total) ? payload.total : clips.length;

      setDayClips((prev) => {
        const existing = prev[dayKey] || [];
        const nextClips = append ? [...existing, ...clips] : clips;
        return { ...prev, [dayKey]: nextClips };
      });
      setDayTotals((prev) => ({ ...prev, [dayKey]: total }));
      setDayLoadedCount((prev) => {
        const existingLoaded = prev[dayKey] || 0;
        return {
          ...prev,
          [dayKey]: append ? existingLoaded + clips.length : clips.length,
        };
      });
    } finally {
      setDayLoading((prev) => ({ ...prev, [dayKey]: false }));
    }
  };

  const loadMoreDayClips = async (dayKey) => {
    const loaded = dayLoadedCount[dayKey] || 0;
    const totalForDay = dayTotals[dayKey] || 0;
    const remaining = Math.max(0, totalForDay - loaded);
    if (!remaining) return;
    await fetchDayClips(dayKey, { offset: loaded, limit: remaining, append: true });
  };

  const toggleDay = async (dayKey) => {
    const isOpen = expandedDays[dayKey];
    if (isOpen) {
      setExpandedDays((prev) => ({ ...prev, [dayKey]: false }));
      return;
    }
    setExpandedDays((prev) => ({ ...prev, [dayKey]: true }));
    if (!dayClips[dayKey]) {
      await fetchDayClips(dayKey, { offset: 0, limit: INITIAL_CLIPS_PER_DAY, append: false });
    }
  };

  const formatDuration = (seconds) => {
    if (!Number.isFinite(seconds) || seconds <= 0) return "";
    const total = Math.round(seconds);
    const hrs = Math.floor(total / 3600);
    const mins = Math.floor((total % 3600) / 60);
    const secs = total % 60;
    const parts = [];
    if (hrs > 0) parts.push(`${hrs} hr`);
    if (mins > 0 || hrs > 0) parts.push(`${mins} min`);
    parts.push(`${secs} sec`);
    return parts.join(" ");
  };

  const totalCount = useMemo(
    () => clipDays.reduce((sum, day) => sum + (day.count || 0), 0),
    [clipDays]
  );

  if (!configLoaded) {
    return null; // Don't render anything until config is loaded
  }

  return (
    <section className="card clip-viewer clip-reimagined">
      <div className="clips-header">
        <div className="clips-header-title">
          <h2>Clips</h2>
          <div className="clips-subtitle-wrap">
            {totalCount ? <span className="clips-subtitle-stat">{totalCount} total clips</span> : null}
            {clipsDir ? <span className="clips-subtitle">{clipsDir}</span> : null}
          </div>
        </div>
        {recordingDir ? (
          <div className="clips-header-actions">
            <button
              type="button"
              className="secondary"
              onClick={() => fetchClipDays(recordingDir)}
              disabled={loading}
            >
              {loading ? "Refreshing..." : "Refresh"}
            </button>
          </div>
        ) : null}
      </div>
      {!recordingDir ? (
        <div className="clips-empty-state centered">
          <h3>No VOD Directory Configured</h3>
          <p>
            To view clips, you need to configure where your Apex Legends recordings are stored.
          </p>
          <p>
            Clips are automatically saved to a "clips" subfolder within your recordings directory.
          </p>
          <button
            type="button"
            className="primary clips-choose-button"
            onClick={async () => {
              const response = await fetch("/api/choose-replay-dir", { method: "POST" });
              const payload = await response.json();
              if (payload.directory) {
                setRecordingDir(payload.directory);
                await fetchClipDays(payload.directory);
              }
            }}
          >
            Choose VOD Directory
          </button>
        </div>
      ) : clipDays.length === 0 ? (
        <div className="clips-empty-state clips-empty-compact">
          <p className="hint">No clips found in the output folder.</p>
        </div>
      ) : (
        <div className="clip-layout clips-list-layout">
          <div className="clip-rail clips-rail">
            {clipDays.map((day) => {
              const dayKey = day.day;
              const isOpen = expandedDays[dayKey];
              const clips = dayClips[dayKey] || [];
              const loadedCount = dayLoadedCount[dayKey] || clips.length;
              const totalForDay = dayTotals[dayKey] || day.count || clips.length;
              const remaining = Math.max(0, totalForDay - loadedCount);
              const hasMore = remaining > 0;
              return (
                <div className="clips-day" key={dayKey}>
                  <button
                    type="button"
                    className="clips-day-toggle"
                    onClick={() => toggleDay(dayKey)}
                    aria-expanded={isOpen}
                    aria-controls={`clips-day-${dayKey}`}
                  >
                    <span className="clips-day-main">
                      <span className="clips-day-label">{formatDateLabel(dayKey)}</span>
                    </span>
                    <span className="clips-day-count">{day.count}</span>
                    <span className={`clips-day-chevron${isOpen ? " open" : ""}`}>▾</span>
                  </button>
                  {isOpen ? (
                    <div className="clips-day-body" id={`clips-day-${dayKey}`}>
                      {dayLoading[dayKey] ? (
                        <div className="clip-load-more">Loading clips...</div>
                      ) : (
                        <div className="clip-group-grid clips-grid">
                          {clips.map((clip) => (
                            <div
                              className="clip-tile clips-tile"
                              role="button"
                              tabIndex={0}
                              key={clip.path}
                              onClick={() => navigate(`/clips/view?path=${encodeURIComponent(clip.path)}`)}
                              onKeyDown={(event) => {
                                if (event.key === "Enter") {
                                  navigate(`/clips/view?path=${encodeURIComponent(clip.path)}`);
                                }
                              }}
                            >
                              <div className="clip-thumb">
                                <video
                                  muted
                                  playsInline
                                  preload="metadata"
                                  src={`/media-path?path=${encodeURIComponent(clip.path)}`}
                                ></video>
                              </div>
                              <div className="clip-row clip-title-row">
                                <div className="clip-meta clip-time">
                                  {clip.display_name || clip.details?.pretty_time || clip.name}
                                </div>
                                {clip.details?.above_avg ? (
                                  <span className="chip highlight" title={clip.details?.top_reason}>
                                    Top
                                  </span>
                                ) : null}
                              </div>
                              <div className="clip-meta clip-offset">
                                {clip.details?.session_offset || ""}
                              </div>
                              <div className="clip-row">
                                <div className="clip-badges">
                                  {clip.details?.counts ? (
                                    <>
                                      <span className="chip">K {clip.details.counts.kills}</span>
                                      <span className="chip">A {clip.details.counts.assists}</span>
                                      <span className="chip">D {clip.details.counts.deaths}</span>
                                    </>
                                  ) : (
                                    <span className="chip">Counts unavailable</span>
                                  )}
                                </div>
                              </div>
                              {clip.duration ? (
                                <div className="clip-meta">{formatDuration(clip.duration)}</div>
                              ) : null}
                            </div>
                          ))}
                        </div>
                      )}
                      {!dayLoading[dayKey] && hasMore && (
                        <div className="clips-load-more-wrap">
                          <button
                            type="button"
                            className="secondary clips-load-more-button"
                            onClick={() => {
                              loadMoreDayClips(dayKey).catch(() => {});
                            }}
                          >
                            Load more ({remaining} remaining)
                          </button>
                        </div>
                      )}
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </section>
  );
}
