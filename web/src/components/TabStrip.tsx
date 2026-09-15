import type { Tab } from "../types";
import styles from "./TabStrip.module.css";

interface TabStripProps {
  active: Tab;
  needsReviewCount: number;
  summariesCount: number;
  ignoredCount: number;
  onChange: (tab: Tab) => void;
}

export function TabStrip({
  active,
  needsReviewCount,
  summariesCount,
  ignoredCount,
  onChange,
}: TabStripProps) {
  const tabs: { id: Tab; label: string; count: number; pill: boolean }[] = [
    { id: "needs-review", label: "Needs review", count: needsReviewCount, pill: true },
    { id: "summaries", label: "Summaries", count: summariesCount, pill: false },
    { id: "ignored", label: "Ignored", count: ignoredCount, pill: false },
  ];

  return (
    <nav className={styles.strip}>
      {tabs.map((tab) => {
        const isActive = tab.id === active;
        return (
          <button
            key={tab.id}
            type="button"
            className={`${styles.tab} ${isActive ? styles.tabActive : ""}`}
            onClick={() => onChange(tab.id)}
            aria-current={isActive ? "page" : undefined}
          >
            {tab.label}
            {/* The amber pill is for a queue that actually needs attention. */}
            <span
              className={`${styles.count} ${
                tab.pill && isActive && tab.count > 0 ? styles.countPill : ""
              }`}
            >
              {tab.count}
            </span>
          </button>
        );
      })}
    </nav>
  );
}
