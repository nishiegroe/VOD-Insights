/**
 * NativeVideoContainer.tsx
 * 
 * Wrapper component for native video playback in comparison view.
 * Manages native video rendering, state sync, and performance monitoring.
 * Integrates with the comparison view's sync mechanism.
 * 
 * Phase 2: Replace first HTML5 video element with this component.
 */

import React, { useEffect, useRef, useState, useCallback } from "react";
import { useNativeVideo, UseNativeVideoState } from "../hooks/useNativeVideo";
import { PlaybackTelemetry } from "../services/videoClient";

export interface NativeVideoContainerProps {
  // Core
  src?: string;
  vodIndex: number;
  vodId: string;
  
  // Playback state
  globalTime: number; // seconds
  playbackRate: number;
  
  // Styling
  className?: string;
  style?: React.CSSProperties;
  
  // Callbacks
  onError?: (error: any) => void;
  onTelemetry?: (telemetry: PlaybackTelemetry & { vodIndex: number }) => void;
  onStateChange?: (state: UseNativeVideoState & { vodIndex: number }) => void;
  
  // Debug/monitoring
  enablePerformanceMonitoring?: boolean;
  enableDebugOverlay?: boolean;
}

export interface PerformanceMetrics {
  fps: number;
  avgFps: number;
  cpuPercent?: number;
  memoryMb?: number;
  syncDriftMs: number;
  frameDrops: number;
  lastUpdateTime: number;
}

/**
 * NativeVideoContainer component
 * 
 * Handles:
 * - Native video rendering via useNativeVideo hook
 * - Synchronization with global playback state
 * - Performance telemetry and monitoring
 * - Debug overlay (optional)
 * - Error handling with fallback
 * 
 * @example
 * <NativeVideoContainer
 *   src="/path/to/video.mp4"
 *   vodIndex={0}
 *   vodId="vod_001"
 *   globalTime={currentTime}
 *   playbackRate={1.0}
 *   enablePerformanceMonitoring={true}
 * />
 */
export const NativeVideoContainer = React.forwardRef<
  HTMLDivElement,
  NativeVideoContainerProps
