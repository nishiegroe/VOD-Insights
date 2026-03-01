import React, { useEffect, useRef, useState } from "react";

export default function OverlayTool() {
  const previewRef = useRef(null);
  const overlayImgRef = useRef(null);
  const bgFileRef = useRef(null);
  const objectUrlRef = useRef(null);
  const dragRef = useRef(null);

  const [config, setConfig] = useState({
    has_overlay: false,
    x: 0.85,
    y: 0.88,
    width: 0.15,
    opacity: 0.9,
  });
  const [bgSrc, setBgSrc] = useState(null);
  const [saveStatus, setSaveStatus] = useState("");
  const [overlayError, setOverlayError] = useState(false);

  useEffect(() => {
    fetch("/api/config")
      .then((r) => r.json())
      .then((data) => {
        const ui = data.ui || {};
        setConfig({
          has_overlay: Boolean(ui.overlay_image_path),
          x: Number.isFinite(Number(ui.overlay_x)) ? Number(ui.overlay_x) : 0.85,
          y: Number.isFinite(Number(ui.overlay_y)) ? Number(ui.overlay_y) : 0.88,
          width: Number.isFinite(Number(ui.overlay_width)) ? Number(ui.overlay_width) : 0.15,
          opacity: Number.isFinite(Number(ui.overlay_opacity)) ? Number(ui.overlay_opacity) : 0.9,
        });
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    return () => {
      if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current);
    };
  }, []);

  const handleBgFileChange = (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current);
    objectUrlRef.current = URL.createObjectURL(file);
    setBgSrc(objectUrlRef.current);
  };

  const handlePointerDown = (event) => {
    event.preventDefault();
    const img = overlayImgRef.current;
    const preview = previewRef.current;
    if (!img || !preview) return;

    const previewRect = preview.getBoundingClientRect();
    const imgRect = img.getBoundingClientRect();
    const centerX = imgRect.left + imgRect.width / 2;
    const centerY = imgRect.top + imgRect.height / 2;
    const offsetX = event.clientX - centerX;
    const offsetY = event.clientY - centerY;

    dragRef.current = { previewRect, offsetX, offsetY };

    const handleMove = (e) => {
      const drag = dragRef.current;
      if (!drag) return;
      const x = Math.max(0, Math.min(1, (e.clientX - drag.offsetX - drag.previewRect.left) / drag.previewRect.width));
      const y = Math.max(0, Math.min(1, (e.clientY - drag.offsetY - drag.previewRect.top) / drag.previewRect.height));
      setConfig((prev) => ({ ...prev, x, y }));
    };

    const handleUp = () => {
      dragRef.current = null;
      window.removeEventListener("pointermove", handleMove);
      window.removeEventListener("pointerup", handleUp);
      window.removeEventListener("pointercancel", handleUp);
    };

    window.addEventListener("pointermove", handleMove);
    window.addEventListener("pointerup", handleUp);
    window.addEventListener("pointercancel", handleUp);
  };

  const handleSave = async () => {
    setSaveStatus("Saving...");
    try {
      const response = await fetch("/api/config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          overlay_x: config.x,
          overlay_y: config.y,
          overlay_width: config.width,
          overlay_opacity: config.opacity,
        }),
      });
      if (!response.ok) throw new Error("Save failed");
      setSaveStatus("Saved!");
      setTimeout(() => setSaveStatus(""), 2000);
    } catch {
      setSaveStatus("Save failed.");
    }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", gap: 0 }}>

      {/* Top bar */}
      <div style={{ display: "flex", alignItems: "center", gap: "14px", padding: "12px 0", borderBottom: "1px solid var(--border)", flexShrink: 0 }}>
        <h2 style={{ margin: 0, fontSize: "16px", fontWeight: 600 }}>Overlay Placement Tool</h2>
        <p className="hint" style={{ margin: 0, fontSize: "13px" }}>
          Drag the overlay to position it. Adjustments apply within the actual video area (no black bars).
        </p>
        <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: "10px", flexShrink: 0 }}>
          <input
            ref={bgFileRef}
            type="file"
            accept="image/*"
            style={{ display: "none" }}
            onChange={handleBgFileChange}
          />
          <button
            type="button"
            className="secondary"
            style={{ fontSize: "13px", padding: "6px 12px" }}
            onClick={() => bgFileRef.current?.click()}
          >
            Load Screenshot
          </button>
          {saveStatus ? <span className="hint" style={{ margin: 0, fontSize: "13px" }}>{saveStatus}</span> : null}
          <button type="button" className="primary" onClick={handleSave} disabled={!config.has_overlay} style={{ fontSize: "13px", padding: "6px 14px" }}>
            Save to Config
          </button>
        </div>
      </div>

      {/* Preview area — fills remaining height, centers the 16:9 box */}
      <div style={{ flex: 1, minHeight: 0, display: "flex", alignItems: "center", justifyContent: "center", padding: "16px 0" }}>
        <div
          ref={previewRef}
          style={{
            position: "relative",
            height: "100%",
            aspectRatio: "16 / 9",
            maxWidth: "100%",
            background: bgSrc
              ? `url(${bgSrc}) center / cover no-repeat`
              : "repeating-conic-gradient(#1a2830 0% 25%, #0c171b 0% 50%) 0 0 / 32px 32px",
            borderRadius: "8px",
            overflow: "hidden",
            border: "1px solid var(--border)",
          }}
        >
          {!config.has_overlay ? (
            <div
              style={{
                position: "absolute",
                inset: 0,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "var(--text-secondary)",
                fontSize: "14px",
                textAlign: "center",
                padding: "16px",
              }}
            >
              No overlay image set. Upload one in Settings → Overlay first.
            </div>
          ) : overlayError ? (
            <div
              style={{
                position: "absolute",
                inset: 0,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "var(--accent-2)",
                fontSize: "14px",
              }}
            >
              Could not load overlay image.
            </div>
          ) : (
            <img
              ref={overlayImgRef}
              src="/api/overlay/image"
              alt="overlay"
              onError={() => setOverlayError(true)}
              onPointerDown={handlePointerDown}
              draggable={false}
              style={{
                position: "absolute",
                left: `${config.x * 100}%`,
                top: `${config.y * 100}%`,
                transform: "translate(-50%, -50%)",
                width: `${config.width * 100}%`,
                height: "auto",
                opacity: config.opacity,
                cursor: dragRef.current ? "grabbing" : "grab",
                userSelect: "none",
                touchAction: "none",
                maxWidth: "80%",
              }}
            />
          )}
        </div>
      </div>

      {/* Bottom controls */}
      <div style={{ flexShrink: 0, borderTop: "1px solid var(--border)", padding: "12px 0", display: "flex", alignItems: "center", gap: "24px" }}>
        <label className="slider-label" style={{ flex: 1, margin: 0 }}>
          <div className="slider-title" style={{ marginBottom: "4px" }}>
            <span>Size: {Math.round(config.width * 100)}% of video width</span>
          </div>
          <input
            type="range"
            min="3"
            max="50"
            step="1"
            value={Math.round(config.width * 100)}
            onChange={(e) => setConfig((prev) => ({ ...prev, width: Number(e.target.value) / 100 }))}
          />
        </label>

        <label className="slider-label" style={{ flex: 1, margin: 0 }}>
          <div className="slider-title" style={{ marginBottom: "4px" }}>
            <span>Opacity: {Math.round(config.opacity * 100)}%</span>
          </div>
          <input
            type="range"
            min="5"
            max="100"
            step="1"
            value={Math.round(config.opacity * 100)}
            onChange={(e) => setConfig((prev) => ({ ...prev, opacity: Number(e.target.value) / 100 }))}
          />
        </label>

        <div style={{ flexShrink: 0, fontSize: "12px", color: "var(--text-secondary)", fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap" }}>
          X: {Math.round(config.x * 100)}% &nbsp; Y: {Math.round(config.y * 100)}%
        </div>
      </div>

    </div>
  );
}
