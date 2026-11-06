"use client";

import Image from "next/image";
import Link from "next/link";
import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import { Header, Footer } from "@/components/home/sections";
import {
  activeCampaign,
  approach,
  courseConfig as config,
  learningOutcomes,
  topics,
  type CourseVideo,
  type FeePlan,
} from "./course-config";
import { trackSeerah } from "./analytics";
import { formatFee } from "./regional-fees";
import styles from "./seerah.module.css";

const sectionLinks = [
  ["overview", "Overview"],
  ["topics", "Topics"],
  ["course-details", "Course Details"],
  ["fees", "Fees"],
  ["faqs", "FAQs"],
];

const CampaignContext = createContext(true);

function PrimaryAction({ placement }: { placement: string }) {
  const orientation = useContext(CampaignContext);
  const href = orientation
    ? config.campaign.whatsappUrl
    : config.campaign.enrolmentUrl;
  if (!href)
    return (
      <a className={styles.primary} href="#fees">
        Explore Enrolment Options <span aria-hidden>↗</span>
      </a>
    );
  return (
    <a
      className={styles.primary}
      href={href}
      target={orientation ? "_blank" : undefined}
      rel={orientation ? "noopener noreferrer" : undefined}
      onClick={() =>
        trackSeerah(
          orientation ? "seerah_whatsapp_click" : "seerah_checkout_start",
          { placement },
        )
      }
    >
      {orientation ? "Join the Free Orientation" : "Enrol in the Course"}
      <span aria-hidden>↗</span>
    </a>
  );
}

function PreviewVideo({ video }: { video: CourseVideo }) {
  const [playing, setPlaying] = useState(false);
  return (
    <figure className={styles.video}>
      <div style={{ aspectRatio: `${video.width} / ${video.height}` }}>
        {playing ? (
          <video
            controls
            autoPlay
            playsInline
            preload="metadata"
            width={video.width}
            height={video.height}
            poster={video.poster.src}
          >
            <source src={video.src} type="video/mp4" />
            <track
              kind="captions"
              src={video.captions}
              srcLang="en"
              label="English"
              default
            />
            Your browser does not support video.{" "}
            <a href={video.src}>Download the preview</a>.
          </video>
        ) : (
          <button
            type="button"
            onClick={() => setPlaying(true)}
            aria-label={`Play ${video.title}`}
          >
            <Image
              src={video.poster.src}
              alt={video.poster.alt}
              fill
              sizes="(max-width: 760px) 100vw, 50vw"
            />
            <span className={styles.play} aria-hidden>
              ▶
            </span>
            <span className={styles.videoLabel}>Watch the preview</span>
          </button>
        )}
      </div>
      <figcaption>{video.title}</figcaption>
    </figure>
  );
}

