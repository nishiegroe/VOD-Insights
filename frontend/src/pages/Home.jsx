import React from "react";
import { Link } from "react-router-dom";
import SectionHeader from "../components/SectionHeader";
import WelcomeSetupCard from "../components/WelcomeSetupCard";
import useHomePage from "../hooks/useHomePage";
import { formatDuration } from "../utils/formatDuration";

export default function Home({ status }) {
  const {
    clips,
    configLoaded,
    handleConfigureDirectory,
    handleVodClick,
    navigate,
    recordingDir,
    showSessionRecorder,
    startSession,
    stopSession,
    vods,
  } = useHomePage();

  const obsConnected = status?.obs_connected ?? false;

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
        <WelcomeSetupCard onChooseDirectory={handleConfigureDirectory} />
      ) : (
        <section className="card">
          <SectionHeader
            title="Recent VODs"
            action={(
              <button
                type="button"
                className="secondary"
                onClick={() => navigate('/vods')}
                style={{ padding: '0.5rem 1rem' }}
              >
                View All
              </button>
            )}
          />
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
          <SectionHeader
            title="Recent Clips"
            action={(
              <button
                type="button"
                className="secondary"
                onClick={() => navigate('/clips')}
                style={{ padding: '0.5rem 1rem' }}
              >
                View All
              </button>
            )}
          />
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
