import { useMemo } from "react";
import type { Calendar, DetectedEvent, Summary } from "../types";
import type { ConnectedAccount } from "../lib/api";
import { ScopeBanner } from "../components/ScopeBanner";
import { formatRelativeDay } from "../lib/format";
import { MobileEventCard } from "../components/mobile/MobileEventCard";
import { MobileTopBar } from "../components/mobile/MobileTopBar";
import { SummaryCards } from "../components/mobile/SummaryCards";
import styles from "./MobileQueue.module.css";

interface MobileQueueProps {
  /** Pending and confirmed events — the review stream. Ignored ones drop out. */
  streamEvents: DetectedEvent[];
  pendingCount: number;
  summaries: Summary[];
  calendars: Calendar[];
  syncLabel: string;
  refreshing: boolean;
  /** Blocks every write while the tokens hold read-only mail scopes. */
  scopeMissing: boolean;
  accounts: ConnectedAccount[];
  expandedId: string | null;
  onExpand: (id: string) => void;
  onOpenSheet: (id: string) => void;
  onConfirm: (id: string) => void;
  onIgnore: (id: string) => void;
  onUndo: (id: string) => void;
  onRefresh: () => void;
}

export function MobileQueue({
  streamEvents,
  pendingCount,
  summaries,
  calendars,
  syncLabel,
  refreshing,
  scopeMissing,
  accounts,
  expandedId,
  onExpand,
  onOpenSheet,
  onConfirm,
  onIgnore,
  onUndo,
  onRefresh,
}: MobileQueueProps) {
  /*
   * The section is headed "today", so it must only carry today's Summaries.
   * When a run produced none today, show the recent ones under an honest label
   * rather than an empty "today" section.
   */
  const { shown, heading } = useMemo(() => {
    const today = summaries.filter((summary) => formatRelativeDay(summary.receivedAt) === "Today");
    return today.length > 0
      ? { shown: today, heading: "Summaries · today" }
      : { shown: summaries, heading: "Summaries · recent" };
  }, [summaries]);

  return (
    <div className={styles.frame}>
      <MobileTopBar syncLabel={syncLabel} refreshing={refreshing} onRefresh={onRefresh} />

      <div className={styles.body}>
        {scopeMissing && <ScopeBanner accounts={accounts} />}
        <div className={styles.queueHead}>
          <span className={styles.queueLabel}>Needs review</span>
          <span
            className={`${styles.queueCount} ${
              pendingCount === 0 ? styles.queueCountEmpty : ""
            }`}
          >
            {pendingCount}
          </span>
        </div>

        <div className={styles.queue}>
          {streamEvents.length > 0 ? (
            streamEvents.map((event) => (
              <MobileEventCard
                key={event.id}
                event={event}
                calendars={calendars}
                expanded={expandedId === event.id}
                onExpand={() => onExpand(event.id)}
                onOpenSheet={() => onOpenSheet(event.id)}
                onConfirm={() => onConfirm(event.id)}
                onIgnore={() => onIgnore(event.id)}
                onUndo={() => onUndo(event.id)}
                confirmDisabled={scopeMissing}
              />
            ))
          ) : (
            <div className={styles.empty}>
              <span className={styles.emptyTitle}>Review queue is clear</span>
              <span className={styles.emptyBody}>
                Nothing detected from the last run.
              </span>
            </div>
          )}
        </div>

        <div className={styles.summariesHead}>
          <span className={styles.queueLabel}>{heading}</span>
        </div>
        <SummaryCards summaries={shown} />
      </div>
    </div>
  );
}
