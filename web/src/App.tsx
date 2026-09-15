import { useCallback, useEffect, useState } from "react";
import type { Calendar, DetectedEvent, Summary } from "./types";
import { fetchAll, type Status } from "./lib/api";
import { TriageStream } from "./screens/TriageStream";
import styles from "./App.module.css";

interface Data {
  status: Status;
  events: DetectedEvent[];
  summaries: Summary[];
  summaryTotal: number;
  calendars: Calendar[];
}

export function App() {
  const [data, setData] = useState<Data | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    setError(null);
    fetchAll()
      .then(setData)
      .catch((cause: unknown) => {
        setError(
          cause instanceof Error
            ? cause.message
            : "Could not reach the API. Is `npm run serve` running?",
        );
      });
  }, []);

  useEffect(load, [load]);

  if (error) {
    return (
      <div className={styles.centre}>
        <h1 className={styles.title}>Cannot reach the API</h1>
        <p className={styles.body}>{error}</p>
        <p className={styles.body}>
          Start it with <code>npm run serve</code> in the repository root, then retry.
        </p>
        <button type="button" className={styles.button} onClick={load}>
          Retry
        </button>
      </div>
    );
  }

  if (!data) {
    return (
      <div className={styles.centre}>
        <p className={styles.body}>Loading…</p>
      </div>
    );
  }

  // First run: the pipeline has never completed, so there is nothing to show yet.
  if (!data.status.lastRunAt && data.summaries.length === 0 && data.events.length === 0) {
    return (
      <div className={styles.centre}>
        <h1 className={styles.title}>No summaries yet</h1>
        <p className={styles.body}>
          Nothing has been through the pipeline. Run <code>npm run digest</code> to fetch
          mail, triage it, and detect events.
        </p>
        <p className={styles.body}>
          This page does not update on its own — reload after a run.
        </p>
        <button type="button" className={styles.button} onClick={load}>
          Reload
        </button>
      </div>
    );
  }

  return (
    <TriageStream
      initialEvents={data.events}
      summaries={data.summaries}
      summaryTotal={data.summaryTotal}
      calendars={data.calendars}
      lastSyncedAt={data.status.lastRunAt ?? new Date().toISOString()}
      scopeMissing={data.status.scopeMissing}
      accounts={data.status.accounts}
      onReload={load}
    />
  );
}
