import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  chooseReplayDir,
  fetchHomeConfig,
  fetchRecentClips,
  fetchRecentVods,
  startSessionControl,
  stopSessionControl,
} from "../api/home";

export default function useHomePage() {
  const navigate = useNavigate();
  const showSessionRecorder = false;
  const [vods, setVods] = useState([]);
  const [clips, setClips] = useState([]);
  const [recordingDir, setRecordingDir] = useState(null);
  const [configLoaded, setConfigLoaded] = useState(false);

  useEffect(() => {
    const load = async () => {
      const config = await fetchHomeConfig();
      const replayDir = config.replay?.directory || "";
      setRecordingDir(replayDir);
      setConfigLoaded(true);

      if (replayDir) {
        const vodPayload = await fetchRecentVods();
        setVods(vodPayload.vods || []);

        const clipsPayload = await fetchRecentClips();
        setClips(clipsPayload.clips || []);
      }
    };

    load().catch(() => {});
  }, []);

  const startSession = async () => {
    await startSessionControl();
  };

  const stopSession = async () => {
    await stopSessionControl();
  };

  const handleConfigureDirectory = async () => {
    const payload = await chooseReplayDir();
    if (payload.directory) {
      setRecordingDir(payload.directory);
      navigate("/vods");
    }
  };

  const handleVodClick = (vod) => {
    if (vod.scanned) {
      navigate(`/vods/view?path=${encodeURIComponent(vod.path)}`);
    } else {
      navigate("/vods");
    }
  };

  return {
    clips,
    configLoaded,
    handleConfigureDirectory,
    handleVodClick,
    navigate,
    recordingDir,
    showSessionRecorder,
    startSession,
    stopSession,
    vods,
  };
}
