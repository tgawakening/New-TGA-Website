import type { ElementType, ReactNode } from "react";
import styles from "./card.module.css";

type Props = {
  /** surface: plain tile. feature: the larger gradient panel (flagship, CTA). */
  variant?: "surface" | "feature";
  /** Lift and coloured edge on hover/focus. */
  interactive?: boolean;
  /** Edge colour for interactive cards: teal (default) or gold (rare). */
  edge?: "teal" | "gold";
  /** Teal-to-terracotta hairline across the top edge. */
  accentEdge?: boolean;
  as?: ElementType;
  className?: string;
  children: ReactNode;
} & Record<string, unknown>;

export function Card({
  variant = "surface",
  interactive = false,
  edge = "teal",
  accentEdge = false,
  as: Tag = "div",
  className,
  children,
  ...rest
}: Props) {
  const cls = [
    styles.card,
    styles[variant],
    interactive ? styles.interactive : "",
    interactive && edge === "gold" ? styles.gold : "",
    accentEdge ? styles.accentEdge : "",
    className ?? "",
  ]
    .filter(Boolean)
    .join(" ");
  return (
    <Tag className={cls} {...rest}>
      {children}
    </Tag>
  );
}
