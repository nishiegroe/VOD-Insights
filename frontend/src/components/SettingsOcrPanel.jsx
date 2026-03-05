import React from "react";
import SettingsPanel from "./SettingsPanel";

export default function SettingsOcrPanel({
  bindSectionRef,
  form,
  updateField,
  testGpuOcr,
  gpuTesting,
  gpuStatus,
}) {
  return (
    <SettingsPanel
      sectionId="ocr"
      bindSectionRef={bindSectionRef}
      title="OCR & Performance"
    >
      <label>
        OCR Engine
        <select
          value={form.ocr_engine}
          onChange={(event) => updateField("ocr_engine", event.target.value)}
        >
          <option value="tesseract">Tesseract (CPU)</option>
          <option value="easyocr">EasyOCR (GPU capable)</option>
        </select>
      </label>
      <div className="input-row settings-ocr-actions">
        <button type="button" className="secondary" onClick={testGpuOcr} disabled={gpuTesting}>
          {gpuTesting ? "Testing..." : "Test GPU OCR"}
        </button>
      </div>
      {gpuStatus ? <p className="hint settings-inline-status">{gpuStatus}</p> : null}

      <details className="settings-advanced">
        <summary>Advanced</summary>
        <div className="settings-advanced-grid">
          <label>
            OCR Interval (seconds)
            <input
              type="number"
              min="0.1"
              step="0.1"
              value={form.ocr_interval}
              onChange={(event) => updateField("ocr_interval", event.target.value)}
            />
          </label>
        </div>
      </details>
    </SettingsPanel>
  );
}
