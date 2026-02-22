import React, { useEffect, useRef, useState } from "react";

const MIN_SIZE_PX = 20;

const clamp = (value, min, max) => Math.min(Math.max(value, min), max);

export default function CaptureArea() {
  const videoRef = useRef(null);
  const overlayRef = useRef(null);
  const boxRef = useRef(null);
  const fileRef = useRef(null);
  const objectUrlRef = useRef(null);
  const stateRef = useRef({
    norm: { x: 0.4, y: 0.4, w: 0.2, h: 0.2 },
    drag: null,
    handle: null,
  });

  const [configDefaults, setConfigDefaults] = useState({
    left: 0,
    top: 0,
    width: 0,
    height: 0,
    targetWidth: 0,
    targetHeight: 0,
  });
  const [values, setValues] = useState({ left: 0, top: 0, width: 0, height: 0 });
  const [targetWidth, setTargetWidth] = useState(0);
  const [targetHeight, setTargetHeight] = useState(0);
  const [saveStatus, setSaveStatus] = useState("");

  useEffect(() => {
    const load = async () => {
      const response = await fetch("/api/config");
      const payload = await response.json();
      const capture = payload.capture || {};
      const nextDefaults = {
        left: capture.left || 0,
        top: capture.top || 0,
        width: capture.width || 0,
        height: capture.height || 0,
        targetWidth: capture.target_width || 0,
        targetHeight: capture.target_height || 0,
      };
      setConfigDefaults(nextDefaults);
      setTargetWidth(nextDefaults.targetWidth || 0);
      setTargetHeight(nextDefaults.targetHeight || 0);
    };

    load().catch(() => {});
  }, []);

  useEffect(() => {
    return () => {
      if (objectUrlRef.current) {
        URL.revokeObjectURL(objectUrlRef.current);
        objectUrlRef.current = null;
      }
    };
  }, []);

  // Initialize box position from config on page load
  useEffect(() => {
    if (!configDefaults.targetWidth || !configDefaults.targetHeight) return;
    
    const overlay = overlayRef.current;
    const box = boxRef.current;
    if (!overlay || !box) return;
    
    const minNorm = {
      w: 0.02,
      h: 0.02,
    };
    
    // Calculate normalized position from config
    if (configDefaults.width > 0 && configDefaults.height > 0) {
      const x = clamp(configDefaults.left / configDefaults.targetWidth, 0, 1);
      const y = clamp(configDefaults.top / configDefaults.targetHeight, 0, 1);
      const w = clamp(configDefaults.width / configDefaults.targetWidth, minNorm.w, 1 - x);
      const h = clamp(configDefaults.height / configDefaults.targetHeight, minNorm.h, 1 - y);
      stateRef.current.norm = { x, y, w, h };
      
      // Position the box visually using the overlay dimensions
      const rect = overlay.getBoundingClientRect();
      if (rect.width && rect.height) {
        box.style.left = `${x * rect.width}px`;
        box.style.top = `${y * rect.height}px`;
        box.style.width = `${w * rect.width}px`;
        box.style.height = `${h * rect.height}px`;
        
        overlay.classList.add("active");
        
        setValues({
          left: Math.round(x * configDefaults.targetWidth),
          top: Math.round(y * configDefaults.targetHeight),
          width: Math.round(w * configDefaults.targetWidth),
          height: Math.round(h * configDefaults.targetHeight),
        });
      }
    }
  }, [configDefaults]);

  useEffect(() => {
    const video = videoRef.current;
    const overlay = overlayRef.current;
    const box = boxRef.current;
    if (!video || !overlay || !box) return undefined;

    let resizeObserver = null;

    const getOverlayRect = () => video.getBoundingClientRect();

    const getMinNorm = () => {
      const rect = getOverlayRect();
      return {
        w: rect.width ? MIN_SIZE_PX / rect.width : 0.02,
        h: rect.height ? MIN_SIZE_PX / rect.height : 0.02,
      };
    };

    const updateValues = () => {
      const targetW = configDefaults.targetWidth || video.videoWidth;
      const targetH = configDefaults.targetHeight || video.videoHeight;
      if (!targetW || !targetH) {
        return;
      }
      const { x, y, w, h } = stateRef.current.norm;

      setValues({
        left: Math.round(x * targetW),
        top: Math.round(y * targetH),
        width: Math.round(w * targetW),
        height: Math.round(h * targetH),
      });
    };

    const syncBox = () => {
      const rect = getOverlayRect();
      if (!rect.width || !rect.height) {
        return;
      }
      const { x, y, w, h } = stateRef.current.norm;
      box.style.left = `${x * rect.width}px`;
      box.style.top = `${y * rect.height}px`;
      box.style.width = `${w * rect.width}px`;
      box.style.height = `${h * rect.height}px`;
      updateValues();
    };

    const setDefaultFromConfig = () => {
      const targetW = configDefaults.targetWidth || video.videoWidth;
      const targetH = configDefaults.targetHeight || video.videoHeight;
      if (!targetW || !targetH) {
        return;
      }
      const minNorm = getMinNorm();
      if (configDefaults.width > 0 && configDefaults.height > 0) {
        const x = clamp(configDefaults.left / targetW, 0, 1);
        const y = clamp(configDefaults.top / targetH, 0, 1);
        const w = clamp(configDefaults.width / targetW, minNorm.w, 1 - x);
        const h = clamp(configDefaults.height / targetH, minNorm.h, 1 - y);
        stateRef.current.norm = { x, y, w, h };
      } else {
        const w = minNorm.w;
        const h = minNorm.h;
        const x = clamp(0.5 - w / 2, 0, 1 - w);
        const y = clamp(0.5 - h / 2, 0, 1 - h);
        stateRef.current.norm = { x, y, w, h };
      }
      syncBox();
    };

    const waitForLayout = () => {
      const rect = getOverlayRect();
      if (!rect.width || !rect.height) {
        requestAnimationFrame(waitForLayout);
        return;
      }
      setDefaultFromConfig();
      syncBox();
    };

    const onDrag = (event) => {
      const drag = stateRef.current.drag;
      if (!drag) return;
      const { startX, startY, startNorm, rect } = drag;
      const dx = (event.clientX - startX) / rect.width;
      const dy = (event.clientY - startY) / rect.height;

      if (!stateRef.current.handle) {
        const x = clamp(startNorm.x + dx, 0, 1 - startNorm.w);
        const y = clamp(startNorm.y + dy, 0, 1 - startNorm.h);
        stateRef.current.norm = { ...startNorm, x, y };
      } else {
        let { x, y, w, h } = startNorm;
        const minNorm = getMinNorm();
        const handle = stateRef.current.handle;

        if (handle.includes("n")) {
          const newY = clamp(y + dy, 0, y + h - minNorm.h);
          h = h - (newY - y);
          y = newY;
        }
        if (handle.includes("s")) {
          h = clamp(h + dy, minNorm.h, 1 - y);
        }
        if (handle.includes("w")) {
          const newX = clamp(x + dx, 0, x + w - minNorm.w);
          w = w - (newX - x);
          x = newX;
        }
        if (handle.includes("e")) {
          w = clamp(w + dx, minNorm.w, 1 - x);
        }
        stateRef.current.norm = { x, y, w, h };
      }
      syncBox();
    };

    const endDrag = () => {
      stateRef.current.drag = null;
      stateRef.current.handle = null;
      window.removeEventListener("pointermove", onDrag);
      window.removeEventListener("pointerup", endDrag);
    };

    const startDrag = (event, handle) => {
      event.preventDefault();
      const rect = getOverlayRect();
      stateRef.current.drag = {
        startX: event.clientX,
        startY: event.clientY,
        startNorm: { ...stateRef.current.norm },
        rect,
      };
      stateRef.current.handle = handle;
      window.addEventListener("pointermove", onDrag);
      window.addEventListener("pointerup", endDrag);
    };

    const onBoxPointerDown = (event) => startDrag(event, null);
    box.addEventListener("pointerdown", onBoxPointerDown);

    const handles = Array.from(box.querySelectorAll(".handle"));
    handles.forEach((handle) => {
      const dataHandle = handle.getAttribute("data-handle") || "";
      const onHandlePointerDown = (event) => {
        event.stopPropagation(); // Prevent bubbling to box element
        startDrag(event, dataHandle);
      };
      handle.addEventListener("pointerdown", onHandlePointerDown);
      handle._handler = onHandlePointerDown;
    });

    const onLoadedMetadata = () => {
      overlay.classList.add("active");
      waitForLayout();
    };

    video.addEventListener("loadedmetadata", onLoadedMetadata);

    // If video is already loaded when config changes, update the box position
    if (video.readyState >= 1 && video.videoWidth > 0) {
      overlay.classList.add("active");
      setDefaultFromConfig();
    }

    resizeObserver = new ResizeObserver(() => {
      syncBox();
    });
    resizeObserver.observe(video);

    const resetSelection = () => {
      setDefaultFromConfig();
    };

    const resetButton = document.getElementById("reset-selection");
    resetButton?.addEventListener("click", resetSelection);

    const cleanup = () => {
      box.removeEventListener("pointerdown", onBoxPointerDown);
      handles.forEach((handle) => {
        if (handle._handler) {
          handle.removeEventListener("pointerdown", handle._handler);
        }
      });
      video.removeEventListener("loadedmetadata", onLoadedMetadata);
      resetButton?.removeEventListener("click", resetSelection);
      resizeObserver?.disconnect();
    };

    return cleanup;
  }, [configDefaults]);

  const handleFileChange = (event) => {
    const file = event.target.files && event.target.files[0];
    if (!file || !videoRef.current) return;
    if (objectUrlRef.current) {
      URL.revokeObjectURL(objectUrlRef.current);
    }
    const url = URL.createObjectURL(file);
    objectUrlRef.current = url;
    videoRef.current.src = url;
    videoRef.current.load();
  };

  const handleSave = async () => {
    const payload = {
      left: values.left,
      top: values.top,
      width: values.width,
      height: values.height,
      target_width: Number(targetWidth) || 0,
      target_height: Number(targetHeight) || 0,
    };
    const response = await fetch("/capture-area/save", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!response.ok) {
      setSaveStatus("Save failed. Check the values and try again.");
      return;
    }
    setSaveStatus("Saved! The capture settings are updated.");
  };

  return (
    <div>
      <section className="card">
        <h2>Load VOD</h2>
        <div className="input-row">
          <input ref={fileRef} id="vod-file" type="file" accept="video/*" onChange={handleFileChange} />
          <button type="button" className="secondary" id="reset-selection">
            Reset Box
          </button>
        </div>
        <p className="hint">The VOD does not upload. It stays local and only used for sizing.</p>
      </section>

      <section className="card">
        <h2>Selection</h2>
        <div className="capture-stage">
          <div className="capture-frame" id="capture-frame">
            <video id="capture-video" ref={videoRef} controls></video>
            <div id="capture-overlay" className="capture-overlay" ref={overlayRef}></div>
            <div id="capture-box" className="capture-box" ref={boxRef}>
              <span className="handle nw" data-handle="nw"></span>
              <span className="handle ne" data-handle="ne"></span>
              <span className="handle sw" data-handle="sw"></span>
              <span className="handle se" data-handle="se"></span>
            </div>
          </div>
        </div>
        <div className="capture-target">
          <div className="capture-target-title">Target Monitor Resolution</div>
          <div className="input-row">
            <label>
              Width
              <input
                type="number"
                min="1"
                value={targetWidth}
                onChange={(event) => setTargetWidth(event.target.value)}
              />
            </label>
            <label>
              Height
              <input
                type="number"
                min="1"
                value={targetHeight}
                onChange={(event) => setTargetHeight(event.target.value)}
              />
            </label>
          </div>
          <p className="hint">Saved coords are scaled to this resolution.</p>
        </div>
        <div className="capture-values">
          <div>
            <div className="capture-label">Left</div>
            <div className="capture-value">{values.left}</div>
          </div>
          <div>
            <div className="capture-label">Top</div>
            <div className="capture-value">{values.top}</div>
          </div>
          <div>
            <div className="capture-label">Width</div>
            <div className="capture-value">{values.width}</div>
          </div>
          <div>
            <div className="capture-label">Height</div>
            <div className="capture-value">{values.height}</div>
          </div>
        </div>
        <div className="capture-actions">
          <button type="button" className="primary" onClick={handleSave}>
            Save to Config
          </button>
          <div className="hint">{saveStatus}</div>
        </div>
      </section>
    </div>
  );
}
