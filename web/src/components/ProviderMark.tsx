import type { MailProvider } from "../types";
import styles from "./ProviderMark.module.css";

interface ProviderMarkProps {
  provider: MailProvider;
  /** 18px on event cards, 20px in the summary table. */
  size?: number;
}

export function ProviderMark({ provider, size = 18 }: ProviderMarkProps) {
  const isGmail = provider === "gmail";
  return (
    <span
      className={`${styles.mark} ${isGmail ? styles.gmail : styles.outlook}`}
      style={{ width: size, height: size, fontSize: size >= 20 ? 10 : 9.5 }}
      aria-label={isGmail ? "Gmail" : "Outlook"}
    >
      {isGmail ? "G" : "O"}
    </span>
  );
}
