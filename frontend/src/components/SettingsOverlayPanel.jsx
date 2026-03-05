import React from "react";
import SettingsPanel from "./SettingsPanel";

export default function SettingsOverlayPanel({
  bindSectionRef,
  form,
  replaceFileInputRef,
  handleOverlayFileChange,
  openOverlayReplacePicker,
  overlayUploading,
  handleOverlayRemove,
  overlayStatus,
  updateField,
}) {
  return (
    <SettingsPanel
      sectionId="overlay"
      bindSectionRef={bindSectionRef}
      title="Overlay"
      subtitle="Add a logo or image that appears over the video on the VOD Viewer and Clips pages. The image is not burned into video files."
    >
      {form.overlay_image_path ? (
        <div style={{ display: "flex", alignItems: "center", gap: "14px", padding: "12px 14px", background: "var(--surface-raised, var(--surface))", border: "1px solid var(--border)", borderRadius: "8px", marginBottom: "16px" }}>
          <img
            src="/api/overlay/image"
            alt="overlay preview"
            style={{ height: "48px", maxWidth: "100px", objectFit: "contain", borderRadius: "4px", flexShrink: 0 }}
          />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontWeight: 600, fontSize: "14px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {form.overlay_image_path.split(/[\\/]/).pop()}
            </div>
            <div style={{ fontSize: "12px", color: "var(--text-secondary)", marginTop: "2px" }}>Current overlay image</div>
          </div>
          <div style={{ display: "flex", gap: "8px", flexShrink: 0, alignItems: "center" }}>
            <input
              ref={replaceFileInputRef}
              type="file"
              accept="image/png,image/jpeg,image/gif,image/webp"
              style={{ display: "none" }}
              onChange={handleOverlayFileChange}
            />
            <button
              type="button"
              className="secondary"
              style={{ fontSize: "13px", padding: "6px 12px" }}
              onClick={openOverlayReplacePicker}
            >
              {overlayUploading ? "Uploading..." : "Replace"}
            </button>
            <button
              type="button"
              className="secondary"
              style={{ fontSize: "13px", padding: "6px 12px" }}
              onClick={handleOverlayRemove}
            >
              Remove
            </button>
          </div>
        </div>
      ) : (
        <div style={{ marginBottom: "16px" }}>
          <label style={{ cursor: "pointer" }} title="Choose an image to use as overlay">
            <input
              type="file"
              accept="image/png,image/jpeg,image/gif,image/webp,image/svg+xml"
              style={{ display: "none" }}
              onChange={handleOverlayFileChange}
            />
            <span className="secondary" style={{ display: "inline-block", padding: "6px 14px", borderRadius: "6px", border: "1px solid var(--border)", cursor: "pointer", fontSize: "14px" }}>
              {overlayUploading ? "Uploading..." : "Upload Image"}
            </span>
          </label>
        </div>
      )}

      {overlayStatus ? (
        <p className="hint settings-inline-status" style={{ marginTop: "-8px", marginBottom: "12px" }}>{overlayStatus}</p>
      ) : null}

      {form.overlay_image_path ? (
        <>
          <label className="check-row" style={{ display: "flex", marginBottom: "16px" }}>
            <input
              type="checkbox"
              checked={form.overlay_enabled}
              onChange={(event) => updateField("overlay_enabled", event.target.checked)}
            />
            <span>Show overlay on VODs and clips</span>
          </label>
          <label className="slider-label">
            <div className="slider-title">
              <span>Opacity: {Math.round(form.overlay_opacity * 100)}%</span>
            </div>
            <input
              type="range"
              min="5"
              max="100"
              step="1"
              value={Math.round(form.overlay_opacity * 100)}
              onChange={(event) => updateField("overlay_opacity", Number(event.target.value) / 100)}
            />
          </label>
          <div style={{ marginTop: "16px", display: "flex", alignItems: "center", gap: "12px" }}>
            <button
              type="button"
              className="secondary"
              onClick={() => (window.location.href = "/overlay-tool")}
            >
              Open Overlay Placement Tool
            </button>
            <span className="hint" style={{ margin: 0 }}>Drag to position and set size.</span>
          </div>
        </>
      ) : null}
    </SettingsPanel>
  );
}
