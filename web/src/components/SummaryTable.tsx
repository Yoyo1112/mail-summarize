import type { Summary } from "../types";
import { formatRelativeDay, formatTime } from "../lib/format";
import { ProviderMark } from "./ProviderMark";
import styles from "./SummaryTable.module.css";

interface SummaryTableProps {
  summaries: Summary[];
}

export function SummaryTable({ summaries }: SummaryTableProps) {
  return (
    <div className={styles.table}>
      {summaries.map((summary) => (
        <div className={styles.row} key={summary.id}>
          <ProviderMark provider={summary.source} size={20} />
          <div>
            <div className={styles.sender}>{summary.senderName}</div>
            <div className={styles.senderEmail}>{summary.senderEmail}</div>
          </div>
          <div>
            <div className={styles.subject}>{summary.subject}</div>
            {/* Summary text only — the original message no longer exists (ADR-0002). */}
            <div className={styles.summaryText}>{summary.summaryText}</div>
          </div>
          <div className={styles.received}>
            <div className={styles.receivedLine}>{formatRelativeDay(summary.receivedAt)}</div>
            <div className={styles.receivedLine}>{formatTime(summary.receivedAt)}</div>
          </div>
        </div>
      ))}
    </div>
  );
}
