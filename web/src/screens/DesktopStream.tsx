import type { Calendar, DetectedEvent, Summary, Tab } from "../types";
import type { ConnectedAccount } from "../lib/api";
import { ScopeBanner } from "../components/ScopeBanner";
import { DetectedEventCard } from "../components/DetectedEventCard";
import { SummaryTable } from "../components/SummaryTable";
import { TabStrip } from "../components/TabStrip";
import { TopBar } from "../components/TopBar";
import styles from "./TriageStream.module.css";

interface DesktopStreamProps {
  /** Pending and confirmed events — the review stream. Ignored ones drop out. */
  streamEvents: DetectedEvent[];
  ignored: DetectedEvent[];
  pendingCount: number;
  summaries: Summary[];
  summaryTotal: number;
  calendars: Calendar[];
  tab: Tab;
  onTabChange: (tab: Tab) => void;
  openPickerId: string | null;
  onTogglePicker: (id: string) => void;
  onClosePicker: () => void;
  onSelectCalendar: (id: string, calendarId: string) => void;
  onConfirm: (id: string) => void;
  onIgnore: (id: string) => void;
  onUndo: (id: string) => void;
  syncLine: string;
  refreshing: boolean;
  onRefresh: () => void;
  /** Blocks every write while the tokens hold read-only mail scopes. */
  scopeMissing: boolean;
  accounts: ConnectedAccount[];
}

/** 1a — desktop triage stream. */
export function DesktopStream({
  streamEvents,
  ignored,
  pendingCount,
  summaries,
  summaryTotal,
  calendars,
  tab,
  onTabChange,
  openPickerId,
  onTogglePicker,
  onClosePicker,
  onSelectCalendar,
  onConfirm,
  onIgnore,
  onUndo,
  syncLine,
  refreshing,
  onRefresh,
  scopeMissing,
  accounts,
}: DesktopStreamProps) {
  function renderCard(event: DetectedEvent) {
    return (
      <DetectedEventCard
        key={event.id}
        event={event}
        calendars={calendars}
        pickerOpen={openPickerId === event.id}
        onTogglePicker={() => onTogglePicker(event.id)}
        onClosePicker={onClosePicker}
        onSelectCalendar={(calendarId) => onSelectCalendar(event.id, calendarId)}
        onConfirm={() => onConfirm(event.id)}
        onIgnore={() => onIgnore(event.id)}
        onUndo={() => onUndo(event.id)}
        confirmDisabled={scopeMissing}
      />
    );
  }

  return (
    <div className={styles.page}>
      <div className={styles.frame}>
        <TopBar syncLine={syncLine} refreshing={refreshing} onRefresh={onRefresh} />
        <TabStrip
          active={tab}
          needsReviewCount={pendingCount}
          summariesCount={summaryTotal}
          ignoredCount={ignored.length}
          onChange={onTabChange}
        />

        <div className={styles.body}>
          {tab === "needs-review" && (
            <>
              {scopeMissing && <ScopeBanner accounts={accounts} />}
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
                      Nothing detected from the last run. New detections show up after
                      the next one — this page does not update on its own.
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
