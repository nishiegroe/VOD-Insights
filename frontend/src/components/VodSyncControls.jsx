/**
 * VodSyncControls Component
 * Provides UI for detecting timers and syncing multiple VODs
 */

import React, { useState, useCallback } from "react";

export function VodSyncControls({
  vods = [],
  primaryVodId,
  onSyncComplete = () => {},
  onStatusChange = () => {},
  disabled = false,
  className = "",
}) {
  const [syncingVodId, setSyncingVodId] = useState(null);
  const [syncProgress, setSyncProgress] = useState({});
  const [autoDetectEnabled, setAutoDetectEnabled] = useState(true);
  const [selectedGame, setSelectedGame] = useState("apex");
  const [showSettings, setShowSettings] = useState(false);

  const supportedGames = [
    { value: "apex", label: "Apex Legends" },
    { value: "valorant", label: "Valorant" },
  ];

  /**
   * Detect timer in a single VOD
   */
  const detectTimer = useCallback(
    async (vodId, timestamp) => {
      const vod = vods.find((v) => v.id === vodId);
      if (!vod) return;

      try {
        setSyncingVodId(vodId);
        setSyncProgress((prev) => ({
          ...prev,
          [vodId]: "Detecting timer...",
        }));
        onStatusChange(vodId, "syncing", null);

        const response = await fetch("/api/ocr/detect-timer", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            vod_path: vod.url, // In production, this would be the downloaded file path
            timestamp: timestamp,
            game: selectedGame,
          }),
        });

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }

        const data = await response.json();

        if (data.success && data.timer) {
          setSyncProgress((prev) => ({
            ...prev,
            [vodId]: `Detected: ${data.timer} (${Math.round(data.confidence * 100)}%)`,
          }));
          return {
            timer: data.timer,
            confidence: data.confidence,
          };
        } else {
          throw new Error("Could not detect timer in frame");
        }
      } catch (error) {
        console.error(`Error detecting timer for ${vodId}:`, error);
        setSyncProgress((prev) => ({
          ...prev,
          [vodId]: `Error: ${error.message}`,
        }));
        onStatusChange(vodId, "error", error.message);
        return null;
      } finally {
        setSyncingVodId(null);
      }
    },
    [vods, selectedGame, onStatusChange]
  );

  /**
   * Sync two VODs based on detected timers
   */
  const syncTwoVods = useCallback(
    async (primaryVod, secondaryVod, primaryTime, secondaryTime) => {
      try {
        setSyncingVodId(secondaryVod.id);
        setSyncProgress((prev) => ({
          ...prev,
          [secondaryVod.id]: "Syncing with primary VOD...",
        }));
        onStatusChange(secondaryVod.id, "syncing", null);

        // Detect timers in both VODs
        const primaryTimer = await detectTimer(primaryVod.id, primaryTime);
        if (!primaryTimer) {
          throw new Error(
            `Could not detect timer in primary VOD at ${primaryTime}s`
          );
        }

        const secondaryTimer = await detectTimer(
          secondaryVod.id,
          secondaryTime
        );
        if (!secondaryTimer) {
          throw new Error(
            `Could not detect timer in secondary VOD at ${secondaryTime}s`
          );
        }

        // Request backend to sync
        const response = await fetch("/api/ocr/sync-vods", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            primary_vod_path: primaryVod.url,
            secondary_vod_path: secondaryVod.url,
            primary_timestamp: primaryTime,
            secondary_timestamp: secondaryTime,
            game: selectedGame,
          }),
        });

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }

        const data = await response.json();

        if (!data.success || !data.timers_match) {
          throw new Error(
            `Timers don't match: ${data.primary_timer} vs ${data.secondary_timer}`
          );
        }

        setSyncProgress((prev) => ({
          ...prev,
          [secondaryVod.id]: `✓ Synced! Offset: ${(data.sync_offset_ms / 1000).toFixed(2)}s`,
        }));

        onStatusChange(secondaryVod.id, "synced", null);
        onSyncComplete({
          vodId: secondaryVod.id,
          offset: data.sync_offset_ms,
          confidence: data.average_confidence,
          primaryTimer: data.primary_timer,
          secondaryTimer: data.secondary_timer,
        });

        return true;
      } catch (error) {
        console.error("Sync error:", error);
        setSyncProgress((prev) => ({
          ...prev,
          [secondaryVod.id]: `Error: ${error.message}`,
        }));
        onStatusChange(secondaryVod.id, "error", error.message);
        return false;
      } finally {
        setSyncingVodId(null);
      }
    },
    [detectTimer, selectedGame, onStatusChange, onSyncComplete]
  );

  /**
   * Manual sync: user specifies timestamps
   */
  const handleManualSync = useCallback(
    async (secondaryVodId, primaryTime, secondaryTime) => {
      if (!primaryVodId) {
        alert("Please set a primary VOD first");
        return;
      }

      const primaryVod = vods.find((v) => v.id === primaryVodId);
      const secondaryVod = vods.find((v) => v.id === secondaryVodId);

      if (!primaryVod || !secondaryVod) {
        alert("VOD not found");
        return;
      }

      await syncTwoVods(primaryVod, secondaryVod, primaryTime, secondaryTime);
    },
    [primaryVodId, vods, syncTwoVods]
  );

  /**
   * Auto-sync: detect timers at current playback position
   */
  const handleAutoSync = useCallback(
    async (secondaryVodId) => {
      if (!primaryVodId) {
        alert("Please set a primary VOD first");
        return;
      }

      const primaryVod = vods.find((v) => v.id === primaryVodId);
      const secondaryVod = vods.find((v) => v.id === secondaryVodId);

      if (!primaryVod || !secondaryVod) {
        alert("VOD not found");
        return;
      }

      // Use current playback times
      await syncTwoVods(
        primaryVod,
        secondaryVod,
        primaryVod.currentTime,
        secondaryVod.currentTime
      );
    },
    [primaryVodId, vods, syncTwoVods]
  );

  const secondaryVods = vods.filter((v) => v.id !== primaryVodId);
  const primaryVod = vods.find((v) => v.id === primaryVodId);

  if (!primaryVod || secondaryVods.length === 0) {
    return null;
  }

  return (
    <div className={`vod-sync-controls ${className}`}>
      {/* Settings Toggle */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: "12px",
        }}
      >
        <h3
          style={{
            margin: 0,
            color: "#f4f7f8",
            fontSize: "14px",
            fontWeight: "600",
          }}
        >
          🔗 Sync Controls
        </h3>
        <button
          className="tertiary"
          onClick={() => setShowSettings(!showSettings)}
          title="Sync settings"
          style={{ padding: "4px 8px", fontSize: "12px" }}
        >
          ⚙️
        </button>
      </div>

      {/* Settings Panel */}
      {showSettings && (
        <div
          style={{
            padding: "12px",
            borderRadius: "6px",
            background: "rgba(0, 0, 0, 0.2)",
            marginBottom: "12px",
            border: "1px solid #1f3640",
          }}
        >
          <div style={{ marginBottom: "12px" }}>
            <label
              style={{
                display: "flex",
                alignItems: "center",
                gap: "8px",
                marginBottom: "8px",
                fontSize: "13px",
                color: "#9fb0b7",
                cursor: "pointer",
              }}
            >
              <input
                type="checkbox"
                checked={autoDetectEnabled}
                onChange={(e) => setAutoDetectEnabled(e.target.checked)}
              />
              Auto-detect timers
            </label>
          </div>

          <div>
            <label
              style={{
                display: "block",
                marginBottom: "6px",
                fontSize: "12px",
                color: "#9fb0b7",
                fontWeight: "600",
              }}
            >
              Game
            </label>
            <select
              value={selectedGame}
              onChange={(e) => setSelectedGame(e.target.value)}
              style={{
                width: "100%",
                padding: "6px 8px",
                background: "#0c171b",
                border: "1px solid #1f3640",
                borderRadius: "4px",
                color: "#f4f7f8",
                fontSize: "12px",
              }}
            >
              {supportedGames.map((game) => (
                <option key={game.value} value={game.value}>
                  {game.label}
                </option>
              ))}
            </select>
          </div>
        </div>
      )}

      {/* Primary VOD Info */}
      <div
        style={{
          padding: "8px",
          borderRadius: "6px",
          background: "rgba(255, 179, 71, 0.1)",
          border: "1px solid #ffb347",
          marginBottom: "12px",
          fontSize: "12px",
          color: "#9fb0b7",
        }}
      >
        <span style={{ color: "#ffb347", fontWeight: "600" }}>Primary:</span>{" "}
        {primaryVod.label}
        <span style={{ color: "#666", marginLeft: "8px" }}>
          {Math.floor(primaryVod.currentTime / 60)}:
          {String(Math.floor(primaryVod.currentTime % 60)).padStart(2, "0")}
        </span>
      </div>

      {/* Secondary VODs - Sync Controls */}
      <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
        {secondaryVods.map((vod) => (
          <div
            key={vod.id}
            style={{
              padding: "12px",
              borderRadius: "6px",
              background: "rgba(0, 0, 0, 0.2)",
              border: "1px solid #1f3640",
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: "8px",
                gap: "8px",
              }}
            >
              <div
                style={{
                  flex: 1,
                  minWidth: 0,
                  fontSize: "12px",
                }}
              >
                <div
                  style={{
                    color: "#f4f7f8",
                    fontWeight: "500",
                    marginBottom: "2px",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                >
                  {vod.label}
                </div>
                <div style={{ color: "#666", fontSize: "11px" }}>
                  {Math.floor(vod.currentTime / 60)}:
                  {String(Math.floor(vod.currentTime % 60)).padStart(2, "0")} /{" "}
                  {Math.floor(vod.duration / 60)}:
                  {String(Math.floor(vod.duration % 60)).padStart(2, "0")}
                </div>
              </div>

              {/* Sync Status Badge */}
              {vod.syncStatus && (
                <div
                  style={{
                    padding: "2px 8px",
                    borderRadius: "3px",
                    background:
                      vod.syncStatus === "synced"
                        ? "rgba(46, 139, 87, 0.3)"
                        : vod.syncStatus === "syncing"
                          ? "rgba(255, 179, 71, 0.3)"
                          : vod.syncStatus === "error"
                            ? "rgba(227, 75, 108, 0.3)"
                            : "transparent",
                    color:
                      vod.syncStatus === "synced"
                        ? "#2e8b57"
                        : vod.syncStatus === "syncing"
                          ? "#ffb347"
                          : vod.syncStatus === "error"
                            ? "#e34b6c"
                            : "#666",
                    fontSize: "10px",
                    fontWeight: "500",
                    whiteSpace: "nowrap",
                  }}
                >
                  {vod.syncStatus === "synced" && "✓ Synced"}
                  {vod.syncStatus === "syncing" && "⏳ Syncing..."}
                  {vod.syncStatus === "error" && "✕ Error"}
                  {vod.syncStatus === "unsync" && "—"}
                </div>
              )}
            </div>

            {/* Progress/Status Message */}
            {syncProgress[vod.id] && (
              <div
                style={{
                  fontSize: "11px",
                  color: "#9fb0b7",
                  marginBottom: "8px",
                  padding: "6px",
                  borderRadius: "3px",
                  background: "rgba(100, 116, 139, 0.1)",
                }}
              >
                {syncProgress[vod.id]}
              </div>
            )}

            {/* Sync Offset Display */}
            {vod.syncOffset !== 0 && (
              <div
                style={{
                  fontSize: "11px",
                  color: "#9fb0b7",
                  marginBottom: "8px",
                }}
              >
                Offset: {(vod.syncOffset / 1000).toFixed(2)}s
              </div>
            )}

            {/* Sync Buttons */}
            <div style={{ display: "flex", gap: "6px" }}>
              <button
                className="tertiary"
                onClick={() => handleAutoSync(vod.id)}
                disabled={disabled || syncingVodId === vod.id}
                title="Auto-sync at current playback position"
                style={{ flex: 1, fontSize: "12px", padding: "6px" }}
              >
                {syncingVodId === vod.id ? "⏳ Syncing..." : "🔄 Auto-Sync"}
              </button>

              <button
                className="tertiary"
                onClick={() => {
                  // Manual sync - would open a modal for timestamp input
                  // For now, we'll use current times
                  handleManualSync(
                    vod.id,
                    primaryVod.currentTime,
                    vod.currentTime
                  );
                }}
                disabled={disabled || syncingVodId === vod.id}
                title="Sync using current times"
                style={{ flex: 1, fontSize: "12px", padding: "6px" }}
              >
                {syncingVodId === vod.id ? "⏳ Syncing..." : "⚡ Sync Now"}
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Info Box */}
      <div
        style={{
          marginTop: "12px",
          padding: "8px",
          borderRadius: "6px",
          background: "rgba(100, 116, 139, 0.1)",
          border: "1px solid #1f3640",
          fontSize: "11px",
          color: "#9fb0b7",
          lineHeight: "1.5",
        }}
      >
        <strong style={{ color: "#f4f7f8" }}>💡 How to use:</strong>
        <br />
        1. Select the same game for all VODs
        <br />
        2. Scrub both VODs to the same in-game moment
        <br />
        3. Click "Auto-Sync" to detect and sync timers
        <br />
        4. Once synced, playback stays synchronized
      </div>
    </div>
  );
}
