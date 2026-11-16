import type { ReactNode } from "react";
import { SealMark } from "./ornaments";
import styles from "./section-heading.module.css";

type Props = {
  eyebrow?: string;
  title: ReactNode;
  id?: string;
  /** h2 for page sections; h3 inside a section. */
  level?: 2 | 3;
  /** Trailing hairline rule (section heads). */
  rule?: boolean;
  lede?: ReactNode;
  className?: string;
};

/** Letter-spaced label led by the section marker (a small rub el hizb that
 * turns into place when its section is revealed). */
export function Eyebrow({ children, marker = true }: { children: ReactNode; marker?: boolean }) {
  return (
    <span className={styles.eyebrow}>
      {marker ? (
        <span className={styles.markerWrap} data-marker="">
          <SealMark className={styles.marker} />
        </span>
      ) : null}
      {children}
    </span>
  );
}

export function SectionHeading({ eyebrow, title, id, level = 2, rule = true, lede, className }: Props) {
  const H = level === 2 ? "h2" : "h3";
  return (
    <div className={[styles.head, className ?? ""].join(" ")} data-reveal="">
      <div className={styles.row}>
        <div className={styles.titles}>
          {eyebrow ? <Eyebrow>{eyebrow}</Eyebrow> : null}
          <H id={id} className={styles.title}>
            {title}
          </H>
        </div>
        {rule ? <span className={styles.rule} aria-hidden="true" /> : null}
      </div>
      {lede ? <p className={styles.lede}>{lede}</p> : null}
    </div>
  );
}
