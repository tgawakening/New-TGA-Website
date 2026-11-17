/* The TGA logo, pre-sized. public/logo.webp is 640×246 (31 KB) but every
 * header and footer shows it at 110–182 px, and the image optimiser is not
 * guaranteed to resize it on every host. These static exports (public/brand,
 * made from logo.webp) let the browser pick the smallest file that is sharp
 * at its own pixel density: about 5–15 KB instead of 31 KB. Plain <img>, no
 * client JavaScript. */

const SET = "/brand/logo-160.webp 160w, /brand/logo-240.webp 240w, /brand/logo-360.webp 360w, /brand/logo-480.webp 480w, /logo.webp 640w";

type Props = {
  /** Display width(s), as for `sizes`, e.g. "(min-width: 64rem) 160px, 112px". */
  sizes: string;
  alt: string;
  className?: string;
  /** Above the fold (headers): fetch early, never lazy. */
  priority?: boolean;
};

export function BrandLogo({ sizes, alt, className, priority = false }: Props) {
  return (
    // eslint-disable-next-line @next/next/no-img-element -- static pre-sized srcset; the optimiser is not needed
    <img
      src="/brand/logo-240.webp"
      srcSet={SET}
      sizes={sizes}
      width={640}
      height={246}
      alt={alt}
      className={className}
      decoding="async"
      loading={priority ? "eager" : "lazy"}
      fetchPriority={priority ? "high" : "auto"}
    />
  );
}
