import { useEffect } from "react";
import type { Calendar } from "../../types";
import { calendarProviderLabel } from "../../lib/format";
import styles from "./CalendarSheet.module.css";

interface CalendarSheetProps {
  calendars: Calendar[];
  selectedId: string;
  /**
   * The Mail Account the event arrived on. Only the calendar belonging to that
   * same account is "same source as email" — matching on provider alone would
   * label every Google calendar as the source.
   */
  sourceAccountEmail: string;
  onSelect: (calendarId: string) => void;
  /** "Confirm and add" — picks the highlighted calendar and confirms in one tap. */
  onConfirm: () => void;
  onClose: () => void;
}

/** "Google Calendar · same source as email" / "Outlook Calendar · lin@outlook.com" */
function sheetSubLabel(calendar: Calendar, sourceAccountEmail: string): string {
  const base = `${calendarProviderLabel(calendar.provider)} Calendar`;

  // A calendar named after its own account: only the source account gets the hint.
  if (calendar.displayName === calendar.accountEmail) {
    return calendar.accountEmail === sourceAccountEmail
      ? `${base} · same source as email`
      : base;
  }

  // A shared calendar — name which connected account reaches it.
  return `${base} · ${calendar.accountEmail}`;
}

export function CalendarSheet({
  calendars,
  selectedId,
  sourceAccountEmail,
  onSelect,
  onConfirm,
  onClose,
}: CalendarSheetProps) {
  // Escape closes, and the page behind must not scroll while the sheet is up.
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKeyDown);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [onClose]);

  return (
    <div
      className={styles.scrim}
      role="dialog"
      aria-modal="true"
      aria-label="Write event to"
      onClick={onClose}
    >
      <div className={styles.sheet} onClick={(event) => event.stopPropagation()}>
        <div className={styles.handle} aria-hidden="true" />
        <div className={styles.title}>Write event to</div>
        <ul className={styles.list}>
          {calendars.map((calendar) => {
            const isSelected = calendar.id === selectedId;
            return (
              <li key={calendar.id}>
                <button
                  type="button"
                  className={`${styles.row} ${isSelected ? styles.rowSelected : ""}`}
                  onClick={() => onSelect(calendar.id)}
                  aria-pressed={isSelected}
                >
                  <span
                    className={`${styles.dot} ${
                      calendar.provider === "google" ? styles.gmailDot : styles.outlookDot
                    }`}
                  />
                  <span className={styles.rowText}>
                    <span className={styles.rowLabel}>{calendar.displayName}</span>
                    <span className={styles.rowSub}>{sheetSubLabel(calendar, sourceAccountEmail)}</span>
                  </span>
                  <span className={styles.check}>{isSelected ? "✓" : ""}</span>
                </button>
              </li>
            );
          })}
        </ul>
        <button type="button" className={styles.confirm} onClick={onConfirm}>
          Confirm and add
        </button>
      </div>
    </div>
  );
}
