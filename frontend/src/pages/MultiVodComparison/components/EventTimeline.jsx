import React, { useState, useMemo } from "react";
import styles from "../styles/EventTimeline.module.scss";

/**
 * Expanded event timeline showing all events from all VODs
 * Supports filtering and collapsing
 */
export default function EventTimeline({ vods, globalTime }) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [selectedFilter, setSelectedFilter] = useState("all");

  // Combine all events with VOD metadata
  const allEvents = useMemo(() => {
    const combined = [];

    vods.forEach((vod, vodIndex) => {
      (vod.events || []).forEach((event) => {
        combined.push({
          ...event,
          vodIndex,
          vodName: vod.name,
          vodColor: `hsl(${vodIndex * 120}, 70%, 60%)`,
        });
      });
    });

    // Sort by timestamp
    return combined.sort((a, b) => a.timestamp - b.timestamp);
  }, [vods]);

  // Filter events
  const filteredEvents = useMemo(() => {
    if (selectedFilter === "all") return allEvents;
    return allEvents.filter((e) => e.type === selectedFilter);
  }, [allEvents, selectedFilter]);

  // Get unique event types
  const eventTypes = useMemo(() => {
    const types = new Set(allEvents.map((e) => e.type));
    return Array.from(types);
  }, [allEvents]);

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  if (filteredEvents.length === 0) {
    return (
      <div className={styles.container}>
        <div
          className={styles.header}
          onClick={() => setIsExpanded(!isExpanded)}
        >
          <h3>Event Timeline ({allEvents.length} total)</h3>
          <span className={styles.toggleIcon}>{isExpanded ? "▼" : "▶"}</span>
        </div>
        {isExpanded && (
          <div className={styles.content}>
            <p className={styles.emptyMessage}>No events found</p>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className={styles.container}>
      {/* Header with toggle */}
      <div
        className={styles.header}
        onClick={() => setIsExpanded(!isExpanded)}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            setIsExpanded(!isExpanded);
          }
        }}
        aria-expanded={isExpanded}
        aria-label="Toggle event timeline"
      >
        <h3>
          Events ({filteredEvents.length} of {allEvents.length})
        </h3>
        <span className={styles.toggleIcon}>{isExpanded ? "▼" : "▶"}</span>
      </div>

      {/* Expanded content */}
      {isExpanded && (
        <div className={styles.content}>
          {/* Filters */}
          <div className={styles.filters}>
            <button
              className={`${styles.filterButton} ${selectedFilter === "all" ? styles.active : ""}`}
              onClick={() => setSelectedFilter("all")}
              aria-label="Show all events"
              aria-pressed={selectedFilter === "all"}
            >
              All ({allEvents.length})
            </button>
            {eventTypes.map((type) => {
              const count = allEvents.filter((e) => e.type === type).length;
              return (
                <button
                  key={type}
                  className={`${styles.filterButton} ${selectedFilter === type ? styles.active : ""}`}
                  onClick={() => setSelectedFilter(type)}
                  aria-label={`Show ${type} events (${count})`}
                  aria-pressed={selectedFilter === type}
                >
                  {type.charAt(0).toUpperCase() + type.slice(1)} ({count})
                </button>
              );
            })}
          </div>

          {/* Events list */}
          <div className={styles.eventList}>
            {filteredEvents.map((event, idx) => {
              const isHighlighted =
                Math.abs(event.timestamp - globalTime) < 5; // Highlight events near current time

              return (
                <div
                  key={`${event.vodIndex}-${event.event_id}-${idx}`}
                  className={`${styles.eventRow} ${isHighlighted ? styles.highlighted : ""}`}
                >
                  <span className={styles.time}>{formatTime(event.timestamp)}</span>
                  <span
                    className={styles.badge}
                    style={{ backgroundColor: event.vodColor }}
                    role="img"
                    aria-label={event.type}
                  >
                    {event.type === "kill" ? "⚡" : "💀"}
                  </span>
                  <span className={styles.vodName}>
                    <strong>VOD {event.vodIndex + 1}</strong>: {event.vodName}
                  </span>
                  <span className={styles.label}>{event.label}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
