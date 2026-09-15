import type { Calendar, ConfirmError, DetectedEvent } from "../../types";
import {
  calendarProviderFor,
  calendarProviderLabel,
  formatAgo,
  formatEventDateShort,
  formatEventTimeShort,
} from "../../lib/format";
import { ProviderMark } from "../ProviderMark";
import styles from "./MobileEventCard.module.css";

interface MobileEventCardProps {
  event: DetectedEvent;
  calendars: Calendar[];
  /** Only one card is expanded at a time; the rest show the collapsed row. */
  expanded: boolean;
  onExpand: () => void;
  onOpenSheet: () => void;
  onConfirm: () => void;
  onIgnore: () => void;
  onUndo: () => void;
  /** True while a write cannot succeed — the calendar scopes are not granted. */
  confirmDisabled?: boolean;
}

/** Prose for a failed write, naming the account the user has to fix. */
function describeConfirmError(error: ConfirmError, target: Calendar | undefined): string {
  const provider = target ? calendarProviderLabel(target.provider) : "The calendar provider";
  const account = target?.accountEmail ?? "the connected account";

  switch (error.code) {
    case "token_expired":
      return `${provider} rejected the write: the access token for ${account} expired. The event is still pending — nothing was added.`;
    case "missing_scope":
      return `${provider} has not granted calendar write access for ${account}. The event is still pending — nothing was added.`;
    case "quota_exceeded":
      return `${provider} refused the write: the calendar API quota for today is used up. The event is still pending — nothing was added.`;
    case "network":
      return `The write to ${provider} did not complete. The event is still pending — nothing was added.`;
  }
}

