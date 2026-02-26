/**
 * useMultiVodSync Hook
 * Manages multiple VOD playback with synchronization
 */

import { useReducer, useCallback, useRef, useEffect } from "react";
import {
  vodSyncReducer,
  initialVodState,
  getAdjustedTime,
  calculateTimerOffset,
  timersMatch,
} from "../store/vodSyncStore";

export function useMultiVodSync() {
  const [state, dispatch] = useReducer(vodSyncReducer, initialVodState);
  const linkedPlaybackRef = useRef(null);

  /**
   * Add a new VOD
   */
  const addVod = useCallback((vodData) => {
    dispatch({
      type: "ADD_VOD",
      payload: vodData,
    });
  }, []);

  /**
   * Remove a VOD by ID
   */
  const removeVod = useCallback((vodId) => {
    dispatch({
      type: "REMOVE_VOD",
      payload: { id: vodId },
    });
  }, []);

  /**
   * Set primary VOD
   */
  const setPrimaryVod = useCallback((vodId) => {
    dispatch({
      type: "SET_PRIMARY_VOD",
      payload: { id: vodId },
    });
  }, []);

  /**
   * Update VOD current time
   */
  const updateVodTime = useCallback((vodId, currentTime) => {
    dispatch({
      type: "UPDATE_VOD_TIME",
      payload: { id: vodId, currentTime },
    });
  }, []);

  /**
   * Update VOD duration
   */
  const updateVodDuration = useCallback((vodId, duration) => {
    dispatch({
      type: "UPDATE_VOD_DURATION",
      payload: { id: vodId, duration },
    });
  }, []);

  /**
   * Set sync offset between VODs
   */
  const setSyncOffset = useCallback((vodId, offsetMs) => {
    dispatch({
      type: "SET_SYNC_OFFSET",
      payload: { id: vodId, offset: offsetMs },
    });
  }, []);

  /**
   * Update sync status (unsync, syncing, synced, error)
   */
  const setSyncStatus = useCallback((vodId, status, error = null) => {
    dispatch({
      type: "SET_SYNC_STATUS",
      payload: { id: vodId, status, error },
    });
  }, []);

  /**
   * Add detected timer for OCR
   */
  const addDetectedTimer = useCallback((vodId, time, value, confidence) => {
    dispatch({
      type: "ADD_DETECTED_TIMER",
      payload: { id: vodId, time, value, confidence },
    });
  }, []);

  /**
   * Clear detected timers for a VOD
   */
  const clearDetectedTimers = useCallback((vodId) => {
    dispatch({
      type: "CLEAR_DETECTED_TIMERS",
      payload: { id: vodId },
    });
  }, []);

  /**
   * Toggle linked playback
   */
  const setLinkedPlayback = useCallback((enabled) => {
    dispatch({
      type: "SET_LINKED_PLAYBACK",
      payload: { enabled },
    });
  }, []);

  /**
   * Update sync settings
   */
  const updateSyncSettings = useCallback((settings) => {
    dispatch({
      type: "UPDATE_SYNC_SETTINGS",
      payload: settings,
    });
  }, []);

  /**
   * Clear all VODs
   */
  const clearAllVods = useCallback(() => {
    dispatch({
      type: "CLEAR_ALL_VODS",
    });
  }, []);

  /**
   * Get primary VOD object
   */
  const getPrimaryVod = useCallback(() => {
    return state.vods.find((v) => v.id === state.primaryVodId);
  }, [state.vods, state.primaryVodId]);

  /**
   * Get secondary VODs (non-primary)
   */
  const getSecondaryVods = useCallback(() => {
    return state.vods.filter((v) => v.id !== state.primaryVodId);
  }, [state.vods, state.primaryVodId]);

  /**
   * Calculate adjusted time for synced playback
   */
  const getAdjustedVodTime = useCallback(
    (vodId) => {
      const vod = state.vods.find((v) => v.id === vodId);
      if (!vod) return 0;

      const primaryVod = getPrimaryVod();
      if (!primaryVod || vodId === state.primaryVodId) {
        return vod.currentTime;
      }

      // Secondary VOD: apply sync offset
      return getAdjustedTime(primaryVod.currentTime, vod.syncOffset);
    },
    [state.vods, state.primaryVodId, getPrimaryVod]
  );

  /**
   * Sync two VODs based on detected timers
   */
  const syncVodsByTimers = useCallback(
    (vodId1, vodId2, timer1, timer2) => {
      if (!timersMatch(timer1, timer2)) {
        setSyncStatus(vodId2, "error", "Timers do not match");
        return false;
      }

      const offset = calculateTimerOffset(timer1, timer2);
      setSyncOffset(vodId2, offset);
      setSyncStatus(vodId2, "synced");
      return true;
    },
    [setSyncOffset, setSyncStatus]
  );

  /**
   * Get all VODs in order (primary first)
   */
  const getOrderedVods = useCallback(() => {
    const primary = state.vods.find((v) => v.id === state.primaryVodId);
    const secondary = state.vods.filter((v) => v.id !== state.primaryVodId);
    return primary ? [primary, ...secondary] : state.vods;
  }, [state.vods, state.primaryVodId]);

  /**
   * Check if all VODs are synced
   */
  const areAllSynced = useCallback(() => {
    return (
      state.vods.length > 1 &&
      state.vods.every((v) => v.syncStatus === "synced")
    );
  }, [state.vods]);

  return {
    // State
    state,
    vods: state.vods,
    primaryVodId: state.primaryVodId,
    isLinkedPlayback: state.isLinkedPlayback,
    syncSettings: state.syncSettings,

    // Actions
    addVod,
    removeVod,
    setPrimaryVod,
    updateVodTime,
    updateVodDuration,
    setSyncOffset,
    setSyncStatus,
    addDetectedTimer,
    clearDetectedTimers,
    setLinkedPlayback,
    updateSyncSettings,
    clearAllVods,

    // Selectors
    getPrimaryVod,
    getSecondaryVods,
    getOrderedVods,
    getAdjustedVodTime,

    // Helpers
    syncVodsByTimers,
    areAllSynced,
  };
}
