import { useState, useEffect, useCallback } from "react";

/**
 * Hook for fetching and managing multi-VOD session state
 * Handles initial load, offset updates, and playback state
 */
export function useMultiVodState(sessionId) {
  const [state, setState] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Fetch initial session state
  useEffect(() => {
    if (!sessionId) {
      setError("No session ID provided");
      setLoading(false);
      return;
    }

    const fetchSession = async () => {
      try {
        const response = await fetch(`/api/sessions/multi-vod/${sessionId}`);
        if (!response.ok) {
          throw new Error(`Failed to fetch session: ${response.statusText}`);
        }
        const data = await response.json();
        setState(data);
        setError(null);
      } catch (err) {
        console.error("Failed to load session:", err);
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchSession();
  }, [sessionId]);

  // Update offset for a specific VOD
  const updateOffset = useCallback(
    async (vodIndex, newOffset, source = "manual", confidence = 1.0) => {
      if (!state) return;

      const vodId = state.vods[vodIndex].vod_id;

      try {
        const response = await fetch(
          `/api/sessions/multi-vod/${sessionId}/offsets`,
          {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              offsets: {
                [vodId]: newOffset,
              },
              source,
              confidence: source === "timer_ocr" ? confidence : undefined,
            }),
          }
        );

        if (!response.ok) {
          throw new Error("Failed to update offset");
        }

        const updatedState = await response.json();
        setState(updatedState);
      } catch (err) {
        console.error("Error updating offset:", err);
      }
    },
    [state, sessionId]
  );

  // Update playback state (play/pause/seek)
  const updatePlayback = useCallback(
    async (action, timestamp = null) => {
      if (!state) return;

      try {
        const response = await fetch(
          `/api/sessions/multi-vod/${sessionId}/playback`,
          {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              action,
              timestamp,
            }),
          }
        );

        if (!response.ok) {
          throw new Error("Failed to update playback");
        }

        const updatedState = await response.json();
        setState(updatedState);
      } catch (err) {
        console.error("Error updating playback:", err);
      }
    },
    [state, sessionId]
  );

  return {
    state,
    loading,
    error,
    updateOffset,
    updatePlayback,
  };
}