export function MobileEventCard({
  event,
  calendars,
  expanded,
  onExpand,
  onOpenSheet,
  onConfirm,
  onIgnore,
  onUndo,
  confirmDisabled = false,
}: MobileEventCardProps) {
  const target = calendars.find((calendar) => calendar.id === event.targetCalendarId);
  const date = formatEventDateShort(event.startsAt);
  const time = formatEventTimeShort(event.startsAt, event.endsAt);
  const isIgnored = event.status === "ignored";
  const isConfirmed = event.status === "confirmed";
  const hasFailed = event.status === "pending" && event.error !== null;

  // Confirmed — 1d "state · written".
  if (isConfirmed) {
    return (
      <article className={`${styles.card} ${styles.cardConfirmed}`}>
        <div className={styles.collapsedHead}>
          <span className={`${styles.chip} ${styles.chipConfirmed}`}>
            <span aria-hidden="true">✓</span>Confirmed
          </span>
          <span className={styles.when}>
            {event.confirmedAt ? formatAgo(event.confirmedAt) : "just now"}
          </span>
        </div>
        <h3 className={styles.collapsedTitle}>{event.title}</h3>
        <p className={styles.resultLine}>
          {target ? (
            <>
              Added to{" "}
              <strong>
                {calendarProviderLabel(target.provider)} · {target.displayName}
              </strong>{" "}
              — {date}, {time}.
            </>
          ) : (
            <>Added to your calendar — {date}, {time}.</>
          )}
        </p>
        <div className={styles.actionPair}>
          {event.providerEventUrl ? (
            <a
              className={styles.pairPrimary}
              href={event.providerEventUrl}
              target="_blank"
              rel="noreferrer"
            >
              Open in calendar
            </a>
          ) : (
            // The API returns the provider's event link; there is no backend yet.
            <button type="button" className={styles.pairPrimary} disabled>
              Open in calendar
            </button>
          )}
          <button type="button" className={styles.pairGhost} onClick={onUndo}>
            Undo
          </button>
        </div>
      </article>
    );
  }

  // Confirm failed and rolled back to pending — 1d "state · write failed".
  if (hasFailed && event.error) {
    return (
      <article className={`${styles.card} ${styles.cardFailed}`} role="alert">
        <div className={`${styles.chip} ${styles.chipFailed}`}>
          <span aria-hidden="true">!</span>
          {event.error.message}
        </div>
        <h3 className={styles.collapsedTitle}>{event.title}</h3>
        <p className={styles.resultLine}>{describeConfirmError(event.error, target)}</p>
        {event.error.diagnostic && (
          <div className={styles.diagnostic}>{event.error.diagnostic}</div>
        )}
        <div className={styles.actionPair}>
          <button type="button" className={styles.pairDanger} onClick={onOpenSheet}>
            Reconnect {target ? calendarProviderLabel(target.provider) : "account"}
          </button>
          <button type="button" className={styles.pairGhost} onClick={onConfirm}>
            Retry
          </button>
        </div>
      </article>
    );
  }

  // Ignored — dimmed and restorable.
  if (isIgnored) {
    return (
      <article className={`${styles.card} ${styles.cardIgnored}`}>
        <div className={styles.collapsedHead}>
          <span className={`${styles.chip} ${styles.chipIgnored}`}>Ignored</span>
          <span className={styles.when}>
            {date} · {time}
          </span>
        </div>
        <h3 className={`${styles.collapsedTitle} ${styles.titleIgnored}`}>{event.title}</h3>
        <div className={styles.actionPair}>
          <button type="button" className={styles.pairPrimary} onClick={onUndo}>
            Restore
          </button>
        </div>
      </article>
    );
  }

  // Pending, collapsed — enough to decide whether to open it.
  if (!expanded) {
    return (
      <button type="button" className={styles.collapsed} onClick={onExpand}>
        <span className={styles.collapsedHead}>
          <span className={`${styles.chip} ${styles.chipPending}`}>Pending</span>
          <span className={styles.when}>
            {date} · {time}
          </span>
        </span>
        <span className={styles.collapsedTitle} style={{ display: "block" }}>
          {event.title}
        </span>
        <span className={styles.collapsedMeta}>
          {event.source === "gmail" ? "Gmail" : "Outlook"} · {event.senderName} · tap to review
        </span>
      </button>
    );
  }

  // Pending, expanded — the full review card.
  const dotClass = target?.provider === "outlook" ? styles.outlookDot : styles.gmailDot;
  const hint =
    target && target.provider === calendarProviderFor(event.source)
      ? "same source as email"
      : "cross-provider";

  return (
    <article className={styles.card}>
      <div className={`${styles.chip} ${styles.chipPending}`}>Pending</div>
      <h3 className={styles.title}>{event.title}</h3>

      <div className={styles.fields}>
        <div>
          <div className={styles.fieldLabel}>When</div>
          <div className={styles.fieldWhen}>
            {date} · {time}
          </div>
        </div>
        <div>
          <div className={styles.fieldLabel}>Where</div>
          {event.location ? (
            <div className={styles.fieldText}>{event.location}</div>
          ) : (
            <div className={styles.noLocation}>
              No location in the email — event will be created without one
            </div>
          )}
        </div>
        <div>
          <div className={styles.fieldLabel}>Detected from</div>
          <div className={styles.from}>
            <ProviderMark provider={event.source} />
            <span className={styles.fromText}>
              {event.senderName} — “{event.subject}”
            </span>
          </div>
        </div>
      </div>

      {/* No calendars to choose from until calendar access is granted. */}
      {calendars.length > 0 && (
      <div className={styles.calendarBlock}>
        <div className={styles.fieldLabel}>Target calendar</div>
        <button type="button" className={styles.calendarTrigger} onClick={onOpenSheet}>
          <span className={`${styles.calendarDot} ${dotClass}`} />
          <span className={styles.calendarText}>
            <span className={styles.calendarLabel}>
              {target
                ? `${calendarProviderLabel(target.provider)} · ${target.displayName}`
                : "Choose a calendar"}
            </span>
            <span className={styles.calendarHint}>{hint}</span>
          </span>
          <span className={styles.caret} aria-hidden="true">
            ▼
          </span>
        </button>
      </div>
      )}

      <div className={styles.actions}>
        <button
          type="button"
          className={styles.primary}
          onClick={onConfirm}
          disabled={confirmDisabled}
          title={confirmDisabled ? "Calendar access has not been granted yet" : undefined}
        >
          Add to calendar
        </button>
        <button type="button" className={styles.secondary} onClick={onIgnore}>
          Not an event
        </button>
      </div>
    </article>
  );
}
