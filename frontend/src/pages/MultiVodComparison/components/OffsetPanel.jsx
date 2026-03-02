import React, { useState } from "react";
import OffsetCard from "./OffsetCard";
import styles from "../styles/OffsetPanel.module.scss";

/**
 * Offset control panel with cards for each VOD
 * Allows +/- adjustment, manual input, and reset
 */
export default function OffsetPanel({ vods, onOffsetChange }) {
  const [editingVodIndex, setEditingVodIndex] = useState(null);
  const [editValue, setEditValue] = useState("");

  const handleOffsetAdjust = (vodIndex, increment) => {
    const vod = vods[vodIndex];
    const newOffset = (vod.offset || 0) + increment;
    onOffsetChange(vodIndex, newOffset, "manual", 1.0);
  };

  const handleEditSubmit = (vodIndex) => {
    const newOffset = parseFloat(editValue);
    if (!isNaN(newOffset)) {
      onOffsetChange(vodIndex, newOffset, "manual", 1.0);
      setEditingVodIndex(null);
      setEditValue("");
    }
  };

  const handleResetOffsets = () => {
    vods.forEach((vod, idx) => {
      if (vod.offset !== 0) {
        onOffsetChange(idx, 0, "manual", 1.0);
      }
    });
  };

  return (
    <div className={styles.container}>
      <h3 className={styles.title}>Offset Controls</h3>
      <p className={styles.description}>
        Adjust VOD timing relative to VOD 1 (reference)
      </p>

      <div className={styles.cardsContainer}>
        {vods.map((vod, index) => (
          <OffsetCard
            key={vod.vod_id}
            vod={vod}
            vodIndex={index}
            isReference={index === 0}
            isEditing={editingVodIndex === index}
            editValue={editValue}
            onEdit={() => {
              setEditingVodIndex(index);
              setEditValue(String(vod.offset || 0));
            }}
            onEditChange={setEditValue}
            onEditSubmit={() => handleEditSubmit(index)}
            onEditCancel={() => {
              setEditingVodIndex(null);
              setEditValue("");
            }}
            onIncrement={() => handleOffsetAdjust(index, 1)}
            onDecrement={() => handleOffsetAdjust(index, -1)}
          />
        ))}
      </div>

      {/* Reset button */}
      <div className={styles.actions}>
        <button
          className={styles.resetButton}
          onClick={handleResetOffsets}
          aria-label="Reset all offsets to zero"
        >
          ↺ Reset Offsets
        </button>
      </div>

      {/* Help text */}
      <div className={styles.helpText}>
        <p>
          Positive offset = VOD started earlier · Negative offset = VOD started later
        </p>
      </div>
    </div>
  );
}
