/**
 * useNativeVideo.ts
 * 
 * React hook for controlling native Electron video player via IPC.
 * Manages playback state, handles commands, provides telemetry.
 * Automatically falls back to error state if native video unavailable.
 */

import { useState, useEffect, useCallback, useRef } from "react";
import {
  getVideoClient,
  PlaybackState,
  PlaybackTelemetry,
  VideoClientError,
} from "../services/videoClient";

export interface UseNativeVideoOptions {
  filePath?: string;
  autoInitialize?: boolean;
  onError?: (error: VideoClientError) => void;
  onTelemetry?: (telemetry: PlaybackTelemetry) => void;
  debug?: boolean;
}

export interface UseNativeVideoState {
  // Playback state
  isPlaying: boolean;
  isPaused: boolean;
  isStopped: boolean;
  currentTime: number; // milliseconds
  duration: number; // milliseconds
  playbackRate: number; // 1.0 = normal speed

  // Status
  isInitialized: boolean;
  isAvailable: boolean;
  lastError: VideoClientError | null;
  isLoading: boolean;
}

export interface UseNativeVideoControls {
  // Playback control
  play: () => Promise<void>;
  pause: () => Promise<void>;
  stop: () => Promise<void>;
  seek: (timeMs: number) => Promise<void>;
  setPlaybackRate: (rate: number) => Promise<void>;

  // Lifecycle
  initialize: (filePath: string) => Promise<void>;
  cleanup: () => Promise<void>;

  // State queries
  getState: () => Promise<PlaybackState>;
  getCurrentTime: () => Promise<number>;
  getDuration: () => Promise<number>;
}

export type UseNativeVideoReturn = [UseNativeVideoState, UseNativeVideoControls];

/**
 * useNativeVideo: React hook for native video playback
 * 
 * @param options Configuration options
 * @returns [state, controls] tuple
 * 
 * @example
 * const [state, controls] = useNativeVideo({
 *   filePath: "/path/to/video.mp4",
 *   autoInitialize: true,
 *   onError: (error) => console.error(error),
 * });
 * 
 * // Use state
 * console.log(state.currentTime, state.duration, state.isPlaying);
 * 
 * // Use controls
 * await controls.play();
 * await controls.seek(5000); // seek to 5 seconds
 */
