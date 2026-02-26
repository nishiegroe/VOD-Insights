/**
 * VOD Sync Utilities
 * Helper functions for multi-VOD synchronization
 */

/**
 * Format seconds to MM:SS or HH:MM:SS format
 */
export function formatTime(seconds) {
  const hrs = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);

  if (hrs > 0) {
    return `${hrs}:${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
  }
  return `${mins}:${String(secs).padStart(2, "0")}`;
}

/**
 * Parse time string to seconds
 * Handles: "MM:SS", "HH:MM:SS", "M:SS", etc.
 */
export function parseTime(timeString) {
  const parts = String(timeString || "").split(":").map(Number);
  let seconds = 0;

  if (parts.length === 3) {
    seconds = parts[0] * 3600 + parts[1] * 60 + parts[2];
  } else if (parts.length === 2) {
    seconds = parts[0] * 60 + parts[1];
  } else if (parts.length === 1) {
    seconds = parts[0];
  }

  return Math.max(0, seconds);
}

/**
 * Calculate sync confidence score
 * Based on number of matching timers and average confidence
 */
export function calculateSyncConfidence(
  detectedTimers1,
  detectedTimers2,
  ocrConfidence
) {
  let score = ocrConfidence || 0;

  // Boost score if multiple timers detected
  const sharedTimers = detectedTimers1.filter((t1) =>
    detectedTimers2.some((t2) => t2.value === t1.value)
  );

  if (sharedTimers.length > 1) {
    score = Math.min(1.0, score + 0.15);
  } else if (sharedTimers.length > 0) {
    score = Math.min(1.0, score + 0.1);
  }

  return Math.round(score * 100) / 100;
}

/**
 * Check if two timers are close enough to be considered matching
 * @param {string} timer1 - First timer (e.g., "14:32")
 * @param {string} timer2 - Second timer (e.g., "14:32")
 * @param {number} toleranceSeconds - How close they need to be (default: 2)
 */
export function timersClose(timer1, timer2, toleranceSeconds = 2) {
  const t1 = parseTime(timer1);
  const t2 = parseTime(timer2);
  return Math.abs(t1 - t2) <= toleranceSeconds;
}

/**
 * Generate sync event timeline from multiple VODs
 * Returns array of events where timers match across VODs
 */
export function generateSyncTimeline(vods) {
  if (!vods || vods.length < 2) {
    return [];
  }

  const timeline = [];

  // Get all detected timers from all VODs
  const allTimers = vods.flatMap((vod) =>
    vod.detectedTimers.map((timer) => ({
      vodId: vod.id,
      vodLabel: vod.label,
      ...timer,
    }))
  );

  // Group by timer value
  const timerGroups = {};
  allTimers.forEach((timer) => {
    if (!timerGroups[timer.value]) {
      timerGroups[timer.value] = [];
    }
    timerGroups[timer.value].push(timer);
  });

  // Create events for timers that match across multiple VODs
  Object.entries(timerGroups).forEach(([timerValue, matches]) => {
    // Only count as event if appears in 2+ VODs
    const uniqueVods = new Set(matches.map((m) => m.vodId));
    if (uniqueVods.size >= 2) {
      timeline.push({
        timer: timerValue,
        timestamp: parseTime(timerValue),
        vodMatches: matches,
        vodCount: uniqueVods.size,
        avgConfidence:
          Math.round(
            (matches.reduce((sum, m) => sum + m.confidence, 0) /
              matches.length) *
              100
          ) / 100,
      });
    }
  });

  // Sort by timestamp
  timeline.sort((a, b) => a.timestamp - b.timestamp);

  return timeline;
}

/**
 * Generate sync quality report
 * Returns metrics about sync quality and suggestions
 */
export function generateSyncReport(vods) {
  if (!vods || vods.length < 2) {
    return null;
  }

  const syncedVods = vods.filter((v) => v.syncStatus === "synced");
  const timeline = generateSyncTimeline(vods);

  return {
    totalVods: vods.length,
    syncedVods: syncedVods.length,
    syncPercentage: Math.round((syncedVods.length / vods.length) * 100),
    syncPoints: timeline.length,
    avgSyncConfidence:
      timeline.length > 0
        ? Math.round(
            timeline.reduce((sum, e) => sum + e.avgConfidence, 0) /
              timeline.length *
              100
          ) / 100
        : 0,
    recommendations: generateRecommendations(vods, timeline),
  };
}

/**
 * Generate sync recommendations for the user
 */
function generateRecommendations(vods, timeline) {
  const recommendations = [];

  // Check if primary VOD is set
  const primaryVod = vods.find((v) => v.syncStatus === "synced");
  if (!primaryVod) {
    recommendations.push(
      "Set a primary VOD and sync at least one secondary for better control"
    );
  }

  // Check sync confidence
  if (timeline.length > 0) {
    const avgConfidence = timeline.reduce((sum, e) => sum + e.avgConfidence, 0) / timeline.length;
    if (avgConfidence < 0.8) {
      recommendations.push(
        "Sync confidence is low. Try syncing at a point with clearer timer visibility"
      );
    }
  }

  // Check if all VODs are synced
  const unsyncedVods = vods.filter((v) => v.syncStatus !== "synced");
  if (unsyncedVods.length > 0 && unsyncedVods.length <= 2) {
    recommendations.push(
      `Sync ${unsyncedVods[0].label} to complete synchronization`
    );
  }

  // Check offset reasonableness
  vods.forEach((vod) => {
    if (vod.syncOffset && Math.abs(vod.syncOffset) > 30000) {
      recommendations.push(
        `Large offset detected for ${vod.label} (${(vod.syncOffset / 1000).toFixed(1)}s). Verify this is correct.`
      );
    }
  });

  return recommendations.slice(0, 3); // Return top 3 recommendations
}

/**
 * Export sync data as CSV
 */
export function exportSyncAsCSV(vods) {
  const headers = ["VOD", "Label", "Sync Status", "Offset (s)", "Duration"];
  const rows = vods.map((vod) => [
    vod.url,
    vod.label,
    vod.syncStatus,
    (vod.syncOffset / 1000).toFixed(2),
    formatTime(vod.duration),
  ]);

  const csvContent = [
    headers.join(","),
    ...rows.map((row) => row.map((cell) => `"${cell}"`).join(",")),
  ].join("\n");

  return csvContent;
}

/**
 * Generate a shareable sync config
 * Can be saved/shared for reproducing sync with same VODs
 */
export function generateSyncConfig(vods) {
  return {
    version: 1,
    timestamp: new Date().toISOString(),
    vods: vods.map((vod) => ({
      url: vod.url,
      label: vod.label,
      syncOffset: vod.syncOffset,
      duration: vod.duration,
    })),
    metadata: {
      totalSyncPoints: vods.reduce((sum, v) => sum + v.detectedTimers.length, 0),
    },
  };
}

/**
 * Validate sync data for consistency
 * Returns { valid: boolean, issues: string[] }
 */
export function validateSyncData(vods) {
  const issues = [];

  if (!vods || vods.length < 2) {
    issues.push("At least 2 VODs are required");
    return { valid: false, issues };
  }

  vods.forEach((vod, idx) => {
    if (!vod.id) issues.push(`VOD ${idx + 1}: Missing ID`);
    if (!vod.url) issues.push(`VOD ${idx + 1}: Missing URL`);
    if (vod.duration <= 0) issues.push(`VOD ${idx + 1}: Invalid duration`);
    if (vod.syncOffset === undefined || vod.syncOffset === null) {
      issues.push(`VOD ${idx + 1}: Missing sync offset`);
    }
  });

  // Check for extreme offsets
  vods.forEach((vod) => {
    if (Math.abs(vod.syncOffset) > vod.duration * 1000) {
      issues.push(`VOD ${vod.label}: Offset exceeds VOD duration`);
    }
  });

  return {
    valid: issues.length === 0,
    issues,
  };
}
