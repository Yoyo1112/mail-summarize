import styles from "./TopBar.module.css";

interface TopBarProps {
  /** e.g. "Synced 2 min ago · next run 19:00" */
  syncLine: string;
  refreshing: boolean;
  onRefresh: () => void;
}

export function TopBar({ syncLine, refreshing, onRefresh }: TopBarProps) {
  return (
    <header className={styles.bar}>
      <div className={styles.brand}>
        <span className={styles.wordmark}>Sift</span>
        <span className={styles.tagline}>mail → calendar</span>
      </div>
      <div className={styles.right}>
        <span className={styles.syncLine}>{syncLine}</span>
        <button
          type="button"
          className={styles.refresh}
          onClick={onRefresh}
          disabled={refreshing}
        >
          <span className={styles.glyph} aria-hidden="true">
            {refreshing ? "◌" : "↻"}
          </span>
          Refresh
        </button>
      </div>
    </header>
  );
}
