import React from "react";
import SettingsPanel from "./SettingsPanel";

export default function SettingsCapturePanel({ bindSectionRef, form, updateField }) {
  return (
    <SettingsPanel
      sectionId="capture"
      bindSectionRef={bindSectionRef}
      title="Capture"
      subtitle="Tune the on-screen region used for OCR."
    >
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

      <details className="settings-advanced">
        <summary>Advanced</summary>
        <div className="settings-advanced-grid">
          <label>
            Capture FPS
            <input
              type="number"
              value={form.capture_fps}
              onChange={(event) => updateField("capture_fps", event.target.value)}
            />
          </label>
          <label>
            Capture Scale
            <input
              type="number"
              min="0"
              step="0.1"
              value={form.capture_scale}
              onChange={(event) => updateField("capture_scale", event.target.value)}
            />
          </label>
          <label>
            Threshold
            <input
              type="number"
              value={form.capture_threshold}
              onChange={(event) => updateField("capture_threshold", event.target.value)}
            />
          </label>
          <label>
            Capture Backend
            <select
              value={form.capture_backend}
              onChange={(event) => updateField("capture_backend", event.target.value)}
            >
              <option value="auto">Auto</option>
              <option value="dxcam">DXCAM</option>
              <option value="mss">MSS</option>
            </select>
          </label>
        </div>
      </details>
    </SettingsPanel>
  );
}
