import {
  CALENDARS,
  DETECTED_EVENTS,
  IGNORED_EVENTS,
  LAST_SYNCED_AT,
  NEXT_RUN_LABEL,
  SUMMARIES,
} from "./fixtures";
import { TriageStream } from "./screens/TriageStream";

/** Total Summaries the run produced; SUMMARIES is the loaded page of them. */
const SUMMARY_TOTAL = 24;

export function App() {
  return (
    <TriageStream
      initialEvents={[...DETECTED_EVENTS, ...IGNORED_EVENTS]}
      summaries={SUMMARIES}
      summaryTotal={SUMMARY_TOTAL}
      calendars={CALENDARS}
      lastSyncedAt={LAST_SYNCED_AT}
      nextRunLabel={NEXT_RUN_LABEL}
    />
  );
}
