import React from "react";
import SettingsPanel from "./SettingsPanel";

export default function SettingsClipsPanel({
  bindSectionRef,
  form,
  updateField,
  canBrowseReplayDir,
  browseReplayDir,
}) {
  return (
    <SettingsPanel
      sectionId="clips"
      bindSectionRef={bindSectionRef}
      title="Clips"
      subtitle="Configure recordings path and clip output location."
    >
      <label>Recordings Directory</label>
      <div className="input-row">
        <input
          type="text"
          value={form.replay_dir}
          onChange={(event) => updateField("replay_dir", event.target.value)}
        />
        {canBrowseReplayDir ? (
          <button type="button" className="secondary" onClick={browseReplayDir}>
            Browse
          </button>
        ) : null}
      </div>
      <p className="hint">
        Clips will be saved to: {form.replay_dir ? `${form.replay_dir}/clips` : "(set recordings directory first)"}
      </p>
    </SettingsPanel>
  );
}