function TopicGallery() {
  const gallery = useRef<HTMLDivElement>(null);
  const [current, setCurrent] = useState(0);
  const [atEnd, setAtEnd] = useState(false);
  const [expanded, setExpanded] = useState<number | null>(null);
  function move(direction: number) {
    const container = gallery.current;
    if (!container) return;
    const cards = container.querySelectorAll<HTMLElement>("article");
    const next = Math.max(0, Math.min(topics.length - 1, current + direction));
    const reduced = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    container.scrollTo({
      left: cards[next].offsetLeft - cards[0].offsetLeft,
      behavior: reduced ? "instant" : "smooth",
    });
  }
  return (
    <>
      <div className={styles.galleryHeading}>
        <div>
          <p className={styles.eyebrow}>03 / Questions you’ll study</p>
          <h2 id="topics-heading">
            Begin with a question.
            <br />
            <em>Go deeper into the sources.</em>
          </h2>
        </div>
        <div className={styles.galleryControls}>
          <span aria-live="polite" aria-atomic="true">
            {String(current + 1).padStart(2, "0")} /{" "}
            {String(topics.length).padStart(2, "0")}
          </span>
          <button
            type="button"
            aria-label="Previous topic"
            aria-controls="topic-gallery"
            disabled={current === 0}
            onClick={() => move(-1)}
          >
            ←
          </button>
          <button
            type="button"
            aria-label="Next topic"
            aria-controls="topic-gallery"
            disabled={atEnd}
            onClick={() => move(1)}
          >
            →
          </button>
        </div>
      </div>
      <p className={styles.sectionIntro}>
        Explore decisions, relationships and responsibilities. Each topic is an
        invitation to examine the evidence.
      </p>
      <div
        id="topic-gallery"
        ref={gallery}
        className={styles.gallery}
        role="region"
        aria-label="Course topic gallery"
        tabIndex={0}
        onKeyDown={(event) => {
          if (event.target !== event.currentTarget) return;
          if (event.key === "ArrowRight" || event.key === "ArrowLeft") {
            event.preventDefault();
            move(event.key === "ArrowRight" ? 1 : -1);
          }
        }}
        onScroll={() => {
          const container = gallery.current;
          if (!container) return;
          const cards = Array.from(
            container.querySelectorAll<HTMLElement>("article"),
          );
          const nearest = cards.reduce(
            (best, card, i) =>
              Math.abs(
                card.offsetLeft - cards[0].offsetLeft - container.scrollLeft,
              ) <
              Math.abs(
                cards[best].offsetLeft -
                  cards[0].offsetLeft -
                  container.scrollLeft,
              )
                ? i
                : best,
            0,
          );
          setCurrent(nearest);
          setAtEnd(
            container.scrollLeft + container.clientWidth >=
              container.scrollWidth - 4,
          );
        }}
      >
        {topics.map((topic, i) => (
          <article
            key={topic.title}
            className={styles.topic}
            aria-label={`Topic ${i + 1} of ${topics.length}`}
          >
            <div
              className={`${styles.topicArt} ${topic.artwork?.clean ? styles.cleanArt : ""}`}
            >
              {topic.artwork ? (
                <Image
                  src={topic.artwork.src}
                  alt={topic.artwork.alt}
                  width={topic.artwork.width}
                  height={topic.artwork.height}
                  sizes="(max-width: 760px) 85vw, 33vw"
                />
              ) : (
                <div className={styles.topicType} aria-hidden="true">
                  <span>SĪRAH / BEYOND CHRONOLOGY</span>
                  <strong>{String(i + 1).padStart(2, "0")}</strong>
                  <span>LAW · POWER · LEADERSHIP · MOVEMENT</span>
                </div>
              )}
            </div>
            <div className={styles.topicBody}>
              <p className={styles.topicTheme}>{topic.theme}</p>
              <h3>{topic.title}</h3>
              <p className={styles.question}>{topic.question}</p>
              <p>{topic.focus}</p>
              <button
                className={styles.readMore}
                type="button"
                aria-expanded={expanded === i}
                aria-controls={`topic-detail-${i}`}
                onClick={() => setExpanded(expanded === i ? null : i)}
              >
                {expanded === i ? "Read less −" : "Read more +"}
                <span className={styles.srOnly}> about {topic.title}</span>
              </button>
            </div>
          </article>
        ))}
      </div>
      {topics.map((topic, i) => (
        <div
          key={topic.title}
          id={`topic-detail-${i}`}
          hidden={expanded !== i}
          className={styles.topicDetail}
        >
          <p className={styles.eyebrow}>A closer look</p>
          <h3>{topic.title}</h3>
          <p>{topic.detail}</p>
          <button
            type="button"
            className={styles.readMore}
            onClick={() => {
              setExpanded(null);
              gallery.current
                ?.querySelectorAll<HTMLButtonElement>("article button")
                [i]?.focus();
            }}
          >
            Close detail −
          </button>
        </div>
      ))}
    </>
  );
}

function Plan({
  plan,
  annual,
  country,
}: {
  plan: FeePlan | null;
  annual: boolean;
  country: string;
}) {
  const available = Boolean(
    plan?.checkoutUrl && config.markets.find((m) => m.code === country)?.terms,
  );
  return (
    <article className={`${styles.plan} ${annual ? styles.annual : ""}`}>
      <p className={styles.eyebrow}>
        {annual ? "Annual upfront" : "Monthly plan"}
      </p>
      {plan ? (
        <>
          <h3>
            {formatFee(plan.amount, plan.currency)}
            <small>{plan.frequency}</small>
          </h3>
          <p>{plan.method}</p>
          <p>{plan.total}</p>
        </>
      ) : (
        <>
          <h3>To be confirmed</h3>
          <p>
            Approved {annual ? "annual" : "monthly"} fees will be published
            here.
          </p>
        </>
      )}
      {annual && <p className={styles.planNote}>One payment for 12 months.</p>}
      {available && plan?.checkoutUrl ? (
        <a
          href={plan.checkoutUrl}
          className={styles.primary}
          onClick={() =>
            trackSeerah("seerah_checkout_start", {
              country,
              plan: annual ? "annual" : "monthly",
            })
          }
        >
          Choose {annual ? "Annual" : "Monthly"} <span aria-hidden>↗</span>
        </a>
      ) : (
        <button className={styles.disabledAction} type="button" disabled>
          Enrolment not yet available
        </button>
      )}
    </article>
  );
}

