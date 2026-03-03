import { useState, useEffect, useCallback, useRef } from "react";

/**
 * Hook for fetching and managing multi-VOD session state
 * Handles initial load, offset updates, and playback state
 * 
 * @param {string} sessionId - Session ID from URL query params
 */
export function useMultiVodState(sessionId) {
  const [state, setState] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const retryCountRef = useRef(0);
  const MAX_RETRIES = 3;

  // Fetch initial session state with retry logic
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
        console.log("Fetched session data:", data);
        setState(data.session);  // ✅ Extract the session object, not the wrapper
        setError(null);
        setLoading(false);
        retryCountRef.current = 0; // Reset retry count on success
      } catch (err) {
        console.error("Failed to load session:", err);

        // Retry with exponential backoff
        if (retryCountRef.current < MAX_RETRIES) {
          const delay = Math.pow(2, retryCountRef.current) * 1000; // 1s, 2s, 4s
          retryCountRef.current++;
          console.log(
            `Retrying in ${delay}ms (attempt ${retryCountRef.current}/${MAX_RETRIES})...`
          );
          setTimeout(fetchSession, delay);
        } else {
          // Max retries exhausted - set error and stop loading
          setError(err.message);
          setLoading(false);
        }
      }
    };

    fetchSession();
  }, [sessionId]);

  // Update offset for a specific VOD with retry logic
  const updateOffset = useCallback(
    async (vodIndex, newOffset, source = "manual", confidence = 1.0) => {
      if (!state || !sessionId) return;

      const vodId = state.vods[vodIndex].vod_id;

      const attemptUpdate = async (retryCount = 0) => {
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
          console.log("Updated offset response:", updatedState);
          setState(updatedState.session);  // ✅ Extract the session object
        } catch (err) {
          console.error("Error updating offset:", err);

          // Retry with exponential backoff
          if (retryCount < MAX_RETRIES) {
            const delay = Math.pow(2, retryCount) * 1000;
            console.log(
              `Retrying offset update in ${delay}ms (attempt ${retryCount + 1}/${MAX_RETRIES})...`
            );
            setTimeout(() => attemptUpdate(retryCount + 1), delay);
          } else {
            console.error("Max retries reached for offset update");
          }
        }
      };

      attemptUpdate();
    },
    [state, sessionId]
  );

  // Update playback state (play/pause/seek) with retry logic
  const updatePlayback = useCallback(
    async (action, timestamp = null) => {
      if (!state || !sessionId) return;

      const attemptUpdate = async (retryCount = 0) => {
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
          console.log("Updated playback response:", updatedState);
          setState(updatedState.session);  // ✅ Extract the session object
        } catch (err) {
          console.error("Error updating playback:", err);

          // Retry with exponential backoff
          if (retryCount < MAX_RETRIES) {
            const delay = Math.pow(2, retryCount) * 1000;
            console.log(
              `Retrying playback update in ${delay}ms (attempt ${retryCount + 1}/${MAX_RETRIES})...`
            );
            setTimeout(() => attemptUpdate(retryCount + 1), delay);
          } else {
            console.error("Max retries reached for playback update");
          }
        }
      };

      attemptUpdate();
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
