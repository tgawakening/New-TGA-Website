import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";
import { ArrowRight } from "./ornaments";
import styles from "./button.module.css";

type Variant = "teal" | "ghost" | "soft";

type Common = {
  variant?: Variant;
  /** Show a trailing arrow (for links that move you forward). */
  arrow?: boolean;
  /** Stretch to the container width (cards, phone layouts). */
  block?: boolean;
  className?: string;
  children: ReactNode;
};

type LinkButton = Common & { href: string } & Omit<ComponentProps<typeof Link>, "href" | "className" | "children">;
type NativeButton = Common & { href?: undefined } & Omit<ComponentProps<"button">, "className" | "children">;

export function Button(props: LinkButton | NativeButton) {
  const { variant = "teal", arrow = false, block = false, className, children, ...rest } = props;
  const cls = [styles.btn, styles[variant], block ? styles.block : "", className ?? ""].filter(Boolean).join(" ");
  const content = (
    <>
      <span>{children}</span>
      {arrow ? <ArrowRight className={styles.arrow} /> : null}
    </>
  );

  if ("href" in rest && typeof rest.href === "string") {
    const { href, ...linkRest } = rest as LinkButton;
    const external = /^https?:\/\//.test(href);
    return external ? (
      <a href={href} className={cls} target="_blank" rel="noreferrer">
        {content}
      </a>
    ) : (
      <Link href={href} className={cls} {...linkRest}>
        {content}
      </Link>
    );
  }

  const { type = "button", ...buttonRest } = rest as NativeButton;
  return (
    <button type={type} className={cls} {...buttonRest}>
      {content}
    </button>
  );
}
