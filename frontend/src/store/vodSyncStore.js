/**
 * Multi-VOD Sync Store
 * Manages state for multiple VODs with synchronization support
 */

export const initialVodState = {
  vods: [],
  primaryVodId: null,
  isLinkedPlayback: true,
  syncSettings: {
    autoDetect: true,
    confidenceThreshold: 0.85,
  },
};

export const vodSyncReducer = (state, action) => {
  switch (action.type) {
    case "ADD_VOD": {
      const newVod = {
        id: action.payload.id || `vod-${Date.now()}`,
        url: action.payload.url,
        label: action.payload.label || "",
        currentTime: 0,
        duration: 0,
        syncOffset: 0,
        detectedTimers: [],
        syncStatus: "unsync", // unsync | syncing | synced | error
        error: null,
      };
      const newVods = [...state.vods, newVod];
      return {
        ...state,
        vods: newVods,
        primaryVodId: state.primaryVodId || newVod.id,
      };
    }

    case "REMOVE_VOD": {
      const vodId = action.payload.id;
      const newVods = state.vods.filter((v) => v.id !== vodId);
      let newPrimaryId = state.primaryVodId;
      if (newPrimaryId === vodId) {
        newPrimaryId = newVods.length > 0 ? newVods[0].id : null;
      }
      return {
        ...state,
        vods: newVods,
        primaryVodId: newPrimaryId,
      };
    }

    case "SET_PRIMARY_VOD": {
      return {
        ...state,
        primaryVodId: action.payload.id,
      };
    }

    case "UPDATE_VOD_TIME": {
      return {
        ...state,
        vods: state.vods.map((vod) =>
          vod.id === action.payload.id
            ? {
                ...vod,
                currentTime: action.payload.currentTime,
              }
            : vod
        ),
      };
    }

    case "UPDATE_VOD_DURATION": {
      return {
        ...state,
        vods: state.vods.map((vod) =>
          vod.id === action.payload.id
            ? {
                ...vod,
                duration: action.payload.duration,
              }
            : vod
        ),
      };
    }

    case "SET_SYNC_OFFSET": {
      return {
        ...state,
        vods: state.vods.map((vod) =>
          vod.id === action.payload.id
            ? {
                ...vod,
                syncOffset: action.payload.offset,
              }
            : vod
        ),
      };
    }

    case "SET_SYNC_STATUS": {
      return {
        ...state,
        vods: state.vods.map((vod) =>
          vod.id === action.payload.id
            ? {
                ...vod,
                syncStatus: action.payload.status,
                error: action.payload.error || null,
              }
            : vod
        ),
      };
    }

    case "ADD_DETECTED_TIMER": {
      return {
        ...state,
        vods: state.vods.map((vod) =>
          vod.id === action.payload.id
            ? {
                ...vod,
                detectedTimers: [
                  ...vod.detectedTimers,
                  {
                    time: action.payload.time,
                    value: action.payload.value,
                    confidence: action.payload.confidence,
                  },
                ],
              }
            : vod
        ),
      };
    }

    case "CLEAR_DETECTED_TIMERS": {
      return {
        ...state,
        vods: state.vods.map((vod) =>
          vod.id === action.payload.id
            ? {
                ...vod,
                detectedTimers: [],
              }
            : vod
        ),
      };
    }

    case "SET_LINKED_PLAYBACK": {
      return {
        ...state,
        isLinkedPlayback: action.payload.enabled,
      };
    }

    case "UPDATE_SYNC_SETTINGS": {
      return {
        ...state,
        syncSettings: {
          ...state.syncSettings,
          ...action.payload,
        },
      };
    }

    case "CLEAR_ALL_VODS": {
      return {
        ...initialVodState,
      };
    }

    default:
      return state;
  }
};

/**
 * Helper: Calculate adjusted time for synced playback
 * @param {number} primaryTime - Current time of primary VOD in seconds
 * @param {number} syncOffset - Offset for secondary VOD in milliseconds
 * @returns {number} Adjusted time in seconds
 */
export const getAdjustedTime = (primaryTime, syncOffset) => {
  return Math.max(0, primaryTime + syncOffset / 1000);
};

/**
 * Helper: Check if two timers match (within tolerance)
 * @param {string} timer1 - Timer string (e.g., "14:32")
 * @param {string} timer2 - Timer string (e.g., "14:32")
 * @param {number} tolerance - Tolerance in seconds (default: 2)
 * @returns {boolean}
 */
export const timersMatch = (timer1, timer2, tolerance = 2) => {
  const parseTimer = (str) => {
    const parts = String(str || "").split(":").map(Number);
    let seconds = 0;
    if (parts.length === 3) seconds = parts[0] * 3600 + parts[1] * 60 + parts[2];
    else if (parts.length === 2) seconds = parts[0] * 60 + parts[1];
    else if (parts.length === 1) seconds = parts[0];
    return seconds;
  };

  const sec1 = parseTimer(timer1);
  const sec2 = parseTimer(timer2);
  return Math.abs(sec1 - sec2) <= tolerance;
};

/**
 * Helper: Calculate sync offset from two timers
 * @param {string} timer1 - First timer (primary)
 * @param {string} timer2 - Second timer (secondary)
 * @returns {number} Offset in milliseconds
 */
export const calculateTimerOffset = (timer1, timer2) => {
  const parseTimer = (str) => {
    const parts = String(str || "").split(":").map(Number);
    let seconds = 0;
    if (parts.length === 3) seconds = parts[0] * 3600 + parts[1] * 60 + parts[2];
    else if (parts.length === 2) seconds = parts[0] * 60 + parts[1];
    else if (parts.length === 1) seconds = parts[0];
    return seconds;
  };

  const sec1 = parseTimer(timer1);
  const sec2 = parseTimer(timer2);
  return (sec2 - sec1) * 1000; // Convert to milliseconds
};
