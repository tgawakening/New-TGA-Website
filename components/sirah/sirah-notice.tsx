import { SirahNoticeBanner } from "./sirah-notice-banner";
import styles from "./sirah-notice.module.css";

/** Site notice from the SIRAH_NOTICE env var. Read on the server at request
 * time; renders nothing when the var is unset or blank. `page` wraps it in the
 * public site container (login); the default sits inside the admin container. */
export function SirahNotice({ placement = "inline" }: { placement?: "inline" | "page" }) {
  const text = process.env.SIRAH_NOTICE?.trim();
  if (!text) return null;
  const banner = <SirahNoticeBanner text={text} />;
  return placement === "page" ? <div className={`ga-container ${styles.pageTop}`}>{banner}</div> : banner;
}
