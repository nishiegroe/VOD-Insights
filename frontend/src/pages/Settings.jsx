import React, { useEffect, useMemo, useState } from "react";

const toCommaList = (value) => (Array.isArray(value) ? value.join(", ") : "");

export default function Settings({ status }) {
  const showSessionRecorder = false;
  const [form, setForm] = useState(null);
  const [saving, setSaving] = useState(false);
  const [gpuStatus, setGpuStatus] = useState("");
  const [gpuTesting, setGpuTesting] = useState(false);

  const obsConnected = status?.obs_connected ?? false;

  const loadData = async () => {
    const configResponse = await fetch("/api/config");
    const config = await configResponse.json();
    setForm({
      capture_left: config.capture?.left ?? 0,
      capture_top: config.capture?.top ?? 0,
      capture_width: config.capture?.width ?? 0,
      capture_height: config.capture?.height ?? 0,
      capture_fps: config.capture?.fps ?? 30,
      capture_scale: config.capture?.scale ?? 1,
      capture_threshold: config.capture?.threshold ?? 0,
      capture_backend: config.capture?.backend ?? "auto",
      ocr_interval: config.ocr?.interval_seconds ?? 1,
      ocr_engine: config.ocr?.engine ?? "tesseract",
      detection_keywords: toCommaList(config.detection?.keywords),
      detection_cooldown: config.detection?.cooldown_seconds ?? 2,
      record_start: config.recording?.start_on_launch ?? false,
      record_stop: config.recording?.stop_on_exit ?? false,
      record_split: config.recording?.run_split_on_exit ?? false,
      replay_dir: config.replay?.directory ?? "",
      split_pre: config.split?.pre_seconds ?? 0,
      split_post: config.split?.post_seconds ?? 0,
    });
  };

  useEffect(() => {
    loadData().catch(() => {});
  }, []);

  const updateField = (field, value) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!form) return;
    setSaving(true);
    await fetch("/api/config", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    setSaving(false);
    loadData().catch(() => {});
  };

  const browseReplayDir = async () => {
    const response = await fetch("/api/choose-replay-dir", { method: "POST" });
    const payload = await response.json();
    if (payload.directory && form) {
      updateField("replay_dir", payload.directory);
    }
  };

  const startSession = async () => {
    await fetch("/api/control/start", { method: "POST" });
  };

  const stopSession = async () => {
    await fetch("/api/control/stop", { method: "POST" });
  };

  const testGpuOcr = async () => {
    setGpuTesting(true);
    setGpuStatus("");
    try {
      const response = await fetch("/api/ocr-gpu-status");
      const payload = await response.json();
      if (!response.ok || !payload.ok) {
        setGpuStatus(payload.error || "GPU check failed");
      } else if (payload.available) {
        setGpuStatus("✓ CUDA GPU detected");
      } else {
        setGpuStatus("✗ No CUDA GPU detected");
      }
    } catch (error) {
      setGpuStatus(error.message || "GPU check failed");
    } finally {
      setGpuTesting(false);
    }
  };

  const sliders = useMemo(
    () => ({
      split_pre: form?.split_pre ?? 0,
      split_post: form?.split_post ?? 0,
    }),
    [form]
  );

  if (!form) {
    return <p className="hint">Loading settings...</p>;
  }

  return (
    <div>
      {showSessionRecorder ? (
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
      ) : null}

      <form className="card" onSubmit={handleSubmit} style={{ maxWidth: '800px', margin: '20px auto' }}>
        <h2>Settings</h2>

        <div className="settings-section">
          <h3>Capture Area</h3>
          <div className="input-row">
            <button
              type="button"
              className="secondary"
              onClick={() => (window.location.href = "/capture-area")}
            >
              Open Capture Area Tool
            </button>
          </div>
          <div className="section-grid">
            <label>
              Left
              <input
                type="number"
                value={form.capture_left}
                onChange={(event) => updateField("capture_left", event.target.value)}
              />
            </label>
            <label>
              Top
              <input
                type="number"
                value={form.capture_top}
                onChange={(event) => updateField("capture_top", event.target.value)}
              />
            </label>
            <label>
              Width
              <input
                type="number"
                value={form.capture_width}
                onChange={(event) => updateField("capture_width", event.target.value)}
              />
            </label>
            <label>
              Height
              <input
                type="number"
                value={form.capture_height}
                onChange={(event) => updateField("capture_height", event.target.value)}
              />
            </label>
          </div>
        </div>

        <div className="settings-section">
          <h3>Recordings & Splits</h3>
          <p className="hint">Configure where recordings are stored and how clips are split.</p>
          
          <label>Recordings Directory</label>
          <div className="input-row">
            <input
              type="text"
              value={form.replay_dir}
              onChange={(event) => updateField("replay_dir", event.target.value)}
            />
            <button type="button" className="secondary" onClick={browseReplayDir}>
              Browse
            </button>
          </div>
          <p className="hint">Clips will be saved to: {form.replay_dir ? `${form.replay_dir}/clips` : '(set recordings directory first)'}</p>

          <label>
            Detection Keywords (comma-separated)
            <textarea
              value={form.detection_keywords}
              onChange={(event) => updateField("detection_keywords", event.target.value)}
              placeholder="killed, knock, assist, elimination, revived, death"
              rows="2"
            />
          </label>
          <p className="hint">Events to detect in the killfeed for auto-splitting clips.</p>

          <div className="slider-grid">
            <label className="slider-label">
              <div className="slider-title">Pre-roll: <span>{sliders.split_pre}</span>s</div>
              <input
                type="range"
                min="0"
                max="120"
                step="1"
                value={form.split_pre}
                onChange={(event) => updateField("split_pre", event.target.value)}
              />
            </label>
            <label className="slider-label">
              <div className="slider-title">Post-roll: <span>{sliders.split_post}</span>s</div>
              <input
                type="range"
                min="0"
                max="120"
                step="1"
                value={form.split_post}
                onChange={(event) => updateField("split_post", event.target.value)}
              />
            </label>
          </div>
        </div>

        <div className="settings-section">
          <h3>OCR</h3>
          <label className="check-row">
            <input
              type="checkbox"
              checked={form.ocr_engine === "easyocr"}
              onChange={(event) => updateField("ocr_engine", event.target.checked ? "easyocr" : "tesseract")}
            />
            Use GPU OCR (EasyOCR)
          </label>
          <div className="input-row">
            <button type="button" className="secondary" onClick={testGpuOcr} disabled={gpuTesting}>
              {gpuTesting ? "Testing..." : "Test GPU OCR"}
            </button>
            {gpuStatus ? <span className="hint">{gpuStatus}</span> : null}
          </div>
        </div>

        {showSessionRecorder ? (
          <div className="settings-section">
            <h3>Recording Controls</h3>
            <label className="check-row">
              <input
                type="checkbox"
                checked={Boolean(form.record_start)}
                onChange={(event) => updateField("record_start", event.target.checked)}
              />
              Start recording on launch
            </label>
            <label className="check-row">
              <input
                type="checkbox"
                checked={Boolean(form.record_stop)}
                onChange={(event) => updateField("record_stop", event.target.checked)}
              />
              Stop recording on exit
            </label>
            <label className="check-row">
              <input
                type="checkbox"
                checked={Boolean(form.record_split)}
                onChange={(event) => updateField("record_split", event.target.checked)}
              />
              Auto-split on exit
            </label>
          </div>
        ) : null}

        <button type="submit" className="primary" disabled={saving} style={{ marginTop: '24px' }}>
          {saving ? "Saving..." : "Save Settings"}
        </button>
      </form>
    </div>
  );
}
