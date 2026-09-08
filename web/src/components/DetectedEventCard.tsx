import type { Calendar, DetectedEvent } from "../types";
import { formatEventDate, formatEventTime, formatTime } from "../lib/format";
import { CalendarPicker, calendarLabel } from "./CalendarPicker";
import { ProviderMark } from "./ProviderMark";
import styles from "./DetectedEventCard.module.css";

interface DetectedEventCardProps {
  event: DetectedEvent;
  calendars: Calendar[];
  /** Whether this card's calendar dropdown is the open one (only one opens at a time). */
  pickerOpen: boolean;
  onTogglePicker: () => void;
  onClosePicker: () => void;
  onSelectCalendar: (calendarId: string) => void;
  /** Confirmation — writes the event to its Target Calendar. */
  onConfirm: () => void;
  /** Dismissal — "Not an event". */
  onIgnore: () => void;
  /** Reopens a resolved event: Undo after a Confirmation, Restore after a Dismissal. */
  onUndo: () => void;
  /** True while a write cannot succeed — the calendar scopes are not granted. */
  confirmDisabled?: boolean;
}

const STATUS_LABEL = {
  pending: "Pending",
  confirmed: "Confirmed",
  ignored: "Ignored",
} as const;

const BAR_CLASS = {
  pending: styles.barPending,
  confirmed: styles.barConfirmed,
  ignored: styles.barIgnored,
} as const;

const CHIP_CLASS = {
  pending: styles.chipPending,
  confirmed: styles.chipConfirmed,
  ignored: styles.chipIgnored,
} as const;

export function DetectedEventCard({
  event,
  calendars,
  pickerOpen,
  onTogglePicker,
  onClosePicker,
  onSelectCalendar,
  onConfirm,
  onIgnore,
  onUndo,
  confirmDisabled = false,
}: DetectedEventCardProps) {
  const { status } = event;
  const isPending = status === "pending";
  const isIgnored = status === "ignored";
  const target = calendars.find((calendar) => calendar.id === event.targetCalendarId);

  const date = formatEventDate(event.startsAt);
  const time = formatEventTime(event.startsAt, event.endsAt);

  return (
    <article className={styles.card}>
      <div className={`${styles.bar} ${BAR_CLASS[status]}`} />
      <div className={`${styles.body} ${isIgnored ? styles.bodyIgnored : ""}`}>
        {/* 1. Header row */}
        <div className={styles.header}>
          <div className={styles.headerMain}>
            <div className={styles.chipRow}>
              <span className={`${styles.chip} ${CHIP_CLASS[status]}`}>{STATUS_LABEL[status]}</span>
              <span className={styles.detectedAt}>
                {isIgnored && event.ignoredAt
                  ? `you dismissed this · ${formatTime(event.ignoredAt)}`
                  : `detected ${formatTime(event.detectedAt)}`}
              </span>
            </div>
            {/* 2. Title */}
            <h3 className={`${styles.title} ${isIgnored ? styles.titleIgnored : ""}`}>
              {event.title}
            </h3>
          </div>
          <div className={styles.when}>
            <span className="microLabel">When</span>
            <span className={styles.whenDate}>{date}</span>
            <span className={styles.whenTime}>{time}</span>
          </div>
        </div>

        {/* 3. Two-column detail grid */}
        <div className={styles.details}>
          <div className={styles.where}>
            <div className={`microLabel ${styles.fieldLabel}`}>Where</div>
            {event.location ? (
              <div className={styles.location}>{event.location}</div>
            ) : (
              <div className={styles.noLocation}>
                <span className={styles.emDashRule} aria-hidden="true" />
                <span className={styles.noLocationText}>
                  No location in the email — event will be created without one
                </span>
              </div>
            )}
          </div>
          <div className={styles.detectedFrom}>
            <div className={`microLabel ${styles.fieldLabel}`}>Detected from</div>
            <div className={styles.source}>
              <ProviderMark provider={event.source} />
              <div className={styles.sourceText}>
                <div className={styles.sender}>{event.senderName}</div>
                <div className={styles.subject} title={event.subject}>
                  {event.subject}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/*
          The confirm failed and the optimistic update rolled back. The banner stays
          attached to the card so the failure is never silently dropped.
        */}
        {event.error && (
          <div className={styles.error} role="alert">
            <div>
              <div className={styles.errorMessage}>{event.error.message}</div>
              {event.error.diagnostic && (
                <div className={styles.errorDiagnostic}>{event.error.diagnostic}</div>
              )}
              <div className={styles.errorReassurance}>
                Nothing was added to your calendar.
              </div>
            </div>
          </div>
        )}

        {/* 4. Action row — pending only */}
        {isPending && (
          <div className={styles.actions}>
            <div>
              {/* No calendars to choose from until calendar access is granted. */}
              {calendars.length > 0 && (
                <>
              <div className={`microLabel ${styles.fieldLabel}`}>Target calendar</div>
              <CalendarPicker
                calendars={calendars}
                selectedId={event.targetCalendarId}
                source={event.source}
                open={pickerOpen}
                onToggle={onTogglePicker}
                onSelect={onSelectCalendar}
                onClose={onClosePicker}
              />
                </>
              )}
            </div>
            <div className={styles.buttons}>
              <button type="button" className={styles.ghostButton} onClick={onIgnore}>
                Not an event
              </button>
              <button
                type="button"
                className={styles.primaryButton}
                onClick={onConfirm}
                disabled={confirmDisabled}
                title={confirmDisabled ? "Calendar access has not been granted yet" : undefined}
              >
                Add to calendar
              </button>
            </div>
          </div>
        )}

        {/* 5. Resolved row — confirmed or ignored */}
        {!isPending && (
          <div className={styles.resolved}>
            <span className={styles.resultLine}>
              {status === "confirmed" && target ? (
                <>
                  Added to <strong>{calendarLabel(target)}</strong> — {date}, {time}.
                </>
              ) : (
                "Ignored — kept out of the queue, nothing was written to a calendar"
              )}
            </span>
            <button type="button" className={styles.undoButton} onClick={onUndo}>
              {isIgnored ? "Restore" : "Undo"}
            </button>
          </div>
        )}
      </div>
    </article>
  );
}