export function useNativeVideo(options: UseNativeVideoOptions = {}): UseNativeVideoReturn {
  const {
    filePath,
    autoInitialize = true,
    onError,
    onTelemetry,
    debug = false,
  } = options;

  // State
  const [state, setState] = useState<UseNativeVideoState>({
    isPlaying: false,
    isPaused: false,
    isStopped: true,
    currentTime: 0,
    duration: 0,
    playbackRate: 1.0,
    isInitialized: false,
    isAvailable: false,
    lastError: null,
    isLoading: false,
  });

  // Refs for cleanup and subscription tracking
  const clientRef = useRef(getVideoClient());
  const unsubscribersRef = useRef<Array<() => void>>([]);
  const isMountedRef = useRef(true);

  // Debug logging
  const log = useCallback(
    (message: string, data?: any) => {
      if (debug) {
        console.log(`[useNativeVideo] ${message}`, data);
      }
    },
    [debug]
  );

  // Update state (only if mounted)
  const updateState = useCallback(
    (updates: Partial<UseNativeVideoState>) => {
      if (isMountedRef.current) {
        setState((prev) => ({ ...prev, ...updates }));
      }
    },
    []
  );

  // Initialize client and subscribe to events
  useEffect(() => {
    let mounted = true;

    const init = async () => {
      try {
        const client = clientRef.current;

        // Initialize client if not already done
        if (!client.isAvailable()) {
          await client.initialize();
        }

        if (!mounted) return;

        const isAvailable = client.isAvailable();
        updateState({ isAvailable });
        log("Client initialized", { isAvailable });

        if (!isAvailable) {
          const error: VideoClientError = {
            code: "NATIVE_VIDEO_UNAVAILABLE",
            message: "Native video not available, check Electron context",
          };
          updateState({ lastError: error });
          onError?.(error);
          return;
        }

        // Subscribe to telemetry
        const unsubscribeTelemetry = client.onTelemetry((telemetry) => {
          if (!mounted) return;

          log("Telemetry received", telemetry);

          updateState({
            currentTime: telemetry.currentTime,
            duration: telemetry.duration,
            isPlaying: telemetry.state === "playing",
            isPaused: telemetry.state === "paused",
            isStopped: telemetry.state === "stopped",
          });

          onTelemetry?.(telemetry);
        });

        // Subscribe to errors
        const unsubscribeError = client.onError((error) => {
          if (!mounted) return;

          log("Error received", error);

          updateState({ lastError: error });
          onError?.(error);
        });

        unsubscribersRef.current = [unsubscribeTelemetry, unsubscribeError];
      } catch (error) {
        console.error("useNativeVideo initialization error:", error);
        if (mounted) {
          updateState({
            lastError: {
              code: "INIT_ERROR",
              message: String(error),
            },
          });
        }
      }
    };

    init();

    return () => {
      mounted = false;
    };
  }, []);

  // Auto-initialize with filePath
  useEffect(() => {
    if (!autoInitialize || !filePath) return;
    if (!state.isAvailable) return;
    if (state.isInitialized) return;

    const client = clientRef.current;
    const init = async () => {
      try {
        updateState({ isLoading: true });
        log("Initializing player with filePath", { filePath });

        await client.initializePlayer(filePath);

        if (!isMountedRef.current) return;

        updateState({ isInitialized: true, isLoading: false });
        log("Player initialized", { filePath });
      } catch (error) {
        if (!isMountedRef.current) return;

        const videoError: VideoClientError = {
          code: "INIT_FAILED",
          message: String(error),
          context: "autoInitialize",
        };

        log("Initialization failed", videoError);
        updateState({ lastError: videoError, isLoading: false });
        onError?.(videoError);
      }
    };

    init();
  }, [autoInitialize, filePath, state.isAvailable, state.isInitialized, updateState, log, onError]);

  // Controls
  const controls: UseNativeVideoControls = {
    play: useCallback(async () => {
      const client = clientRef.current;
      if (!client.isAvailable()) {
        throw new Error("Native video not available");
      }
      log("Playing");
      await client.play();
    }, [log]),

    pause: useCallback(async () => {
      const client = clientRef.current;
      if (!client.isAvailable()) {
        throw new Error("Native video not available");
      }
      log("Pausing");
      await client.pause();
    }, [log]),

    stop: useCallback(async () => {
      const client = clientRef.current;
      if (!client.isAvailable()) {
        throw new Error("Native video not available");
      }
      log("Stopping");
      await client.stop();
    }, [log]),

    seek: useCallback(
      async (timeMs: number) => {
        const client = clientRef.current;
        if (!client.isAvailable()) {
          throw new Error("Native video not available");
        }
        log("Seeking to", { timeMs });
        await client.seek(timeMs);
      },
      [log]
    ),

    setPlaybackRate: useCallback(
      async (rate: number) => {
        const client = clientRef.current;
        if (!client.isAvailable()) {
          throw new Error("Native video not available");
        }
        log("Setting playback rate", { rate });
        await client.setPlaybackRate(rate);
        updateState({ playbackRate: rate });
      },
      [log, updateState]
    ),

    initialize: useCallback(async (filePath: string) => {
      const client = clientRef.current;
      if (!client.isAvailable()) {
        throw new Error("Native video not available");
      }
      try {
        updateState({ isLoading: true });
        log("Initializing player", { filePath });

        await client.initializePlayer(filePath);

        if (!isMountedRef.current) return;

        updateState({ isInitialized: true, isLoading: false });
        log("Player initialized", { filePath });
      } catch (error) {
        if (!isMountedRef.current) return;

        const videoError: VideoClientError = {
          code: "INIT_FAILED",
          message: String(error),
        };

        updateState({ lastError: videoError, isLoading: false });
        onError?.(videoError);
        throw videoError;
      }
    }, [log, updateState, onError]),

    cleanup: useCallback(async () => {
      const client = clientRef.current;
      log("Cleanup started");

      // Unsubscribe from events
      unsubscribersRef.current.forEach((unsubscribe) => unsubscribe());
      unsubscribersRef.current = [];

      try {
        await client.shutdown();
      } catch (error) {
        console.warn("Error during cleanup:", error);
      }

      updateState({
        isInitialized: false,
        isPlaying: false,
        isPaused: false,
        isStopped: true,
        currentTime: 0,
        duration: 0,
      });

      log("Cleanup complete");
    }, [log, updateState]),

    getState: useCallback(async () => {
      const client = clientRef.current;
      if (!client.isAvailable()) {
        throw new Error("Native video not available");
      }
      const state = await client.getState();
      log("Get state", { state });
      return state;
    }, [log]),

    getCurrentTime: useCallback(async () => {
      const client = clientRef.current;
      if (!client.isAvailable()) {
        throw new Error("Native video not available");
      }
      const time = await client.getCurrentTime();
      log("Get current time", { time });
      return time;
    }, [log]),

    getDuration: useCallback(async () => {
      const client = clientRef.current;
      if (!client.isAvailable()) {
        throw new Error("Native video not available");
      }
      const duration = await client.getDuration();
      log("Get duration", { duration });
      return duration;
    }, [log]),
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      isMountedRef.current = false;

      // Unsubscribe from events
      unsubscribersRef.current.forEach((unsubscribe) => unsubscribe());
      unsubscribersRef.current = [];
    };
  }, []);

  return [state, controls];
}

export default useNativeVideo;
