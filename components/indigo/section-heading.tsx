import type { ReactNode } from "react";
import { Star8 } from "./ornaments";
import styles from "./section-heading.module.css";

type Props = {
  eyebrow?: string;
  title: ReactNode;
  id?: string;
  /** h2 for page sections; h3 inside a section. */
  level?: 2 | 3;
  /** Trailing hairline rule (section heads). Off for stacked hero-style heads. */
  rule?: boolean;
  lede?: ReactNode;
  className?: string;
};

export function Eyebrow({ children, star = false }: { children: ReactNode; star?: boolean }) {
  return (
    <span className={styles.eyebrow}>
      {star ? <Star8 className={styles.star} /> : null}
      {children}
    </span>
  );
}

export function SectionHeading({ eyebrow, title, id, level = 2, rule = true, lede, className }: Props) {
  const H = level === 2 ? "h2" : "h3";
  return (
    <div className={[styles.head, className ?? ""].join(" ")}>
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
