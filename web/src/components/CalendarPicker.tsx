import { useEffect, useRef } from "react";
import type { Calendar, MailProvider } from "../types";
import { calendarProviderFor, calendarProviderLabel } from "../lib/format";
import styles from "./CalendarPicker.module.css";

interface CalendarPickerProps {
  calendars: Calendar[];
  selectedId: string;
  /** The mailbox the event came from — decides the "same source" / "cross-provider" hint. */
  source: MailProvider;
  open: boolean;
  disabled?: boolean;
  onToggle: () => void;
  onSelect: (calendarId: string) => void;
  onClose: () => void;
}

/** "Google · work@acme.co" */
function calendarLabel(calendar: Calendar): string {
  return `${calendarProviderLabel(calendar.provider)} · ${calendar.displayName}`;
}

/**
 * "Google Calendar" for a calendar named after its own account, and
 * "Google Calendar · work@acme.co" for a shared one, so the row says which
 * connected account reaches it.
 */
function calendarSubLabel(calendar: Calendar): string {
  const base = `${calendarProviderLabel(calendar.provider)} Calendar`;
  return calendar.displayName === calendar.accountEmail
    ? base
    : `${base} · ${calendar.accountEmail}`;
}

export function CalendarPicker({
  calendars,
  selectedId,
  source,
  open,
  disabled = false,
  onToggle,
  onSelect,
  onClose,
}: CalendarPickerProps) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const selected = calendars.find((calendar) => calendar.id === selectedId) ?? calendars[0];

  // Close on outside click and on Escape, so an open menu never traps the page.
  useEffect(() => {
    if (!open) return;

    function onPointerDown(event: MouseEvent) {
      if (!wrapRef.current?.contains(event.target as Node)) onClose();
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }

    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open, onClose]);

  if (!selected) return null;

  const dotClass = selected.provider === "google" ? styles.gmailDot : styles.outlookDot;
  const hint = selected.provider === calendarProviderFor(source) ? "same source" : "cross-provider";

  return (
    <div className={styles.wrap} ref={wrapRef}>
      <button
        type="button"
        className={styles.trigger}
        onClick={onToggle}
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        <span className={`${styles.dot} ${dotClass}`} />
        <span className={styles.triggerLabel}>{calendarLabel(selected)}</span>
        <span className={styles.hint}>{hint}</span>
        <span className={styles.caret} aria-hidden="true">
          ▼
        </span>
      </button>

      {open && (
        <ul className={styles.menu} role="listbox" aria-label="Connected calendars">
          <li className={styles.menuHeader} aria-hidden="true">
            Connected calendars · {calendars.length}
          </li>
          {calendars.map((calendar) => {
            const isSelected = calendar.id === selectedId;
            return (
              <li key={calendar.id} role="option" aria-selected={isSelected}>
                <button
                  type="button"
                  className={`${styles.row} ${isSelected ? styles.rowSelected : ""}`}
                  onClick={() => onSelect(calendar.id)}
                >
                  <span
                    className={`${styles.dot} ${
                      calendar.provider === "google" ? styles.gmailDot : styles.outlookDot
                    }`}
                  />
                  <span className={styles.rowText}>
                    <span className={styles.rowLabel}>{calendar.displayName}</span>
                    <span className={styles.rowSub}>{calendarSubLabel(calendar)}</span>
                  </span>
                  <span className={styles.check}>{isSelected ? "✓" : ""}</span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

export { calendarLabel };
