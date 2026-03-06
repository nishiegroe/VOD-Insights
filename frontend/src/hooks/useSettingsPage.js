import { useEffect, useMemo, useRef, useState } from "react";
import {
  chooseReplayDir,
  fetchConfig,
  fetchGpuStatus,
  fetchLatestUpdate,
  removeOverlayImage,
  saveConfig as saveConfigRequest,
  startSessionControl,
  stopSessionControl,
  uploadOverlayImage,
} from "../api/settings";

const toCommaList = (value) => (Array.isArray(value) ? value.join(", ") : "");
const parseKeywords = (value) =>
  String(value || "")
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);

export default function useSettingsPage() {
  const [form, setForm] = useState(null);
  const [saveState, setSaveState] = useState("idle");
  const [saveError, setSaveError] = useState("");
  const [checkingLatest, setCheckingLatest] = useState(false);
  const [checkingUpdates, setCheckingUpdates] = useState(false);
  const [currentVersion, setCurrentVersion] = useState("");
  const [latestVersion, setLatestVersion] = useState("");
  const [updateAvailable, setUpdateAvailable] = useState(false);
  const [latestError, setLatestError] = useState("");
  const [updateMessage, setUpdateMessage] = useState("");
  const [gpuStatus, setGpuStatus] = useState("");
  const [gpuTesting, setGpuTesting] = useState(false);
  const [newKeyword, setNewKeyword] = useState("");
  const [activeSection, setActiveSection] = useState("capture");
  const [overlayUploading, setOverlayUploading] = useState(false);
  const [overlayStatus, setOverlayStatus] = useState("");

  const replaceFileInputRef = useRef(null);
  const autosaveTimerRef = useRef(null);
  const saveStateTimerRef = useRef(null);
  const didHydrateRef = useRef(false);
  const lastSavedPayloadRef = useRef("");
  const sectionRefs = useRef({});

  const isDesktop = Boolean(window?.aetDesktop);
  const canUpdateApp = Boolean(window?.aetDesktop?.updateApp);
  const canBrowseReplayDir = isDesktop;

  const loadData = async () => {
    const config = await fetchConfig();
    const nextForm = {
      capture_left: config.capture?.left ?? 0,
      capture_top: config.capture?.top ?? 0,
      capture_width: config.capture?.width ?? 0,
      capture_height: config.capture?.height ?? 0,
      capture_fps: config.capture?.fps ?? 30,
      capture_scale: config.capture?.scale ?? 1,
      capture_threshold: config.capture?.threshold ?? 0,
      capture_backend: config.capture?.backend ?? "auto",
      ocr_interval: config.ocr?.interval_seconds ?? 1,
      ocr_engine: config.ocr?.engine ?? "tesseract",
      detection_keywords: toCommaList(config.detection?.keywords),
      detection_cooldown: config.detection?.cooldown_seconds ?? 2,
      record_start: config.recording?.start_on_launch ?? false,
      record_stop: config.recording?.stop_on_exit ?? false,
      record_split: config.recording?.run_split_on_exit ?? false,
      replay_dir: config.replay?.directory ?? "",
      split_pre: config.split?.pre_seconds ?? 0,
      split_post: config.split?.post_seconds ?? 0,
      split_event_windows: config.split?.event_windows ?? {},
      overlay_image_path: config.ui?.overlay_image_path ?? "",
      overlay_enabled: config.ui?.overlay_enabled !== false,
      overlay_opacity: Number.isFinite(Number(config.ui?.overlay_opacity)) ? Number(config.ui.overlay_opacity) : 0.9,
    };
    setForm(nextForm);
    lastSavedPayloadRef.current = JSON.stringify(nextForm);
    didHydrateRef.current = true;
    setSaveState("idle");
    setSaveError("");
  };

  const updateField = (field, value) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const updateKeywords = (keywords) => {
    setForm((prev) => {
      const existing = prev?.split_event_windows || {};
      const nextWindows = {};
      const fallbackPre = Number(prev?.split_pre ?? 0);
      const fallbackPost = Number(prev?.split_post ?? 0);

      keywords.forEach((keyword) => {
        const current = existing[keyword] || {};
        nextWindows[keyword] = {
          pre_seconds: Number(current.pre_seconds ?? fallbackPre),
          post_seconds: Number(current.post_seconds ?? fallbackPost),
        };
      });

      return {
        ...prev,
        detection_keywords: keywords.join(", "),
        split_event_windows: nextWindows,
      };
    });
  };

  const updateKeywordWindow = (keyword, field, value) => {
    setForm((prev) => {
      const windows = { ...(prev?.split_event_windows || {}) };
      const current = windows[keyword] || {
        pre_seconds: Number(prev?.split_pre ?? 0),
        post_seconds: Number(prev?.split_post ?? 0),
      };
      windows[keyword] = {
        ...current,
        [field]: value,
      };
      return {
        ...prev,
        split_event_windows: windows,
      };
    });
  };

  const addKeyword = () => {
    const candidate = newKeyword.trim();
    if (!candidate) {
      return;
    }
    const existing = parseKeywords(form?.detection_keywords || "");
    const exists = existing.some((keyword) => keyword.toLowerCase() === candidate.toLowerCase());
    if (exists) {
      setNewKeyword("");
      return;
    }
    updateKeywords([...existing, candidate]);
    setNewKeyword("");
  };

  const removeKeyword = (keywordToRemove) => {
    const existing = parseKeywords(form?.detection_keywords || "");
    updateKeywords(existing.filter((keyword) => keyword !== keywordToRemove));
  };

  const saveConfig = async (nextForm) => {
    const payload = JSON.stringify(nextForm);
    if (payload === lastSavedPayloadRef.current) {
      return;
    }

    setSaveState("saving");
    setSaveError("");

    try {
      const response = await saveConfigRequest(payload);
      if (!response.ok) {
        throw new Error("Failed to save settings");
      }
      lastSavedPayloadRef.current = payload;
      setSaveState("saved");
      clearTimeout(saveStateTimerRef.current);
      saveStateTimerRef.current = setTimeout(() => {
        setSaveState("idle");
      }, 1400);
    } catch (error) {
      setSaveState("error");
      setSaveError(error?.message || "Failed to save settings");
    }
  };

  const browseReplayDir = async () => {
    if (!canBrowseReplayDir) {
      return;
    }
    const payload = await chooseReplayDir();
    if (payload.directory && form) {
      updateField("replay_dir", payload.directory);
    }
  };

  const startSession = async () => {
    await startSessionControl();
  };

  const stopSession = async () => {
    await stopSessionControl();
  };

  const testGpuOcr = async () => {
    setGpuTesting(true);
    setGpuStatus("");
    try {
      const response = await fetchGpuStatus();
      const payload = await response.json();
      if (!response.ok || !payload.ok) {
        setGpuStatus(payload.error || "GPU check failed");
      } else if (payload.available) {
        setGpuStatus("✓ CUDA GPU detected");
      } else {
        setGpuStatus("✗ No CUDA GPU detected");
      }
    } catch (error) {
      setGpuStatus(error.message || "GPU check failed");
    } finally {
      setGpuTesting(false);
    }
  };

  const checkLatestVersion = async () => {
    if (checkingLatest) {
      return;
    }

    setCheckingLatest(true);
    setLatestError("");
    try {
      const response = await fetchLatestUpdate();
      const payload = await response.json();
      if (!response.ok || !payload?.ok) {
        setLatestError(payload?.error || "Could not fetch latest version.");
        setUpdateAvailable(false);
        return;
      }

      const latest = String(payload.latest_version || "").trim();
      const current = String(payload.current_version || "").trim();

      setCurrentVersion(current);
      setLatestVersion(latest);

      if (!latest) {
        setLatestError("Latest published version is unavailable right now.");
        setUpdateAvailable(false);
        return;
      }

      setUpdateAvailable(Boolean(current && latest !== current));
    } catch (error) {
      setLatestError(error?.message || "Could not fetch latest version.");
      setUpdateAvailable(false);
    } finally {
      setCheckingLatest(false);
    }
  };

  useEffect(() => {
    loadData().catch(() => {});
    checkLatestVersion().catch(() => {});
  }, []);

  const updateApp = async () => {
    if (!canUpdateApp || checkingUpdates) {
      return;
    }

    setCheckingUpdates(true);
    setUpdateMessage("");
    try {
      const result = await window.aetDesktop.updateApp();
      const status = result?.status;
      if (status === "busy") {
        setUpdateMessage("An update check is already in progress.");
      } else if (status === "installing") {
        setUpdateMessage("Launching installer...");
      } else if (status === "up-to-date") {
        setUpdateMessage("You are on the latest version.");
      } else if (status === "not-packaged") {
        setUpdateMessage("Update checks are available only in installed desktop builds.");
      } else if (status === "unsupported-platform") {
        setUpdateMessage("Update checks are currently supported on Windows desktop builds.");
      } else if (status === "disabled") {
        setUpdateMessage("Updater is currently disabled.");
      } else if (status === "metadata-error") {
        setUpdateMessage(result?.error || "Could not check for updates.");
      } else {
        setUpdateMessage("Update action completed.");
      }
    } catch (error) {
      setUpdateMessage(error?.message || "Could not check for updates.");
    } finally {
      setCheckingUpdates(false);
    }
  };

  const sliders = useMemo(
    () => ({
      split_pre: Number(form?.split_pre ?? 0),
      split_post: Number(form?.split_post ?? 0),
    }),
    [form]
  );

  const keywordRows = useMemo(() => parseKeywords(form?.detection_keywords || ""), [form?.detection_keywords]);

  const sections = useMemo(() => {
    const navSections = [
      { id: "capture", label: "Capture" },
      { id: "detection", label: "Detection" },
      { id: "clips", label: "Clips" },
      { id: "ocr", label: "OCR & Performance" },
      { id: "overlay", label: "Overlay" },
      { id: "updates", label: "Updates" },
    ];
    return navSections;
  }, []);

  useEffect(() => {
    if (!form || !didHydrateRef.current) {
      return;
    }

    clearTimeout(autosaveTimerRef.current);
    autosaveTimerRef.current = setTimeout(() => {
      saveConfig(form).catch(() => {});
    }, 500);

    return () => {
      clearTimeout(autosaveTimerRef.current);
    };
  }, [form]);

  useEffect(() => {
    const nodes = sections
      .map((section) => sectionRefs.current[section.id])
      .filter(Boolean);
    if (!nodes.length) {
      return undefined;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((entry) => entry.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio);
        if (visible.length) {
          setActiveSection(visible[0].target.dataset.sectionId);
        }
      },
      {
        root: null,
        threshold: [0.2, 0.45, 0.7],
        rootMargin: "-20% 0px -45% 0px",
      }
    );

    nodes.forEach((node) => observer.observe(node));

    return () => observer.disconnect();
  }, [sections]);

  useEffect(
    () => () => {
      clearTimeout(autosaveTimerRef.current);
      clearTimeout(saveStateTimerRef.current);
    },
    []
  );

  const jumpToSection = (sectionId) => {
    const target = sectionRefs.current[sectionId];
    if (!target) {
      return;
    }
    setActiveSection(sectionId);
    target.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const bindSectionRef = (sectionId) => (node) => {
    sectionRefs.current[sectionId] = node;
  };

  const saveStateLabel =
    saveState === "saving"
      ? "Saving..."
      : saveState === "saved"
        ? "Saved"
        : saveState === "error"
          ? "Save failed"
          : "All changes saved";

  const handleOverlayUpload = async (file) => {
    if (!file) {
      return;
    }
    setOverlayUploading(true);
    setOverlayStatus("");
    try {
      const res = await uploadOverlayImage(file);
      const payload = await res.json();
      if (!res.ok || !payload.ok) {
        throw new Error(payload.error || "Upload failed");
      }
      updateField("overlay_image_path", file.name);
      setOverlayStatus("Image uploaded.");
    } catch (error) {
      setOverlayStatus(error.message || "Upload failed.");
    } finally {
      setOverlayUploading(false);
    }
  };

  const handleOverlayFileChange = async (event) => {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }
    await handleOverlayUpload(file);
    event.target.value = "";
  };

  const handleOverlayRemove = async () => {
    await removeOverlayImage();
    updateField("overlay_image_path", "");
    setOverlayStatus("Overlay removed.");
  };

  const openOverlayReplacePicker = () => {
    replaceFileInputRef.current?.click();
  };

  return {
    form,
    saveState,
    saveError,
    checkingLatest,
    checkingUpdates,
    currentVersion,
    latestVersion,
    updateAvailable,
    latestError,
    updateMessage,
    gpuStatus,
    gpuTesting,
    newKeyword,
    setNewKeyword,
    activeSection,
    overlayUploading,
    overlayStatus,
    replaceFileInputRef,
    canUpdateApp,
    canBrowseReplayDir,
    sliders,
    keywordRows,
    sections,
    updateField,
    updateKeywordWindow,
    addKeyword,
    removeKeyword,
    browseReplayDir,
    startSession,
    stopSession,
    testGpuOcr,
    jumpToSection,
    bindSectionRef,
    updateApp,
    saveStateLabel,
    handleOverlayFileChange,
    handleOverlayRemove,
    openOverlayReplacePicker,
  };
}
