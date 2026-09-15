import styles from "./MobileTopBar.module.css";

interface MobileTopBarProps {
  /** Short form for the narrow header, e.g. "Synced 2m ago". */
  syncLabel: string;
  refreshing: boolean;
  onRefresh: () => void;
}

export function MobileTopBar({ syncLabel, refreshing, onRefresh }: MobileTopBarProps) {
  return (
    <header className={styles.bar}>
      <span className={styles.wordmark}>Sift</span>
      <span className={styles.right}>
        {syncLabel}
        <button
          type="button"
          className={styles.refresh}
          onClick={onRefresh}
          disabled={refreshing}
          aria-label="Refresh"
        >
          <span aria-hidden="true">{refreshing ? "◌" : "↻"}</span>
        </button>
      </span>
    </header>
  );
}
