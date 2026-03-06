import React from "react";

export default function SettingsRecordingControlsPanel({ form, updateField }) {
  return (
    <div className="settings-panel">
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
  );
}
