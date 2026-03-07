import React from "react";

function SkeletonBlock({ className = "", style }) {
  return <div className={`skeleton-block ${className}`.trim()} style={style} aria-hidden="true" />;
}

function SkeletonLine({ className = "", style }) {
  return <div className={`skeleton-line ${className}`.trim()} style={style} aria-hidden="true" />;
}

function SkeletonCard({ className = "", children }) {
  return <section className={`card skeleton-card ${className}`.trim()}>{children}</section>;
}

export function TileSkeleton() {
  return (
    <div className="clip-tile skeleton-tile" aria-hidden="true">
      <SkeletonBlock className="skeleton-thumb" />
      <SkeletonLine style={{ width: "70%" }} />
      <SkeletonLine style={{ width: "92%" }} />
      <SkeletonLine style={{ width: "55%" }} />
    </div>
  );
}

function ViewerSkeleton() {
  return (
    <section className="vod-viewer-page">
      <div className="vod-viewer skeleton-viewer-shell">
        <SkeletonBlock className="skeleton-viewer-header" />
        <div className="vod-content-wrapper skeleton-viewer-content">
          <div className="vod-left-section">
            <SkeletonBlock className="skeleton-video" />
            <SkeletonBlock className="skeleton-controls" />
            <SkeletonBlock className="skeleton-controls" />
          </div>
          <div className="bookmark-panel" style={{ borderStyle: "solid" }}>
            <SkeletonLine style={{ width: "58%" }} />
            <SkeletonLine style={{ width: "100%" }} />
            <SkeletonLine style={{ width: "88%" }} />
            <SkeletonLine style={{ width: "76%" }} />
            <SkeletonLine style={{ width: "92%" }} />
          </div>
        </div>
      </div>
    </section>
  );
}

export function HomePageSkeleton() {
  return (
    <div className="skeleton-page" aria-label="Loading Home page">
      <SkeletonCard>
        <div className="skeleton-header-row">
          <SkeletonLine style={{ width: "28%", height: 28 }} />
          <SkeletonBlock className="skeleton-pill" style={{ width: 112 }} />
        </div>
        <div className="clip-group-grid">
          <TileSkeleton />
          <TileSkeleton />
          <TileSkeleton />
        </div>
      </SkeletonCard>

      <SkeletonCard>
        <div className="skeleton-header-row">
          <SkeletonLine style={{ width: "26%", height: 28 }} />
          <SkeletonBlock className="skeleton-pill" style={{ width: 112 }} />
        </div>
        <div className="clip-group-grid">
          <TileSkeleton />
          <TileSkeleton />
          <TileSkeleton />
        </div>
      </SkeletonCard>
    </div>
  );
}

export function VodsPageSkeleton() {
  return (
    <section className="grid skeleton-page" aria-label="Loading VODs page">
      <SkeletonCard>
        <div className="card-header-with-actions">
          <SkeletonLine style={{ width: "22%", height: 28 }} />
          <div className="card-header-actions">
            <SkeletonBlock className="skeleton-pill" style={{ width: 128 }} />
            <SkeletonBlock className="skeleton-pill" style={{ width: 112 }} />
            <SkeletonBlock className="skeleton-pill" style={{ width: 42 }} />
          </div>
        </div>
        <div className="vod-list">
          <div className="vod-item skeleton-vod-item">
            <SkeletonBlock className="skeleton-vod-preview" />
            <div className="vod-info">
              <SkeletonLine style={{ width: "50%" }} />
              <SkeletonLine style={{ width: "85%" }} />
              <SkeletonLine style={{ width: "65%" }} />
            </div>
            <div className="vod-actions">
              <SkeletonBlock className="skeleton-pill" style={{ width: "100%", height: 44 }} />
              <SkeletonBlock className="skeleton-pill" style={{ width: "100%", height: 44 }} />
            </div>
          </div>
          <div className="vod-item skeleton-vod-item">
            <SkeletonBlock className="skeleton-vod-preview" />
            <div className="vod-info">
              <SkeletonLine style={{ width: "42%" }} />
              <SkeletonLine style={{ width: "74%" }} />
              <SkeletonLine style={{ width: "58%" }} />
            </div>
            <div className="vod-actions">
              <SkeletonBlock className="skeleton-pill" style={{ width: "100%", height: 44 }} />
              <SkeletonBlock className="skeleton-pill" style={{ width: "100%", height: 44 }} />
            </div>
          </div>
        </div>
      </SkeletonCard>
    </section>
  );
}