>(
  (
    {
      src,
      vodIndex,
      vodId,
      globalTime,
      playbackRate = 1.0,
      className,
      style = {},
      onError,
      onTelemetry,
      onStateChange,
      enablePerformanceMonitoring = false,
      enableDebugOverlay = false,
    },
    ref
  ) => {
    // Native video hook
    const [state, controls] = useNativeVideo({
      filePath: src,
      autoInitialize: true,
      onError,
      onTelemetry,
      debug: enableDebugOverlay,
    });

    // Container ref
    const containerRef = useRef<HTMLDivElement>(null);

    // Performance monitoring
    const [metrics, setMetrics] = useState<PerformanceMetrics>({
      fps: 0,
      avgFps: 0,
      syncDriftMs: 0,
      frameDrops: 0,
      lastUpdateTime: Date.now(),
    });

    const [showDebug, setShowDebug] = useState(enableDebugOverlay);

    // Refs for performance tracking
    const frameCountRef = useRef(0);
    const lastFrameTimeRef = useRef(Date.now());
    const fpsHistoryRef = useRef<number[]>([]);
    const syncDriftHistoryRef = useRef<number[]>([]);

    // Combine refs
    useEffect(() => {
      if (ref) {
        if (typeof ref === "function") {
          ref(containerRef.current);
        } else {
          ref.current = containerRef.current;
        }
      }
    }, [ref]);

    // Handle playback rate changes
    useEffect(() => {
      if (state.isInitialized && playbackRate !== state.playbackRate) {
        controls.setPlaybackRate(playbackRate).catch((error) => {
          console.error("Failed to set playback rate:", error);
        });
      }
    }, [playbackRate, state.isInitialized, state.playbackRate, controls]);

    // Synchronize with global playback time
    useEffect(() => {
      if (!state.isInitialized || !state.isAvailable) return;

      const handleSync = async () => {
        try {
          const expectedTimeMs = globalTime * 1000;
          const currentTimeMs = state.currentTime;
          const driftMs = currentTimeMs - expectedTimeMs;

          // Update drift tracking
          syncDriftHistoryRef.current.push(driftMs);
          if (syncDriftHistoryRef.current.length > 60) {
            syncDriftHistoryRef.current.shift();
          }

          // Only seek if drift exceeds tolerance (100ms = reasonable sync tolerance)
          const SYNC_TOLERANCE_MS = 100;
          if (Math.abs(driftMs) > SYNC_TOLERANCE_MS) {
            await controls.seek(expectedTimeMs);
          }
        } catch (error) {
          console.error(`[VOD ${vodIndex}] Sync error:`, error);
        }
      };

      handleSync();
    }, [globalTime, state.isInitialized, state.isAvailable, state.currentTime, vodIndex, controls]);

    // Performance monitoring
    useEffect(() => {
      if (!enablePerformanceMonitoring || !state.isInitialized) return;

      const monitoringInterval = setInterval(() => {
        frameCountRef.current++;

        const now = Date.now();
        const elapsed = now - lastFrameTimeRef.current;

        if (elapsed >= 1000) {
          // Calculate FPS
          const fps = Math.round((frameCountRef.current * 1000) / elapsed);
          fpsHistoryRef.current.push(fps);
          if (fpsHistoryRef.current.length > 10) {
            fpsHistoryRef.current.shift();
          }

          const avgFps = Math.round(
            fpsHistoryRef.current.reduce((a, b) => a + b, 0) / fpsHistoryRef.current.length
          );

          // Calculate avg drift
          const avgDrift =
            syncDriftHistoryRef.current.length > 0
              ? Math.round(
                  syncDriftHistoryRef.current.reduce((a, b) => a + b, 0) /
                    syncDriftHistoryRef.current.length
                )
              : 0;

          setMetrics({
            fps,
            avgFps,
            syncDriftMs: avgDrift,
            frameDrops: 0, // Would need native module telemetry
            lastUpdateTime: now,
          });

          frameCountRef.current = 0;
          lastFrameTimeRef.current = now;
        }
      }, 33); // ~30Hz update rate

      return () => clearInterval(monitoringInterval);
    }, [enablePerformanceMonitoring, state.isInitialized]);

    // Notify state changes
    useEffect(() => {
      if (onStateChange) {
        onStateChange({
          ...state,
          vodIndex,
        });
      }
    }, [state, vodIndex, onStateChange]);

    // Format time for display
    const formatTime = (ms: number): string => {
      if (!ms) return "0:00";
      const totalSeconds = Math.floor(ms / 1000);
      const minutes = Math.floor(totalSeconds / 60);
      const seconds = totalSeconds % 60;
      return `${minutes}:${seconds.toString().padStart(2, "0")}`;
    };

    // Handle native window rendering
    useEffect(() => {
      if (state.isAvailable && containerRef.current) {
        // Ensure container exists for native window attachment
        const nativeContainer = containerRef.current.querySelector(
          "#native-video-window"
        );
        if (nativeContainer) {
          // Native module will attach window handle here
          // This is a placeholder that the native module updates
          nativeContainer.setAttribute("data-video-ready", "true");
        }
      }
    }, [state.isAvailable]);

    // Render unavailable state
    if (!state.isAvailable) {
      return (
        <div
          ref={containerRef}
          className={className}
          style={{
            width: "100%",
            height: "100%",
            backgroundColor: "#1a1a1a",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: "#fff",
            fontSize: "14px",
            position: "relative",
            ...style,
          }}
        >
          <div style={{ textAlign: "center", padding: "20px" }}>
            <p>⚠️ Native video unavailable</p>
            <p style={{ fontSize: "12px", color: "#999", marginTop: "10px" }}>
              {state.lastError?.message || "Electron context required"}
            </p>
            <p style={{ fontSize: "11px", color: "#666", marginTop: "10px" }}>
              Falling back to HTML5 video
            </p>
          </div>
        </div>
      );
    }

    // Render main container
    return (
      <div
        ref={containerRef}
        className={className}
        style={{
          width: "100%",
          height: "100%",
          backgroundColor: "#000",
          position: "relative",
          ...style,
        }}
      >
        {/* Native video window placeholder */}
        <div
          id="native-video-window"
          style={{
            width: "100%",
            height: "100%",
            position: "absolute",
            top: 0,
            left: 0,
            backgroundColor: "#000",
          }}
          title={`VOD ${vodIndex}: Native video rendering`}
        />

        {/* Performance monitoring overlay */}
        {enablePerformanceMonitoring && (
          <div
            style={{
              position: "absolute",
              top: "8px",
              right: "8px",
              backgroundColor: "rgba(0, 0, 0, 0.7)",
              border: "1px solid #0f0",
              borderRadius: "4px",
              padding: "8px",
              fontSize: "11px",
              fontFamily: "monospace",
              color: "#0f0",
              zIndex: 900,
              minWidth: "140px",
            }}
          >
            <div style={{ fontWeight: "bold", marginBottom: "4px" }}>
              📊 Performance
            </div>
            <div>FPS: {metrics.fps} ({metrics.avgFps}avg)</div>
            <div>Drift: {metrics.syncDriftMs}ms</div>
            <div>Duration: {formatTime(state.duration)}</div>
            <div style={{ marginTop: "4px", fontSize: "10px", color: "#0a0" }}>
              VOD #{vodIndex}
            </div>
          </div>
        )}

        {/* Debug overlay */}
        {showDebug && state.isInitialized && (
          <div
            style={{
              position: "absolute",
              bottom: "8px",
              left: "8px",
              backgroundColor: "rgba(0, 0, 0, 0.85)",
              border: "1px solid #0f0",
              borderRadius: "4px",
              padding: "10px",
              fontSize: "10px",
              fontFamily: "monospace",
              color: "#0f0",
              zIndex: 900,
              maxWidth: "300px",
              cursor: "pointer",
            }}
            onClick={() => setShowDebug(false)}
            title="Click to hide debug overlay"
          >
            <div style={{ fontWeight: "bold", marginBottom: "6px" }}>
              🎬 NativeVideoContainer #{vodIndex}
            </div>
            <div>vodId: {vodId}</div>
            <div>Available: {state.isAvailable ? "✓" : "✗"}</div>
            <div>Initialized: {state.isInitialized ? "✓" : "✗"}</div>
            <div>
              State:{" "}
              {state.isPlaying ? "▶ playing" : state.isPaused ? "⏸ paused" : "⏹ stopped"}
            </div>
            <div>
              Time: {formatTime(state.currentTime)} / {formatTime(state.duration)}
            </div>
            <div>Speed: {state.playbackRate.toFixed(2)}x</div>
            {state.isLoading && <div style={{ color: "#ff0" }}>⏳ Loading...</div>}
            {state.lastError && (
              <div style={{ color: "#f00", marginTop: "4px" }}>
                Error: {state.lastError.code}
              </div>
            )}
            {enablePerformanceMonitoring && (
              <>
                <div style={{ borderTop: "1px solid #0f0", marginTop: "6px", paddingTop: "6px" }}>
                  <div>FPS: {metrics.fps} (avg: {metrics.avgFps})</div>
                  <div>Sync Drift: {metrics.syncDriftMs}ms</div>
                </div>
              </>
            )}
          </div>
        )}

        {/* Toggle debug button */}
        {!showDebug && state.isInitialized && (
          <div
            style={{
              position: "absolute",
              bottom: "8px",
              left: "8px",
              padding: "4px 8px",
              backgroundColor: "rgba(0, 0, 0, 0.5)",
              color: "#0f0",
              fontSize: "10px",
              cursor: "pointer",
              borderRadius: "4px",
              border: "1px solid rgba(0, 255, 0, 0.3)",
              userSelect: "none",
            }}
            onClick={() => setShowDebug(true)}
            title="Click to show debug overlay"
          >
            🔍 Debug
          </div>
        )}
      </div>
    );
  }
);

NativeVideoContainer.displayName = "NativeVideoContainer";

export default NativeVideoContainer;
