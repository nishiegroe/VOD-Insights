import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  chooseReplayDir,
  clearVodSessions,
  createVodsStream,
  deleteVod,
  fetchConfig,
  fetchVods,
  openBackendLog,
  setVodsWizardCompleted,
  splitSelected,
  startVodScan,
  stopVodScan,
  uploadVodFile,
} from "../api/vods";

export default function useVodsPage() {
  const WIZARD_STEP_START_SCAN = 1;
  const WIZARD_STEP_LET_IT_RUN = 2;

  const [vods, setVods] = useState([]);
  const [remaining, setRemaining] = useState(0);
  const [loadingAll, setLoadingAll] = useState(false);
  const [splitLoading, setSplitLoading] = useState({});
  const [toast, setToast] = useState(null);
  const [showAll, setShowAll] = useState(false);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [showDownloadModal, setShowDownloadModal] = useState(false);
  const [uploadState, setUploadState] = useState({
    fileName: "No file selected",
    progress: 0,
    status: "Waiting for upload...",
    uploading: false,
  });
  const [recordingDir, setRecordingDir] = useState(null);
  const [configLoaded, setConfigLoaded] = useState(false);
  const [wizardCompleted, setWizardCompleted] = useState(null);
  const [wizardVisible, setWizardVisible] = useState(false);
  const [wizardStep, setWizardStep] = useState(0);
  const [wizardSpotlightRect, setWizardSpotlightRect] = useState(null);
  const [wizardPanelStyle, setWizardPanelStyle] = useState(null);

  const navigate = useNavigate();
  const eventSourceRef = useRef(null);
  const fileInputRef = useRef(null);
  const dropRef = useRef(null);
  const toastTimerRef = useRef(null);

  const completeWizard = async () => {
    setWizardCompleted(true);
    setWizardVisible(false);
    try {
      await setVodsWizardCompleted(true);
    } catch (error) {
      // Ignore persistence errors.
    }
  };

  const showToast = (message, type = "error", action = null) => {
    if (toastTimerRef.current) {
      clearTimeout(toastTimerRef.current);
    }
    setToast({ message, type, action });
    toastTimerRef.current = setTimeout(() => {
      setToast(null);
    }, 4000);
  };

  const handleOpenBackendLog = async () => {
    try {
      await openBackendLog();
    } catch (error) {
      // Ignore log open failures.
    }
  };

  const resetWizardForDev = async () => {
    try {
      const response = await setVodsWizardCompleted(false);
      if (!response.ok) {
        throw new Error("Failed to reset wizard state.");
      }
      setWizardCompleted(false);
      setWizardStep(0);
      setWizardVisible(true);
      showToast("Wizard reset.", "info");
    } catch (error) {
      showToast(error.message || "Failed to reset wizard state.");
    }
  };

  const loadVods = async (all = showAll) => {
    const payload = await fetchVods(all);
    setVods(payload.vods || []);
    setRemaining(payload.remaining_count || 0);
    return payload;
  };

  const loadConfig = async () => {
    const config = await fetchConfig();
    const replayDir = config.replay?.directory || "";
    setWizardCompleted(Boolean(config.ui?.vods_wizard_completed));
    setRecordingDir(replayDir);
    setConfigLoaded(true);
    return replayDir;
  };

  useEffect(() => {
    const init = async () => {
      const replayDir = await loadConfig();
      if (replayDir) {
        await loadVods(false);
      }
    };
    init().catch(() => {});
  }, []);

  useEffect(() => {
    if (!configLoaded || wizardCompleted === null) {
      return;
    }
    if (wizardCompleted) {
      return;
    }
    setWizardVisible(true);
    setWizardStep(0);
  }, [configLoaded, wizardCompleted]);

  useEffect(() => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
    }

    if (!recordingDir) {
      return;
    }

    const source = createVodsStream(showAll);
    eventSourceRef.current = source;

    source.onmessage = (event) => {
      try {
        const payload = JSON.parse(event.data);
        setVods(payload.vods || []);
        setRemaining(payload.remaining_count || 0);
      } catch (error) {
        // Ignore invalid payloads.
      }
    };

    source.onerror = () => {
      source.close();
      eventSourceRef.current = null;
      setTimeout(() => {
        loadVods(showAll).catch(() => {});
      }, 3000);
    };

    return () => {
      source.close();
      eventSourceRef.current = null;
    };
  }, [showAll, recordingDir]);

  useEffect(() => {
    return () => {
      if (toastTimerRef.current) {
        clearTimeout(toastTimerRef.current);
      }
    };
  }, []);

  const handleLoadAll = async () => {
    setLoadingAll(true);
    setShowAll(true);
    await loadVods(true);
    setLoadingAll(false);
  };

  const handleSplit = async (vod) => {
    const sessionPath = vod.sessions?.[0] && vod.sessions[0].path;
    if (!sessionPath) return;
    setSplitLoading((prev) => ({ ...prev, [vod.path]: true }));
    try {
      const response = await splitSelected(vod.path, sessionPath);
      if (response.ok) {
        navigate("/clips");
      }
    } finally {
      setSplitLoading((prev) => ({ ...prev, [vod.path]: false }));
    }
  };

  const handleDeleteVod = async (vod) => {
    const label = vod.display_title || vod.pretty_time || vod.name || "this VOD";
    const confirmed = window.confirm(`Delete ${label}? This will remove the file from disk.`);
    if (!confirmed) return;
    try {
      const response = await deleteVod(vod.path);
      const payload = await response.json().catch(() => ({}));
      if (!response.ok || payload.ok === false) {
        throw new Error(payload.error || "Failed to delete VOD");
      }
      await loadVods(showAll);
    } catch (error) {
      showToast(error.message || "Failed to delete VOD");
    }
  };

  const handleScan = async (vod) => {
    if (wizardVisible && wizardStep === WIZARD_STEP_START_SCAN) {
      setWizardStep(WIZARD_STEP_LET_IT_RUN);
    }
    try {
      if (vod.scanned) {
        const clearResponse = await clearVodSessions(vod.path);
        if (!clearResponse.ok) {
          throw new Error("Failed to clear previous scan results.");
        }
      }

      setVods((prev) =>
        prev.map((item) =>
          item.path === vod.path
            ? { ...item, scanning: true, scan_progress: 0, scanned: false, sessions: [] }
            : item
        )
      );

      const response = await startVodScan(vod.path);
      if (!response.ok) {
        throw new Error("Scan request failed.");
      }
      setTimeout(async () => {
        try {
          const payload = await loadVods(showAll);
          const updated = (payload.vods || []).find((item) => item.path === vod.path);
          if (updated && (updated.scanning || updated.scanned)) {
            return;
          }
          showToast("Scan did not start. Click to open the backend log.", "error", "open-backend-log");
        } catch (error) {
          showToast("Unable to confirm scan status.");
        }
      }, 1500);
    } catch (error) {
      setVods((prev) =>
        prev.map((item) =>
          item.path === vod.path ? { ...item, scanning: false } : item
        )
      );
      showToast("Failed to start scan. Please try again.");
    }
  };

  const handleStopScan = async (vod) => {
    try {
      const response = await stopVodScan(vod.path);
      if (response.ok) {
        showToast("Scan stopped.");
        const payload = await loadVods(showAll);
        setVods(payload.vods || []);
      } else {
        const error = await response.json();
        showToast(`Failed to stop scan: ${error.error || "Unknown error"}`);
      }
    } catch (error) {
      console.error("Stop scan error:", error);
      showToast("Failed to stop scan.");
    }
  };

  const handleConfigureDirectory = async () => {
    const payload = await chooseReplayDir();
    if (payload.directory) {
      setRecordingDir(payload.directory);
      await loadVods(false);
    }
  };

  const updateFile = (file) => {
    if (!file) {
      setUploadState({
        fileName: "No file selected",
        progress: 0,
        status: "Waiting for upload...",
        uploading: false,
      });
      return;
    }
    setUploadState({
      fileName: file.name,
      progress: 0,
      status: "Ready to upload.",
      uploading: false,
    });
  };

  const handleFileChange = (event) => {
    const file = event.target.files && event.target.files[0];
    updateFile(file || null);
  };

  const handleDrop = (event) => {
    event.preventDefault();
    const files = event.dataTransfer && event.dataTransfer.files;
    if (!files || !files.length) return;
    if (fileInputRef.current) {
      fileInputRef.current.files = files;
    }
    updateFile(files[0]);
    dropRef.current?.classList.remove("dragging");
  };

  const handleUpload = (event) => {
    event.preventDefault();
    const fileInput = fileInputRef.current;
    const file = fileInput && fileInput.files && fileInput.files[0];
    if (!file) {
      updateFile(null);
      return;
    }

    setUploadState({
      fileName: file.name,
      progress: 0,
      status: "Uploading...",
      uploading: true,
    });

    uploadVodFile(file, {
      onProgress: (evt) => {
        if (!evt.lengthComputable) return;
        const percent = Math.round((evt.loaded / evt.total) * 100);
        setUploadState((prev) => ({
          ...prev,
          progress: percent,
          status: `Uploading... ${percent}%`,
        }));
      },
      onLoad: (evt) => {
        const xhr = evt.target;
        if (xhr.status >= 200 && xhr.status < 400) {
          setUploadState((prev) => ({
            ...prev,
            progress: 100,
            status: "Upload complete. Starting scan...",
            uploading: false,
          }));
          setShowUploadModal(false);
          loadVods(showAll).catch(() => {});
          return;
        }
        setUploadState((prev) => ({
          ...prev,
          status: "Upload failed. Please try again.",
          uploading: false,
        }));
      },
      onError: () => {
        setUploadState((prev) => ({
          ...prev,
          status: "Upload failed. Please try again.",
          uploading: false,
        }));
      },
    });
  };

  const handleDropEnter = (event) => {
    event.preventDefault();
    dropRef.current?.classList.add("dragging");
  };

  const handleDropLeave = (event) => {
    event.preventDefault();
    dropRef.current?.classList.remove("dragging");
  };

  const canUpload = useMemo(() => {
    const fileInput = fileInputRef.current;
    return Boolean(fileInput && fileInput.files && fileInput.files[0] && !uploadState.uploading);
  }, [uploadState.uploading]);

  const hasScanStarted = useMemo(
    () => vods.some((item) => item.scanning || item.paused || item.scanned),
    [vods]
  );

  const hasScanResults = useMemo(
    () => vods.some((item) => item.scanned && item.sessions && item.sessions.length > 0),
    [vods]
  );

  const wizardSteps = [
    {
      title: "Welcome",
      body: "This quick setup shows you how to get from raw recordings to viewable events and clips.",
      ready: true,
      targetSelector: null,
    },
    {
      title: "Start a scan",
      body: "On a VOD card, click Scan. This analyzes the video and detects events to build sessions.",
      body2:
        "Because this app uses image text recognition, you can customize it in Settings with the 'Capture Area' tool and 'Detection Keywords' options to tune it for other games.",
      ready: hasScanStarted,
      targetSelector: ".vod-item .vod-scan-trigger",
    },
    {
      title: "Let it run",
      body: "Scanning can take a while, especially on longer videos. You can monitor progress in the status bar.",
      body2: "For faster processing, turn on GPU OCR in Settings if you have a supported GPU.",
      ready: hasScanResults,
      targetSelector: ".vod-item .vod-scan-row",
    },
    {
      title: "View and clip",
      body: "When scan results are ready, you can watch back the vod, or view your clips!",
      details: [
        "'Watch VOD' opens a video player with your VOD's events highlighted.",
        "'Split into clips' creates clips from the events detected during scan.",
      ],
      ready: hasScanResults,
      targetSelector: ".vod-item .vod-primary-actions",
    },
  ];

  const currentWizard = wizardSteps[wizardStep];
  const isLastWizardStep = wizardStep === wizardSteps.length - 1;

  useEffect(() => {
    if (!wizardVisible) {
      setWizardSpotlightRect(null);
      setWizardPanelStyle(null);
      return;
    }

    const updateWizardPosition = () => {
      const selector = currentWizard?.targetSelector;
      if (!selector) {
        setWizardSpotlightRect(null);
        setWizardPanelStyle(null);
        return;
      }

      const target = document.querySelector(selector);
      if (!target) {
        setWizardSpotlightRect(null);
        setWizardPanelStyle(null);
        return;
      }

      const rect = target.getBoundingClientRect();
      const padding = 8;
      const viewportWidth = window.innerWidth;
      const viewportHeight = window.innerHeight;
      const spotlight = {
        top: Math.max(8, rect.top - padding),
        left: Math.max(8, rect.left - padding),
        width: Math.min(viewportWidth - 16, rect.width + padding * 2),
        height: Math.min(viewportHeight - 16, rect.height + padding * 2),
      };

      const panelWidth = Math.min(460, viewportWidth - 24);
      const estimatedPanelHeight = 290;
      let panelLeft = spotlight.left;
      if (panelLeft + panelWidth > viewportWidth - 12) {
        panelLeft = viewportWidth - panelWidth - 12;
      }
      panelLeft = Math.max(12, panelLeft);

      let panelTop = spotlight.top + spotlight.height + 12;
      if (panelTop + estimatedPanelHeight > viewportHeight - 12) {
        panelTop = Math.max(12, spotlight.top - estimatedPanelHeight - 12);
      }

      setWizardSpotlightRect(spotlight);
      setWizardPanelStyle({
        top: `${panelTop}px`,
        left: `${panelLeft}px`,
        width: `${panelWidth}px`,
      });
    };

    updateWizardPosition();
    window.addEventListener("resize", updateWizardPosition);
    window.addEventListener("scroll", updateWizardPosition, true);
    return () => {
      window.removeEventListener("resize", updateWizardPosition);
      window.removeEventListener("scroll", updateWizardPosition, true);
    };
  }, [wizardVisible, currentWizard, vods, recordingDir, showAll]);

  return {
    canUpload,
    completeWizard,
    configLoaded,
    currentWizard,
    dropRef,
    fileInputRef,
    handleConfigureDirectory,
    handleDeleteVod,
    handleDrop,
    handleDropEnter,
    handleDropLeave,
    handleFileChange,
    handleLoadAll,
    handleOpenBackendLog,
    handleScan,
    handleSplit,
    handleStopScan,
    handleUpload,
    isLastWizardStep,
    loadingAll,
    navigate,
    recordingDir,
    remaining,
    resetWizardForDev,
    setShowDownloadModal,
    setShowUploadModal,
    setToast,
    setWizardStep,
    showDownloadModal,
    showUploadModal,
    splitLoading,
    toast,
    uploadState,
    vods,
    wizardPanelStyle,
    wizardSpotlightRect,
    wizardStep,
    wizardSteps,
    wizardVisible,
  };
}