function detectMarket() {
  const region = new Intl.Locale(navigator.language).region;
  if (region && config.markets.some((m) => m.code === region)) return region;
  const eurozone = new Set([
    "AT",
    "BE",
    "BG",
    "CY",
    "DE",
    "EE",
    "ES",
    "FI",
    "FR",
    "GR",
    "HR",
    "IE",
    "IT",
    "LT",
    "LU",
    "LV",
    "MT",
    "NL",
    "PT",
    "SI",
    "SK",
  ]);
  return region && eurozone.has(region) ? "EURO" : "PK";
}
function subscribeLocaleChange(callback: () => void) {
  window.addEventListener("languagechange", callback);
  return () => window.removeEventListener("languagechange", callback);
}
function Fees() {
  const [chosenCountry, setCountry] = useState<string | null>(null);
  const suggestedCountry = useSyncExternalStore(
    subscribeLocaleChange,
    detectMarket,
    () => "PK",
  );
  const country = chosenCountry || suggestedCountry;
  const market = config.markets.find((m) => m.code === country)!;
  const monthly =
    market.code === "PK" && !market.onlineRecurringVerified
      ? market.manualMonthly || null
      : market.monthly;
  function select(value: string) {
    setCountry(value);
    trackSeerah("seerah_country_select", { country: value });
  }
  return (
    <section
      id="fees"
      className={`${styles.section} ${styles.ivory}`}
      aria-labelledby="fees-heading"
    >
      <div className={styles.container}>
        <div className={styles.sectionHeading}>
          <div>
            <p className={styles.eyebrow}>05 / Regional fees</p>
            <h2 id="fees-heading">
              Choose your way
              <br />
              <em>to begin.</em>
            </h2>
          </div>
          <p>
            Choose your country to see the fee in your currency. Study through
            live teaching, discussion and Q&A across a 12-month programme. Pay
            monthly or make one annual payment.
          </p>
        </div>
        <div
          className={styles.countries}
          role="group"
          aria-label="Popular countries"
        >
          {config.markets.slice(0, 5).map((m) => (
            <button
              type="button"
              key={m.code}
              aria-pressed={m.code === country}
              onClick={() => select(m.code)}
            >
              {m.name}
            </button>
          ))}
        </div>
        <label className={styles.countrySelect}>
          Your country
          <select value={country} onChange={(e) => select(e.target.value)}>
            {config.markets.map((m) => (
              <option value={m.code} key={m.code}>
                {m.name}
              </option>
            ))}
          </select>
        </label>
        <div aria-live="polite" aria-atomic="true">
          <h3 className={styles.marketTitle}>{market.name}</h3>
          <div className={styles.plans}>
            <Plan plan={monthly} annual={false} country={country} />
            <Plan plan={market.annual} annual country={country} />
          </div>
          {market.code === "PK" &&
            market.onlineRecurringVerified &&
            market.manualMonthly && (
              <>
                <h3 className={styles.marketTitle}>Manual monthly payment</h3>
                <div className={styles.plans}>
                  <Plan
                    plan={market.manualMonthly}
                    annual={false}
                    country={country}
                  />
                </div>
              </>
            )}
          {market.code === "PK" && !market.onlineRecurringVerified && (
            <p className={styles.paymentNotice}>
              The manual monthly rate is shown. Online recurring payment
              availability is being confirmed.
            </p>
          )}
          {market.code === "OTHER" && (
            <p className={styles.paymentNotice}>
              You will be billed in GBP. Any conversion by your bank may vary;
              no fixed local-currency amount is offered.
            </p>
          )}
          {!market.terms && (
            <p className={styles.paymentNotice}>
              Enrolment is not yet open. Final cancellation, refund and access
              terms, payment availability and tax treatment will be shown here
              before payments are accepted.
            </p>
          )}
          {market.terms && <p className={styles.terms}>{market.terms}</p>}
        </div>
        <div className={styles.feeFoot}>
          <p>
            Read the <Link href="/policies/refund-policy">refund policy</Link>{" "}
            and <Link href="/policies/terms-and-conditions">access terms</Link>{" "}
            before choosing a plan.
          </p>
          <a href={config.feeSupportUrl}>Request confidential fee support ↗</a>
        </div>
      </div>
    </section>
  );
}

