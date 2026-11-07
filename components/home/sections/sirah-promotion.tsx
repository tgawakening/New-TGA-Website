import Image, { getImageProps } from "next/image";
import Link from "next/link";
import { courseConfig } from "@/components/seerah/course-config";
import styles from "./sirah-promotion.module.css";

export function SirahPromotion() {
  const { hero, heroMobile } = courseConfig;
  const { props: mobileImage } = getImageProps({
    src: heroMobile.src,
    alt: "",
    width: heroMobile.width,
    height: heroMobile.height,
    sizes: "100vw",
  });

  return (
    <section className={styles.promotion} aria-labelledby="home-sirah-title">
      {hero && (
        <picture className={styles.artwork}>
          <source
            media="(max-width: 767px)"
            srcSet={mobileImage.srcSet}
            sizes="100vw"
          />
          <Image
            src={hero.src}
            alt=""
            fill
            sizes="100vw"
            className={styles.image}
          />
        </picture>
      )}
      <div className={styles.content}>
        <div className={styles.copy}>
          <p className={styles.eyebrow}>Featured live online course</p>
          <h2 id="home-sirah-title" aria-label="Sīrah | Beyond Chronology">
            Beyond Chronology
          </h2>
          <p>
            Study how the Prophet ﷺ made decisions, built a community, and led
            through changing circumstances.
          </p>
          <ul className={styles.essentials} aria-label="Course format">
            {courseConfig.essentials.map((detail) => (
              <li key={detail}>{detail}</li>
            ))}
          </ul>
          <Link href="/seerah">
            Explore the Sīrah Course <span aria-hidden="true">↗</span>
          </Link>
        </div>
      </div>
    </section>
  );
}
