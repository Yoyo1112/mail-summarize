import { useCallback, useEffect, useMemo, useState } from "react";
import type { Calendar, DetectedEvent, Summary, Tab } from "../types";
import { formatAgo } from "../lib/format";
import { DetectedEventCard } from "../components/DetectedEventCard";
import { SummaryTable } from "../components/SummaryTable";
import { TabStrip } from "../components/TabStrip";
import { TopBar } from "../components/TopBar";
import styles from "./TriageStream.module.css";

interface TriageStreamProps {
  initialEvents: DetectedEvent[];
  summaries: Summary[];
  /** Total Summaries produced by the run; the table shows the loaded page of them. */
  summaryTotal: number;
  calendars: Calendar[];
  lastSyncedAt: string;
  nextRunLabel: string;
}

export function TriageStream({
  initialEvents,
  summaries,
  summaryTotal,
  calendars,
  lastSyncedAt,
  nextRunLabel,
}: TriageStreamProps) {
  const [events, setEvents] = useState(initialEvents);
  const [tab, setTab] = useState<Tab>("needs-review");
  const [openPickerId, setOpenPickerId] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [syncedAt, setSyncedAt] = useState(lastSyncedAt);

  const pending = useMemo(() => events.filter((e) => e.status === "pending"), [events]);
  const ignored = useMemo(() => events.filter((e) => e.status === "ignored"), [events]);

  /** Confirmed cards stay in the review stream so the Undo stays reachable. */
  const streamEvents = useMemo(
    () => events.filter((e) => e.status !== "ignored"),
    [events],
  );

  const setStatus = useCallback((id: string, status: DetectedEvent["status"]) => {
    const now = new Date().toISOString();
    setEvents((current) =>
      current.map((event) =>
        event.id === id
          ? {
              ...event,
              status,
              error: null,
              confirmedAt: status === "confirmed" ? now : undefined,
              ignoredAt: status === "ignored" ? now : undefined,
            }
          : event,
      ),
    );
    setOpenPickerId(null);
  }, []);

  const selectCalendar = useCallback((id: string, calendarId: string) => {
    setEvents((current) =>
      current.map((event) =>
        event.id === id ? { ...event, targetCalendarId: calendarId } : event,
      ),
    );
    setOpenPickerId(null);
  }, []);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    // Stands in for re-fetching GET /events and GET /summaries.
    window.setTimeout(() => {
      setRefreshing(false);
      setSyncedAt(new Date().toISOString());
    }, 900);
  }, []);

  // No live push — a background poll keeps the "synced N min ago" line honest.
  const [, forceTick] = useState(0);
  useEffect(() => {
    const timer = window.setInterval(() => forceTick((n) => n + 1), 60_000);
    return () => window.clearInterval(timer);
  }, []);

  const syncLine = refreshing
    ? "Checking for new results…"
    : `Synced ${formatAgo(syncedAt)} · next run ${nextRunLabel}`;

  function renderCard(event: DetectedEvent) {
    return (
      <DetectedEventCard
        key={event.id}
        event={event}
        calendars={calendars}
        pickerOpen={openPickerId === event.id}
        onTogglePicker={() =>
          setOpenPickerId((current) => (current === event.id ? null : event.id))
        }
        onClosePicker={() => setOpenPickerId(null)}
        onSelectCalendar={(calendarId) => selectCalendar(event.id, calendarId)}
        onConfirm={() => setStatus(event.id, "confirmed")}
        onIgnore={() => setStatus(event.id, "ignored")}
        onUndo={() => setStatus(event.id, "pending")}
      />
    );
  }

  return (
    <div className={styles.page}>
      <div className={styles.frame}>
        <TopBar syncLine={syncLine} refreshing={refreshing} onRefresh={onRefresh} />
        <TabStrip
          active={tab}
          needsReviewCount={pending.length}
          summariesCount={summaryTotal}
          ignoredCount={ignored.length}
          onChange={setTab}
        />

        <div className={styles.body}>
          {tab === "needs-review" && (
            <>
              <div className={styles.sectionHead}>
                <span className={styles.sectionLabel}>Detected events · needs review</span>
                <span className={styles.sectionNote}>
                  Nothing is written to a calendar until you confirm it.
                </span>
              </div>

              <div className={styles.queue}>
                {streamEvents.length > 0 ? (
                  streamEvents.map(renderCard)
                ) : (
                  <div className={styles.empty}>
                    <span className={styles.emptyTitle}>Review queue is clear</span>
                    <span className={styles.emptyBody}>
                      Next scheduled run at {nextRunLabel}. New detections show up after a
                      refresh.
                    </span>
                  </div>
                )}
              </div>

              <div className={styles.summariesHead}>
                <span className={styles.sectionLabel}>Recent summaries</span>
                <span className={styles.privacyNote}>
                  <span aria-hidden="true">⌾</span>
                  Summary text only — original messages are never stored (ADR-0002)
                </span>
              </div>
              <SummaryTable summaries={summaries} />
            </>
          )}

          {tab === "summaries" && (
            <>
              <div className={styles.sectionHead}>
                <span className={styles.sectionLabel}>All summaries · {summaryTotal}</span>
                <span className={styles.privacyNote}>
                  <span aria-hidden="true">⌾</span>
                  Summary text only — original messages are never stored (ADR-0002)
                </span>
              </div>
              <SummaryTable summaries={summaries} />
            </>
          )}

          {tab === "ignored" && (
            <>
              <div className={styles.sectionHead}>
                <span className={styles.sectionLabel}>Ignored · {ignored.length}</span>
                <span className={styles.sectionNote}>
                  Ignoring only removes the row — nothing was written to a calendar.
                </span>
              </div>
              <div className={styles.queue}>
                {ignored.length > 0 ? (
                  ignored.map(renderCard)
                ) : (
                  <div className={styles.empty}>
                    <span className={styles.emptyTitle}>Nothing ignored</span>
                    <span className={styles.emptyBody}>
                      Detected events you dismiss show up here, and can be restored.
                    </span>
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
