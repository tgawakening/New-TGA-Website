import Image from "next/image";
import Link from "next/link";
import styles from "./sirah-promotion.module.css";

export function PropheticStrategiesSlider() {
  return (
    <section className={styles.promotion} aria-labelledby="home-sirah-title">
      <Image
        src="/Seerah new/hero banner home.png"
        alt="A learner approaching an ancient stone doorway at sunset"
        fill
        sizes="100vw"
        className={styles.artwork}
      />
      <div className={styles.content}>
        <p className={styles.eyebrow}>
          The Global Awakening · Live online course
        </p>
        <h2 id="home-sirah-title">
          SĪRAH <span>| BEYOND CHRONOLOGY</span>
        </h2>
        <p className={styles.subtitle}>Law, Power, Leadership &amp; Movement</p>
        <p>
          Examine the sources. Understand the decisions. Reflect on your
          responsibilities.
        </p>
        <p className={styles.essentials}>
          12-month programme · Live teaching and Q&amp;A
        </p>
        <Link href="/seerah">
          Explore the Course <span aria-hidden>↗</span>
        </Link>
      </div>
      <div className={styles.mobileArtwork}>
        <Image
          src="/Seerah new/hero banner home.png"
          alt=""
          fill
          sizes="100vw"
        />
      </div>
    </section>
  );
}
