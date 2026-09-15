import type { ConnectedAccount } from "../lib/api";
import styles from "./ScopeBanner.module.css";

interface ScopeBannerProps {
  accounts: ConnectedAccount[];
}

/**
 * Option 1f state 3. Shown above the queue while the connected tokens hold read-only
 * mail scopes: every Confirmation would fail, so the confirm controls are disabled
 * and this says why.
 */
export function ScopeBanner({ accounts }: ScopeBannerProps) {
  return (
    <section className={styles.panel} role="status">
      <div className={styles.label}>Re-authorisation required</div>
      <p className={styles.body}>
        Sift can read your mail but cannot write events yet. Google and Outlook were
        connected with read-only mail access, so calendar write permission has to be
        granted once per account.
      </p>

      <div className={styles.accounts}>
        {accounts.map((account) => (
          <div className={styles.account} key={account.provider}>
            <span
              className={`${styles.dot} ${
                account.provider === "gmail" ? styles.gmailDot : styles.outlookDot
              }`}
            />
            <span className={styles.accountName}>
              {account.provider === "gmail" ? "Google" : "Outlook"}
              {account.accountEmail ? ` · ${account.accountEmail}` : ""}
            </span>
            <span className={styles.scope}>{account.currentScope}</span>
          </div>
        ))}
      </div>

      <div className={styles.how}>
        Add the calendar scopes, then re-consent from the terminal:
        <code className={styles.command}>npm run auth:gmail{"\n"}npm run auth:outlook</code>
      </div>
    </section>
  );
}
