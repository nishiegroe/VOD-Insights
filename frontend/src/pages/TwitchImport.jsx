import React, { useEffect, useMemo, useState } from "react";

const isActive = (job) => ["queued", "downloading", "scanning"].includes(job.status);

export default function TwitchImport() {
  const [url, setUrl] = useState("");
  const [jobs, setJobs] = useState([]);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const hasActive = useMemo(() => jobs.some(isActive), [jobs]);

  const loadJobs = async () => {
    try {
      const response = await fetch("/api/twitch-imports?limit=20");
      if (!response.ok) {
        return;
      }
      const payload = await response.json();
      if (Array.isArray(payload.jobs)) {
        setJobs(payload.jobs);
      }
    } catch (error) {
      // Keep existing jobs on errors.
    }
  };

  useEffect(() => {
    loadJobs().catch(() => {});
  }, []);

  useEffect(() => {
    const interval = setInterval(() => {
      loadJobs().catch(() => {});
    }, hasActive ? 3000 : 10000);
    return () => clearInterval(interval);
  }, [hasActive]);

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError("");
    setSubmitting(true);
    try {
      const response = await fetch("/api/twitch-import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url })
      });
      const payload = await response.json();
      if (!response.ok || !payload.ok) {
        setError(payload.error || "Failed to start import");
        return;
      }
      setUrl("");
      setJobs((prev) => [payload.job, ...prev]);
    } finally {
      setSubmitting(false);
      loadJobs().catch(() => {});
    }
  };

  return (
    <section className="card">
      <h2>Twitch Import</h2>
      <p className="hint">
        Paste a Twitch VOD URL (like https://www.twitch.tv/videos/123456789). The VOD is downloaded
        locally, then scanned and split just like a normal recording.
      </p>
      <form className="input-row" onSubmit={handleSubmit}>
        <input
          type="url"
          placeholder="https://www.twitch.tv/videos/123456789"
          value={url}
          onChange={(event) => setUrl(event.target.value)}
          required
        />
        <button type="submit" className="primary" disabled={submitting}>
          {submitting ? "Starting..." : "Download + Scan"}
        </button>
      </form>
      {error ? <p className="hint">{error}</p> : null}

      <div className="vod-list">
        {jobs.map((job) => (
          <div className="vod-item" key={job.id}>
            <div className="vod-info">
              <div className="vod-name">{job.url}</div>
              <div className="vod-scan">
                <span className={`led ${job.status === "completed" ? "on" : job.status === "failed" ? "off" : "scanning"}`}></span>
                {job.status}
              </div>
              {job.progress != null ? (
                <>
                  <div className="scan-progress">
                    <div className="scan-progress-bar" style={{ width: `${job.progress}%` }}></div>
                  </div>
                  <div className="scan-progress-text">{job.progress}%</div>
                </>
              ) : null}
              {job.message ? <div className="vod-meta">{job.message}</div> : null}
              {job.eta ? <div className="vod-meta">ETA: {job.eta}</div> : null}
              {job.speed ? <div className="vod-meta">Speed: {job.speed}</div> : null}
              {job.vod_path ? <div className="vod-meta">{job.vod_path}</div> : null}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
