import React from "react";
import SettingsPanel from "./SettingsPanel";

export default function SettingsDetectionPanel({
  bindSectionRef,
  newKeyword,
  setNewKeyword,
  addKeyword,
  keywordRows,
  form,
  sliders,
  removeKeyword,
  updateKeywordWindow,
  updateField,
}) {
  return (
    <SettingsPanel
      sectionId="detection"
      bindSectionRef={bindSectionRef}
      title="Detection"
      subtitle="Define which killfeed terms create clip bookmarks."
    >
      <div className="settings-keyword-add">
        <input
          type="text"
          value={newKeyword}
          onChange={(event) => setNewKeyword(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              addKeyword();
            }
          }}
          placeholder="Add keyword (e.g. killed)"
        />
        <button type="button" className="secondary" onClick={addKeyword}>
          Add Keyword
        </button>
      </div>
      <div className="settings-event-grid">
        <div className="settings-event-grid-head">Keyword</div>
        <div className="settings-event-grid-head">Pre-roll (s)</div>
        <div className="settings-event-grid-head">Post-roll (s)</div>
        {keywordRows.map((keyword) => {
          const row = form.split_event_windows?.[keyword] || {};
          return (
            <React.Fragment key={keyword}>
              <div className="settings-event-keyword-row">
                <button
                  type="button"
                  className="secondary settings-keyword-delete"
                  onClick={() => removeKeyword(keyword)}
                  title={`Delete keyword ${keyword}`}
                  aria-label={`Delete keyword ${keyword}`}
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                    <path
                      d="M3 6h18M9 6V4h6v2m-7 4v8m4-8v8m4-8v8"
                      stroke="currentColor"
                      strokeWidth="1.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                    <path
                      d="M6 6l1 14h10l1-14"
                      stroke="currentColor"
                      strokeWidth="1.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </button>
                <span className="settings-event-keyword">{keyword}</span>
              </div>
              <label className="slider-label settings-event-slider">
                <div className="slider-title">
                  <span>{Number(row.pre_seconds ?? sliders.split_pre)}s</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="120"
                  step="1"
                  value={row.pre_seconds ?? sliders.split_pre}
                  onChange={(event) => updateKeywordWindow(keyword, "pre_seconds", event.target.value)}
                />
              </label>
              <label className="slider-label settings-event-slider">
                <div className="slider-title">
                  <span>{Number(row.post_seconds ?? sliders.split_post)}s</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="120"
                  step="1"
                  value={row.post_seconds ?? sliders.split_post}
                  onChange={(event) => updateKeywordWindow(keyword, "post_seconds", event.target.value)}
                />
              </label>
            </React.Fragment>
          );
        })}
      </div>
      <details className="settings-advanced">
        <summary>Advanced</summary>
        <div className="settings-advanced-grid">
          <label>
            Detection Cooldown (seconds)
            <input
              type="number"
              min="0"
              step="0.1"
              value={form.detection_cooldown}
              onChange={(event) => updateField("detection_cooldown", event.target.value)}
            />
          </label>
          <label>
            Default Pre-roll (seconds)
            <input
              type="number"
              min="0"
              step="1"
              value={form.split_pre}
              onChange={(event) => updateField("split_pre", event.target.value)}
            />
          </label>
          <label>
            Default Post-roll (seconds)
            <input
              type="number"
              min="0"
              step="1"
              value={form.split_post}
              onChange={(event) => updateField("split_post", event.target.value)}
            />
          </label>
        </div>
      </details>
    </SettingsPanel>
  );
}
