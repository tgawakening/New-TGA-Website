import type { ElementType, ReactNode } from "react";
import styles from "./card.module.css";

type Props = {
  /** surface: plain tile. feature: the larger gradient panel (flagship, CTA). */
  variant?: "surface" | "feature";
  /** Lift and teal border on hover. Use only when the whole card is a link target. */
  interactive?: boolean;
  /** Teal-to-terracotta hairline across the top edge. */
  accentEdge?: boolean;
  as?: ElementType;
  className?: string;
  children: ReactNode;
} & Record<string, unknown>;

export function Card({
  variant = "surface",
  interactive = false,
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
