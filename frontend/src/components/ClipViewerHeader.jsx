import { useNavigate } from "react-router-dom";

export default function ClipViewerHeader({
  onBack,
  showClipTools,
  onToggleClipTools,
  onDeleteClip,
  onRenameClip,
  }) {
    const navigate = useNavigate();
    
  return (
    <div className="vod-viewer-header">
      <div className="vod-viewer-header-left">
        <div className="vod-viewer-app-title" onClick={() => navigate("/")}>
          <img src="/logo.png" alt="" className="brand-logo brand-logo-compact" aria-hidden="true" />
          <span>VOD Insights</span>
        </div>
        <button onClick={onBack} className="tertiary">
          ← Back to Clips
        </button>
      </div>
      <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
        <button className="secondary" onClick={onToggleClipTools}>
          {showClipTools ? "Hide Clip" : "Clip"}
        </button>
        <button
          type="button"
          className="icon-button"
          onClick={onRenameClip}
          title="Rename Clip"
          aria-label="Rename Clip"
        >
            Rename
        </button>
        <button
          type="button"
          className="icon-button danger"
          onClick={onDeleteClip}
          title="Delete Clip"
          aria-label="Delete Clip"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
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
      </div>
    </div>
  );
}