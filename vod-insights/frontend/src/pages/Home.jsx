import React, { useEffect, useState } from "react";
import { useNavigate, Link } from "react-router-dom";

export default function Home({ status }) {
  const navigate = useNavigate();
  const showSessionRecorder = false;
  const [vods, setVods] = useState([]);
  const [clips, setClips] = useState([]);
  const [recordingDir, setRecordingDir] = useState(null);
  const [configLoaded, setConfigLoaded] = useState(false);

  const obsConnected = status?.obs_connected ?? false;

  useEffect(() => {
    const load = async () => {
      // Load config to check if recording directory is set
      const configRes = await fetch("/api/config");
      const config = await configRes.json();
      const replayDir = config.replay?.directory || "";
      setRecordingDir(replayDir);
      setConfigLoaded(true);

      // Only load VODs and clips if directory is configured
      if (replayDir) {
        const vodRes = await fetch("/api/vods?limit=5");
        const vodPayload = await vodRes.json();
        setVods(vodPayload.vods || []);

        const clipsRes = await fetch("/api/clips?limit=5");
        const clipsPayload = await clipsRes.json();
        setClips(clipsPayload.clips || []);
      }
    };

    load().catch(() => {});
  }, []);

  const startSession = async () => {
    await fetch("/api/control/start", { method: "POST" });
  };

  const stopSession = async () => {
    await fetch("/api/control/stop", { method: "POST" });
  };

  const handleConfigureDirectory = async () => {
    const response = await fetch("/api/choose-replay-dir", { method: "POST" });
    const payload = await response.json();
    if (payload.directory) {
      setRecordingDir(payload.directory);
      navigate("/vods");
    }
  };

  const handleVodClick = (vod) => {
    if (vod.scanned) {
      // Navigate to VOD preview page with the VOD path as a query param
      navigate(`/vods/view?path=${encodeURIComponent(vod.path)}`);
    } else {
      // Navigate to VOD library page
      navigate("/vods");
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

  if (!configLoaded) {
    return null; // Don't render anything until config is loaded
  }

  return (
    <div>
      <section className="grid">
        {showSessionRecorder ? (
          <section className="card controls centered">
            <h2>Session Recorder</h2>
            <div className="button-row">
              <button
                type="button"
                className="primary"
                disabled={!obsConnected}
                onClick={startSession}
              >
                Start Recording Session
              </button>
              <button type="button" className="danger" onClick={stopSession}>
                End Session
              </button>
            </div>
            <p className="hint">
              Record your Apex Legends sessions with ease. This will record your
              Apex gameplay with OBS Recordings, and automatically identify game
              events for you.
            </p>
            {!obsConnected && (
              <p className="hint">OBS is not detected. Start OBS to begin a session.</p>
            )}
          </section>
        ) : null}
      </section>

      {!recordingDir ? (
        <section className="card centered" style={{ padding: '3rem 2rem' }}>
          <h2 className="brand-title brand-title-welcome">
            <img src="/logo.png" alt="" className="brand-logo brand-logo-welcome" aria-hidden="true" />
            <span>Welcome to VOD Insights!</span>
          </h2>
          <p style={{ fontSize: '1.1rem', marginBottom: '1.5rem', color: 'var(--text-secondary)' }}>
            To get started, you need to configure where your Apex Legends recordings are stored.
          </p>
          <p style={{ marginBottom: '2rem', color: 'var(--text-secondary)' }}>
            Point the app to your recordings directory, and it will automatically detect and list your VODs.
            No need to manually import files!
          </p>
          <button
            type="button"
            className="primary"
            style={{ fontSize: '1.1rem', padding: '0.75rem 2rem' }}
            onClick={handleConfigureDirectory}
          >
            Choose VOD Directory
          </button>
        </section>
      ) : (
        <section className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
            <h2 style={{ margin: 0 }}>Recent VODs</h2>
            <button
              type="button"
              className="secondary"
              onClick={() => navigate('/vods')}
              style={{ padding: '0.5rem 1rem' }}
            >
              View All
            </button>
          </div>
          {vods.length ? (
            <div className="clip-group-grid">
              {vods.map((vod) => (
                <div
                  className="clip-tile clip-tile-link"
                  key={vod.path}
                  onClick={() => handleVodClick(vod)}
                  style={{ cursor: "pointer" }}
                >
                  <div className="clip-thumb">
                    {vod.thumbnail_url ? (
                      <img src={vod.thumbnail_url} alt="VOD event thumbnail" loading="lazy" />
                    ) : (
                      <video muted playsInline preload="metadata" src={`/vod-media/${vod.name}`}></video>
                    )}
                  </div>
                  <div className="clip-row clip-title-row">
                    <div className="clip-meta clip-time">
                      {vod.display_title || vod.pretty_time || vod.name}
                    </div>
                    {vod.paused ? (
                      <span className="chip highlight">Paused</span>
                    ) : vod.scanning ? (
                      <span className="chip highlight">Scanning</span>
                    ) : vod.scanned ? (
                      <span className="chip highlight">Scanned</span>
                    ) : null}
                  </div>
                  <div className="clip-meta clip-offset">{vod.name}</div>
                  {vod.duration ? (
                    <div className="clip-meta">
                      Duration: {formatDuration(vod.duration)}
                    </div>
                  ) : null}
                </div>
              ))}
            </div>
          ) : (
            <p className="hint">No recordings found.</p>
          )}
        </section>
      )}

      {recordingDir && (
        <section className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
            <h2 style={{ margin: 0 }}>Recent Clips</h2>
            <button
              type="button"
              className="secondary"
              onClick={() => navigate('/clips')}
              style={{ padding: '0.5rem 1rem' }}
            >
              View All
            </button>
          </div>
        {clips.length ? (
          <div className="clip-group-grid">
            {clips.map((clip) => (
              <Link
                className="clip-tile clip-tile-link"
                to={`/clips/view?path=${encodeURIComponent(clip.path)}`}
                key={clip.path}
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
                  {clip.details?.session_offset}
                </div>
                <div className="clip-row">
                  <div className="clip-badges">
                    {clip.details?.counts ? (
                      <>
                        <span className="chip">Kills: {clip.details.counts.kills}</span>
                        <span className="chip">Assists: {clip.details.counts.assists}</span>
                        <span className="chip">Deaths: {clip.details.counts.deaths}</span>
                      </>
                    ) : (
                      <span className="chip">Counts unavailable</span>
                    )}
                  </div>
                </div>
                {clip.duration ? (
                  <div className="clip-meta">
                    Duration: {formatDuration(clip.duration)}
                  </div>
                ) : null}
              </Link>
            ))}
          </div>
        ) : (
          <p className="hint">No clips found.</p>
        )}
        </section>
      )}
    </div>
  );
}