export function ClipsPageSkeleton() {
  return (
    <section className="card clip-viewer clip-reimagined skeleton-card" aria-label="Loading Clips page">
      <div className="clips-header">
        <div className="clips-header-title" style={{ width: "100%" }}>
          <SkeletonLine style={{ width: "20%", height: 30 }} />
          <SkeletonLine style={{ width: "40%" }} />
        </div>
        <SkeletonBlock className="skeleton-pill" style={{ width: 120, height: 42 }} />
      </div>
      <div className="clip-group-grid clips-grid skeleton-clips-grid">
        <TileSkeleton />
        <TileSkeleton />
        <TileSkeleton />
        <TileSkeleton />
        <TileSkeleton />
      </div>
    </section>
  );
}

export function SettingsPageSkeleton() {
  return (
    <div className="settings-page skeleton-page" aria-label="Loading Settings page">
      <section className="card settings-shell skeleton-card">
        <header className="settings-header-row">
          <div style={{ width: "100%" }}>
            <SkeletonLine style={{ width: "18%", height: 30 }} />
            <SkeletonLine style={{ width: "52%" }} />
          </div>
          <SkeletonBlock className="skeleton-pill" style={{ width: 120, height: 32 }} />
        </header>
        <div className="settings-layout skeleton-settings-layout">
          <div className="settings-nav" style={{ position: "static" }}>
            <SkeletonBlock className="skeleton-pill" style={{ height: 34 }} />
            <SkeletonBlock className="skeleton-pill" style={{ height: 34 }} />
            <SkeletonBlock className="skeleton-pill" style={{ height: 34 }} />
            <SkeletonBlock className="skeleton-pill" style={{ height: 34 }} />
          </div>
          <div className="settings-content skeleton-settings-content">
            <div className="settings-panel skeleton-panel">
              <SkeletonLine style={{ width: "32%", height: 24 }} />
              <SkeletonLine style={{ width: "70%" }} />
              <SkeletonBlock style={{ height: 38 }} />
              <SkeletonBlock style={{ height: 38 }} />
            </div>
            <div className="settings-panel skeleton-panel">
              <SkeletonLine style={{ width: "28%", height: 24 }} />
              <SkeletonLine style={{ width: "54%" }} />
              <SkeletonBlock style={{ height: 96 }} />
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}

export function CaptureAreaPageSkeleton() {
  return (
    <section className="card skeleton-card" aria-label="Loading Capture Area page">
      <SkeletonLine style={{ width: "28%", height: 28 }} />
      <SkeletonLine style={{ width: "56%" }} />
      <SkeletonBlock style={{ height: 420, borderRadius: 12 }} />
      <div className="skeleton-header-row">
        <SkeletonBlock className="skeleton-pill" style={{ width: "30%", height: 38 }} />
        <SkeletonBlock className="skeleton-pill" style={{ width: "30%", height: 38 }} />
        <SkeletonBlock className="skeleton-pill" style={{ width: "30%", height: 38 }} />
      </div>
    </section>
  );
}

export function TwitchImportPageSkeleton() {
  return (
    <section className="card skeleton-card" aria-label="Loading Twitch Import page">
      <SkeletonLine style={{ width: "24%", height: 28 }} />
      <SkeletonLine style={{ width: "90%" }} />
      <div className="input-row">
        <SkeletonBlock style={{ height: 44, flex: 1, borderRadius: 10 }} />
        <SkeletonBlock className="skeleton-pill" style={{ width: 180, height: 44 }} />
      </div>
      <div className="vod-list">
        <div className="vod-item skeleton-vod-item">
          <div className="vod-info">
            <SkeletonLine style={{ width: "72%" }} />
            <SkeletonLine style={{ width: "44%" }} />
            <SkeletonBlock style={{ height: 10, borderRadius: 999 }} />
          </div>
        </div>
        <div className="vod-item skeleton-vod-item">
          <div className="vod-info">
            <SkeletonLine style={{ width: "68%" }} />
            <SkeletonLine style={{ width: "38%" }} />
            <SkeletonBlock style={{ height: 10, borderRadius: 999 }} />
          </div>
        </div>
      </div>
    </section>
  );
}

export function OverlayToolPageSkeleton() {
  return (
    <section className="card skeleton-card" aria-label="Loading Overlay Tool page">
      <div className="skeleton-header-row">
        <SkeletonLine style={{ width: "30%", height: 24 }} />
        <SkeletonLine style={{ width: "44%" }} />
      </div>
      <SkeletonBlock style={{ height: 420, borderRadius: 10 }} />
      <div className="skeleton-header-row">
        <SkeletonBlock style={{ height: 38, borderRadius: 10, width: "48%" }} />
        <SkeletonBlock style={{ height: 38, borderRadius: 10, width: "48%" }} />
      </div>
    </section>
  );
}

export function VodViewerPageSkeleton() {
  return <ViewerSkeleton />;
}

export function ClipsViewerPageSkeleton() {
  return <ViewerSkeleton />;
}
