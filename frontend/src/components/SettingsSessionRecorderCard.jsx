import React from "react";

export default function SettingsSessionRecorderCard({
  obsConnected,
  startSession,
  stopSession,
}) {
  return (
    <section className="card controls centered">
      <h2>Apex Session Recorder</h2>
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
      <p className="hint">Start/Stop controls run the bookmarks mode and can auto-split on exit.</p>
      {!obsConnected && (
        <p className="hint">OBS is not detected. Start OBS to begin a session.</p>
      )}
    </section>
  );
}
