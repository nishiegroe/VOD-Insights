import React from "react";
import styles from "../styles/OffsetCard.module.scss";

/**
 * Single offset card for one VOD
 * Allows +/- buttons or manual input
 */
export default function OffsetCard({
  vod,
  vodIndex,
  isReference,
  isEditing,
  editValue,
  onEdit,
  onEditChange,
  onEditSubmit,
  onEditCancel,
  onIncrement,
  onDecrement,
}) {
  const offsetDisplay = isReference ? "0s (Reference)" : `${vod.offset > 0 ? "+" : ""}${vod.offset}s`;
  const offsetLabel = vod.offset === 0 ? "In Sync" : vod.offset > 0 ? "Ahead" : "Behind";

  return (
    <div className={styles.card} style={{ borderLeftColor: `hsl(${vodIndex * 120}, 70%, 60%)` }}>
      <div className={styles.vodName}>VOD {vodIndex + 1}</div>
      <div className={styles.vodTitle}>{vod.name}</div>

      {isEditing ? (
        // Edit mode
        <div className={styles.editMode}>
          <input
            type="number"
            value={editValue}
            onChange={(e) => onEditChange(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") onEditSubmit();
              if (e.key === "Escape") onEditCancel();
            }}
            placeholder="Offset in seconds"
            autoFocus
            className={styles.editInput}
            aria-label={`Edit offset for VOD ${vodIndex + 1}`}
          />
          <button
            onClick={onEditSubmit}
            className={styles.buttonSmall}
            title="Apply offset (Enter)"
          >
            ✓
          </button>
          <button
            onClick={onEditCancel}
            className={styles.buttonSmall}
            title="Cancel (Esc)"
          >
            ✗
          </button>
        </div>
      ) : (
        // Display mode
        <div className={styles.displayMode}>
          <div className={styles.offsetDisplay}>
            <span className={styles.offsetValue}>{offsetDisplay}</span>
            <span className={`${styles.offsetLabel} ${styles[offsetLabel.toLowerCase()]}`}>
              {offsetLabel}
            </span>
          </div>

          {!isReference && (
            <div className={styles.buttonGroup}>
              <button
                onClick={onDecrement}
                className={styles.button}
                aria-label={`Decrease offset by 1 second for VOD ${vodIndex + 1}`}
                title="Decrease offset"
              >
                −
              </button>
              <button
                onClick={onIncrement}
                className={styles.button}
                aria-label={`Increase offset by 1 second for VOD ${vodIndex + 1}`}
                title="Increase offset"
              >
                +
              </button>
            </div>
          )}

          {!isReference && (
            <button
              onClick={onEdit}
              className={styles.editButton}
              aria-label={`Edit offset for VOD ${vodIndex + 1} manually`}
              title="Edit offset manually"
            >
              Edit
            </button>
          )}
        </div>
      )}
    </div>
  );
}
