import type { Summary } from "../../types";
import { formatTime } from "../../lib/format";
import { ProviderMark } from "../ProviderMark";
import styles from "./SummaryCards.module.css";

interface SummaryCardsProps {
  summaries: Summary[];
}

export function SummaryCards({ summaries }: SummaryCardsProps) {
  return (
    <div className={styles.list}>
      {summaries.map((summary) => (
        <article className={styles.card} key={summary.id}>
          <div className={styles.head}>
            <span className={styles.sender}>
              <ProviderMark provider={summary.source} />
              <span className={styles.senderName}>{summary.senderName}</span>
            </span>
            <span className={styles.time}>{formatTime(summary.receivedAt)}</span>
          </div>
          <div className={styles.subject}>{summary.subject}</div>
          {/* Summary text only — the original message no longer exists (ADR-0002). */}
          <div className={styles.text}>{summary.summaryText}</div>
        </article>
      ))}
      <div className={styles.privacyNote}>
        <span aria-hidden="true">⌾</span>
        Summaries only — original messages are never stored.
      </div>
    </div>
  );
}