export default function SeerahPage({
  initialCampaign,
}: {
  initialCampaign: "orientation" | "enrolment";
}) {
  const [orientation, setOrientation] = useState(
    initialCampaign === "orientation",
  );
  useEffect(() => {
    const update = () => setOrientation(activeCampaign() === "orientation");
    update();
    const timer = window.setInterval(update, 30000);
    return () => window.clearInterval(timer);
  }, []);
  return (
    <CampaignContext.Provider value={orientation}>
      <div className={styles.page}>
        <a className={styles.skip} href="#overview">
          Skip to course content
        </a>
        <Header />
        <nav className={styles.sectionNav} aria-label="Course sections">
          <div className={styles.container}>
            <a className={styles.navBrand} href="#overview">
              SĪRAH <span>/ BEYOND CHRONOLOGY</span>
            </a>
            <div>
              {sectionLinks.map(([id, label]) => (
                <a href={`#${id}`} key={id}>
                  {label}
                </a>
              ))}
            </div>
          </div>
        </nav>
        <main>
          <section
            id="overview"
            className={styles.hero}
            aria-labelledby="course-title"
          >
            {config.hero && (
              <Image
                className={styles.heroImage}
                src={config.hero.src}
                alt={config.hero.alt}
                fill
                priority
                sizes="100vw"
              />
            )}
            <div className={styles.heroShade} />
            <div className={`${styles.container} ${styles.heroInner}`}>
              <div className={styles.heroCopy}>
                <p className={styles.eyebrow}>The Global Awakening</p>
                <p className={styles.heroOverline}>
                  A life to study. A responsibility to carry.
                </p>
                <h1 id="course-title">
                  <span>SĪRAH</span>
                  <span className={styles.heroSubtitle}>
                    <span aria-hidden>| </span>BEYOND
                    <br />
                    CHRONOLOGY
                  </span>
                </h1>
                <p className={styles.tagline}>
                  Law, Power, Leadership &amp; Movement
                </p>
                <p className={styles.heroIntro}>
                  Study the life of the Prophet ﷺ through the decisions he made
                  and the community he built. Examine classical sources, explore
                  difficult questions and connect your learning with
                  responsibilities in your own life.
                </p>
                <div className={styles.heroActions}>
                  <PrimaryAction placement="hero" />
                  <a className={styles.secondary} href="#course-details">
                    Explore the Course <span aria-hidden>↓</span>
                  </a>
                </div>
                {orientation && (
                  <p className={styles.supporting}>
                    Join the WhatsApp group for orientation details.
                  </p>
                )}
                {config.essentials.length > 0 && (
                  <ul className={styles.essentials}>
                    {config.essentials.map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
            {config.hero && (
              <div className={styles.mobileArtwork}>
                <Image
                  src={config.hero.src}
                  alt={config.hero.alt}
                  fill
                  priority
                  sizes="100vw"
                />
              </div>
            )}
          </section>
          {orientation && (
            <aside
              className={styles.orientation}
              aria-label="Free orientation schedule"
            >
              <div className={styles.container}>
                <div>
                  <p className={styles.eyebrow}>Your first step</p>
                  <strong>Free Orientation</strong>
                </div>
                <p>
                  <strong>{config.orientation.date}</strong>
                  <span>
                    {config.orientation.duration} · Separate from the weekly
                    class schedule
                  </span>
                </p>
                <div className={styles.times}>
                  {config.orientation.times.map((slot) => (
                    <p key={slot.region}>
                      <strong>{slot.time}</strong>
                      <span>{slot.region}</span>
                    </p>
                  ))}
                </div>
              </div>
            </aside>
          )}
          <section
            className={`${styles.section} ${styles.ivory}`}
            aria-labelledby="benefit-heading"
          >
            <div className={styles.container}>
              <div className={styles.benefitGrid}>
                <div>
                  {config.videos.length ? (
                    config.videos.map((video) => (
                      <PreviewVideo key={video.src} video={video} />
                    ))
                  ) : (
                    <div className={styles.previewPending}>
                      <span className={styles.previewMark} aria-hidden>
                        سيرة
                      </span>
                      <p className={styles.eyebrow}>
                        Sīrah | Beyond Chronology
                      </p>
                      <h3>
                        From the account
                        <br />
                        to the understanding.
                      </h3>
                      <p>The new course preview will be available here.</p>
                    </div>
                  )}
                </div>
                <div>
                  <p className={styles.eyebrow}>02 / The learning</p>
                  <h2 id="benefit-heading">
                    More than a sequence
                    <br />
                    <em>of events.</em>
                  </h2>
                  <p className={styles.lead}>
                    Look closely at the decisions. Understand the setting.
                    Consider the responsibilities.
                  </p>
                  <p>
                    This course connects source examination with questions of
                    law, power, leadership and movement. Explore what the
                    evidence tells us and where careful interpretation begins.
                  </p>
                </div>
              </div>
              <div className={styles.outcomes}>
                {learningOutcomes.map((outcome, i) => (
                  <article key={outcome.title}>
                    <span className={styles.outcomeNumber}>0{i + 1}</span>
                    <h3>{outcome.title}</h3>
                    <p>{outcome.text}</p>
                  </article>
                ))}
              </div>
            </div>
          </section>
          <section
            id="topics"
            className={`${styles.section} ${styles.dark}`}
            aria-labelledby="topics-heading"
          >
            <div className={styles.container}>
              <TopicGallery />
            </div>
          </section>
          <section
            id="course-details"
            className={`${styles.section} ${styles.ivory}`}
            aria-labelledby="details-heading"
          >
            <div className={styles.container}>
              <div className={styles.sectionHeading}>
                <div>
                  <p className={styles.eyebrow}>04 / Course details</p>
                  <h2 id="details-heading">
                    A considered way
                    <br />
                    <em>to study the Sīrah.</em>
                  </h2>
                </div>
                <p>
                  Move from the report to its setting, from interpretation to
                  conclusions. Keep the evidence and its limits in view.
                </p>
              </div>
              <ol className={styles.approach}>
                {approach.map((step, i) => (
                  <li key={step}>
                    <span>0{i + 1}</span>
                    {step}
                  </li>
                ))}
              </ol>
              {config.curriculum.length > 0 && (
                <div className={styles.curriculum}>
                  <h3>The curriculum</h3>
                  {config.curriculum.map((panel, i) => (
                    <details key={panel.title} open={i === 0}>
                      <summary>{panel.title}</summary>
                      <ul>
                        {panel.topics.map((item) => (
                          <li key={item}>{item}</li>
                        ))}
                      </ul>
                    </details>
                  ))}
                </div>
              )}
              {config.instructor && (
                <article className={styles.instructor}>
                  <Image
                    src={config.instructor.portrait.src}
                    alt={config.instructor.portrait.alt}
                    width={config.instructor.portrait.width}
                    height={config.instructor.portrait.height}
                  />
                  <div>
                    <p className={styles.eyebrow}>Your instructor</p>
                    <h3>{config.instructor.name}</h3>
                    <p>{config.instructor.bio}</p>
                  </div>
                </article>
              )}
              {config.features.length > 0 && (
                <ul className={styles.essentials}>
                  {config.features.map((feature) => (
                    <li key={feature}>{feature}</li>
                  ))}
                </ul>
              )}
            </div>
          </section>
          <Fees />
          <section
            id="faqs"
            className={`${styles.section} ${styles.dark}`}
            aria-labelledby="faq-heading"
          >
            <div className={styles.container}>
              <div className={styles.faqGrid}>
                <div>
                  <p className={styles.eyebrow}>06 / Before you begin</p>
                  <h2 id="faq-heading">
                    A few things
                    <br />
                    <em>you may be wondering.</em>
                  </h2>
                  <p>
                    Have another question?
                    <br />
                    <a href="mailto:admin@tgaawakening.com">
                      Contact the team ↗
                    </a>
                  </p>
                </div>
                <div className={styles.faqs}>
                  {orientation && (
                    <details>
                      <summary>When is the free orientation?</summary>
                      <p>
                        {config.orientation.date}.{" "}
                        {config.orientation.times
                          .map((slot) => `${slot.time} ${slot.region}`)
                          .join(" · ")}
                        . Duration: {config.orientation.duration.toLowerCase()}.
                        This is separate from the weekly course schedule.
                      </p>
                    </details>
                  )}
                  <details>
                    <summary>What will I study?</summary>
                    <p>
                      Explore source examination, leadership, character, public
                      communication, law, diplomacy and collective
                      responsibility. Consider present-day applications with
                      attention to differences in context.
                    </p>
                  </details>
                  {config.faqs.map((faq) => (
                    <details key={faq.question}>
                      <summary>{faq.question}</summary>
                      <p>{faq.answer}</p>
                    </details>
                  ))}
                  <details>
                    <summary>Can I request fee support?</summary>
                    <p>
                      Yes. Use the{" "}
                      <a href={config.feeSupportUrl}>
                        confidential fee-support application
                      </a>{" "}
                      to contact the team about your circumstances.
                    </p>
                  </details>
                </div>
              </div>
              <div className={styles.closing}>
                <p className={styles.eyebrow}>Study with purpose</p>
                <h2>
                  Learn from the life.
                  <br />
                  <em>Reflect on your responsibility.</em>
                </h2>
                <PrimaryAction placement="closing" />
              </div>
            </div>
          </section>
        </main>
        <Footer />
        <div className={styles.mobileAction}>
          <PrimaryAction placement="mobile-sticky" />
        </div>
      </div>
    </CampaignContext.Provider>
  );
}
