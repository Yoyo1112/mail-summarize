import { useCallback, useEffect, useMemo, useState } from "react";
import type { Calendar, DetectedEvent, Summary, Tab } from "../types";
import type { ConnectedAccount } from "../lib/api";
import { formatAgo } from "../lib/format";
import { useIsMobile } from "../lib/useMediaQuery";
import * as api from "../lib/api";
import { CalendarSheet } from "../components/mobile/CalendarSheet";
import { DesktopStream } from "./DesktopStream";
import { MobileQueue } from "./MobileQueue";

interface TriageStreamProps {
  initialEvents: DetectedEvent[];
  summaries: Summary[];
  /** Total Summaries the run produced; the table shows the loaded page of them. */
  summaryTotal: number;
  calendars: Calendar[];
  lastSyncedAt: string;
  /** True while the connected tokens lack calendar write scopes — blocks every write. */
  scopeMissing: boolean;
  accounts: ConnectedAccount[];
  /** Re-fetches everything from the API; there is no live push. */
  onReload: () => void;
}

/**
 * Owns the review state for both layouts. Desktop renders 1a; below the mobile
 * breakpoint it renders the 1c queue with the 1d calendar sheet.
 */
export function TriageStream({
  initialEvents,
  summaries,
  summaryTotal,
  calendars,
  lastSyncedAt,
  scopeMissing,
  accounts,
  onReload,
}: TriageStreamProps) {
  const isMobile = useIsMobile();

  const [events, setEvents] = useState(initialEvents);
  const [tab, setTab] = useState<Tab>("needs-review");
  const [openPickerId, setOpenPickerId] = useState<string | null>(null);
  const [sheetEventId, setSheetEventId] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [syncedAt, setSyncedAt] = useState(lastSyncedAt);
  useEffect(() => setSyncedAt(lastSyncedAt), [lastSyncedAt]);

  const pending = useMemo(() => events.filter((e) => e.status === "pending"), [events]);
  const ignored = useMemo(() => events.filter((e) => e.status === "ignored"), [events]);

  /** Confirmed cards stay in the review stream so Undo stays reachable. */
  const streamEvents = useMemo(() => events.filter((e) => e.status !== "ignored"), [events]);

  /** On mobile only one pending card is expanded; the first one starts open. */
  const [expandedId, setExpandedId] = useState<string | null>(
    () => initialEvents.find((e) => e.status === "pending")?.id ?? null,
  );

  const patchEvent = useCallback((id: string, patch: Partial<DetectedEvent>) => {
    setEvents((current) =>
      current.map((event) => (event.id === id ? { ...event, ...patch } : event)),
    );
  }, []);

  /**
   * Optimistic update with rollback: flip to confirmed immediately, and on API
   * failure return the event to pending with the error attached to its card.
   */
  const confirm = useCallback(
    async (id: string) => {
      const event = events.find((candidate) => candidate.id === id);
      if (!event) return;

      setOpenPickerId(null);
      setSheetEventId(null);
      patchEvent(id, {
        status: "confirmed",
        error: null,
        confirmedAt: new Date().toISOString(),
      });

      const result = await api.confirmEvent(id, event.targetCalendarId);
      if (result.ok) {
        patchEvent(id, { providerEventUrl: result.providerEventUrl });
        return;
      }

      patchEvent(id, {
        status: "pending",
        error: result.error,
        confirmedAt: undefined,
        providerEventUrl: null,
      });
    },
    [events, patchEvent],
  );

  const ignore = useCallback(
    async (id: string) => {
      setOpenPickerId(null);
      setSheetEventId(null);
      patchEvent(id, { status: "ignored", error: null, ignoredAt: new Date().toISOString() });
      await api.ignoreEvent(id);
    },
    [patchEvent],
  );

  /** Undo a Confirmation, or Restore a Dismissal — both return the event to pending. */
  const undo = useCallback(
    async (id: string) => {
      const event = events.find((candidate) => candidate.id === id);
      if (!event) return;

      const wasConfirmed = event.status === "confirmed";
      setOpenPickerId(null);
      patchEvent(id, {
        status: "pending",
        error: null,
        confirmedAt: undefined,
        ignoredAt: undefined,
        providerEventUrl: null,
      });

      await (wasConfirmed ? api.undoConfirm(id) : api.restoreEvent(id));
    },
    [events, patchEvent],
  );

  const selectCalendar = useCallback(
    (id: string, calendarId: string) => {
      patchEvent(id, { targetCalendarId: calendarId });
      setOpenPickerId(null);
    },
    [patchEvent],
  );

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    onReload();
    // The reload replaces this component's props; the delay is only so the
    // "Checking for new results…" label is legible on a fast local response.
    window.setTimeout(() => setRefreshing(false), 600);
  }, [onReload]);

  // No live push — a background tick keeps the "synced N min ago" line honest.
  const [, forceTick] = useState(0);
  useEffect(() => {
    const timer = window.setInterval(() => forceTick((n) => n + 1), 60_000);
    return () => window.clearInterval(timer);
  }, []);

  const ago = formatAgo(syncedAt);
  const syncLine = refreshing ? "Checking for new results…" : `Synced ${ago}`;
  const syncLabel = refreshing ? "Checking…" : `Synced ${ago.replace(" min", "m")}`;

  const sheetEvent = events.find((event) => event.id === sheetEventId) ?? null;

  if (isMobile) {
    return (
      <>
        <MobileQueue
          streamEvents={streamEvents}
          pendingCount={pending.length}
          summaries={summaries}
          calendars={calendars}
          syncLabel={syncLabel}
          refreshing={refreshing}
          scopeMissing={scopeMissing}
          accounts={accounts}
          expandedId={expandedId}
          onExpand={setExpandedId}
          onOpenSheet={setSheetEventId}
          onConfirm={confirm}
          onIgnore={ignore}
          onUndo={undo}
          onRefresh={onRefresh}
        />
        {sheetEvent && (
          <CalendarSheet
            calendars={calendars}
            selectedId={sheetEvent.targetCalendarId}
            sourceAccountEmail={sheetEvent.sourceAccountEmail}
            onSelect={(calendarId) => selectCalendar(sheetEvent.id, calendarId)}
            onConfirm={() => confirm(sheetEvent.id)}
            onClose={() => setSheetEventId(null)}
          />
        )}
      </>
    );
  }

  return (
    <DesktopStream
      streamEvents={streamEvents}
      ignored={ignored}
      pendingCount={pending.length}
      summaries={summaries}
      summaryTotal={summaryTotal}
      calendars={calendars}
      tab={tab}
      onTabChange={setTab}
      openPickerId={openPickerId}
      onTogglePicker={(id) => setOpenPickerId((current) => (current === id ? null : id))}
      onClosePicker={() => setOpenPickerId(null)}
      onSelectCalendar={selectCalendar}
      onConfirm={confirm}
      onIgnore={ignore}
      onUndo={undo}
      syncLine={syncLine}
      refreshing={refreshing}
      onRefresh={onRefresh}
      scopeMissing={scopeMissing}
      accounts={accounts}
    />
  );
}
