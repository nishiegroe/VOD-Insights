/**
 * useVodSyncIntegration Hook
 * Integrates multi-VOD sync into existing VOD viewer
 */

import { useCallback, useEffect, useRef } from "react";
import { useMultiVodSync } from "./useMultiVodSync";

export function useVodSyncIntegration(primaryVodTime, primaryVodDuration) {
  const sync = useMultiVodSync();
  const linkedPlaybackRef = useRef(null);

  /**
   * Handle time update from primary VOD
   * Updates all secondary VODs if linked playback is enabled
   */
  const handlePrimaryTimeUpdate = useCallback(
    (newTime) => {
      // Update primary VOD time
      sync.updateVodTime(sync.primaryVodId, newTime);

      // If linked playback is enabled, update secondaries with offset
      if (sync.isLinkedPlayback) {
        const secondaryVods = sync.getSecondaryVods();
        secondaryVods.forEach((vod) => {
          const adjustedTime = sync.getAdjustedVodTime(vod.id);
          sync.updateVodTime(vod.id, adjustedTime);
        });
      }
    },
    [sync]
  );

  /**
   * Handle time update from secondary VOD
   * If linked playback is on, updates primary and other secondaries
   */
  const handleSecondaryTimeUpdate = useCallback(
    (vodId, newTime) => {
      if (!sync.isLinkedPlayback) {
        // Just update this VOD independently
        sync.updateVodTime(vodId, newTime);
        return;
      }

      // Calculate what the primary VOD time should be based on this secondary
      const vod = sync.vods.find((v) => v.id === vodId);
      if (!vod) return;

      // Primary time = secondary time - offset
      const primaryTime = newTime - vod.syncOffset / 1000;
      handlePrimaryTimeUpdate(primaryTime);
    },
    [sync, handlePrimaryTimeUpdate]
  );

  /**
   * Handle duration update
   */
  const handleDurationUpdate = useCallback(
    (vodId, duration) => {
      sync.updateVodDuration(vodId, duration);
    },
    [sync]
  );

  /**
   * Get synchronized time for a VOD
   * Returns the time this VOD should be playing at based on sync offset
   */
  const getSyncedTime = useCallback(
    (vodId) => {
      if (vodId === sync.primaryVodId) {
        return sync.getPrimaryVod()?.currentTime || 0;
      }

      const vod = sync.vods.find((v) => v.id === vodId);
      if (!vod || !sync.isLinkedPlayback) {
        return vod?.currentTime || 0;
      }

      // Apply offset to primary time
      return sync.getAdjustedVodTime(vodId);
    },
    [sync]
  );

  /**
   * Check if a VOD is in sync
   */
  const isVodInSync = useCallback(
    (vodId) => {
      const vod = sync.vods.find((v) => v.id === vodId);
      return vod?.syncStatus === "synced";
    },
    [sync.vods]
  );

  /**
   * Get all VODs sorted by sync status (synced first)
   */
  const getVodsByPriority = useCallback(() => {
    return [...sync.vods].sort((a, b) => {
      // Primary first
      if (a.id === sync.primaryVodId) return -1;
      if (b.id === sync.primaryVodId) return 1;

      // Synced next
      if (a.syncStatus === "synced" && b.syncStatus !== "synced") return -1;
      if (a.syncStatus !== "synced" && b.syncStatus === "synced") return 1;

      return 0;
    });
  }, [sync.vods, sync.primaryVodId]);

  /**
   * Clear all sync data
   */
  const clearSync = useCallback(() => {
    sync.clearAllVods();
  }, [sync]);

  return {
    // State
    sync,
    vods: sync.vods,
    primaryVodId: sync.primaryVodId,
    isLinkedPlayback: sync.isLinkedPlayback,
    syncSettings: sync.syncSettings,

    // VOD Management
    addVod: sync.addVod,
    removeVod: sync.removeVod,
    setPrimaryVod: sync.setPrimaryVod,

    // Time Management
    handlePrimaryTimeUpdate,
    handleSecondaryTimeUpdate,
    handleDurationUpdate,
    getSyncedTime,

    // Sync Actions
    syncVodsByTimers: sync.syncVodsByTimers,
    setSyncOffset: sync.setSyncOffset,
    setSyncStatus: sync.setSyncStatus,
    setLinkedPlayback: sync.setLinkedPlayback,
    addDetectedTimer: sync.addDetectedTimer,
    clearDetectedTimers: sync.clearDetectedTimers,

    // Query
    isVodInSync,
    areAllSynced: sync.areAllSynced,
    getVodsByPriority,
    getPrimaryVod: sync.getPrimaryVod,
    getSecondaryVods: sync.getSecondaryVods,

    // Utilities
    clearSync,
  };
}
