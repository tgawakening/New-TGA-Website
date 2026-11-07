"use client";

import { countries } from "countries-list";
import { resolveMarket, priceFor, formatSirahMoney, annualSirahSavings } from "@/lib/sirah/catalog";
import {
  useResidenceSelection,
  saveResidence,
} from "@/lib/sirah/use-residence";
import Image, { getImageProps } from "next/image";
import {
  SirahRegistrationProvider,
  useSirahRegistration,
} from "@/components/sirah/registration-provider";
import { Swiper, SwiperSlide } from "swiper/react";
import { Autoplay, A11y } from "swiper/modules";
import type { Swiper as SwiperInstance } from "swiper";
import { useReducedMotion } from "framer-motion";
import "swiper/css";
import { useEffect, useRef, useState } from "react";
import { Header, Footer } from "@/components/home/sections";
import {
  activeCampaign,
  courseConfig as config,
  learningOutcomes,
  topics,
  type FeePlan,
} from "./course-config";
import { trackSeerah } from "./analytics";
import { consultationDestinations } from "./consultation-config";
import { formatFee } from "./regional-fees";
import styles from "./seerah.module.css";
import {
  ConsultationAction,
  ConsultationProvider,
} from "./consultation-action";
import {
  CoursePreview,
  TeachingApproach,
  useSectionExperience,
} from "./course-interactions";

const sectionLinks = [
  ["overview", "Overview"],
  ["topics", "Topics"],
  ["course-details", "Course Details"],
  ["fees", "Fees"],
  ["faqs", "FAQs"],
];

function PrimaryAction({
  placement,
  country,
  plan,
}: {
  placement: string;
  country?: string;
  plan?: "MONTHLY" | "ANNUAL";
}) {
  const open = useSirahRegistration();
  const params = new URLSearchParams();
  if (country) params.set("country", country);
  if (plan) params.set("plan", plan);
  const query = params.toString();
  return (
    <a
      className={styles.primary}
      href={`/seerah/register${query ? `?${query}` : ""}`}
      onClick={(event) => {
        if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey)
          return;
        event.preventDefault();
        trackSeerah("seerah_registration_open", { placement });
        open({
          country,
          plan,
          replacePreferences: placement.startsWith("fees"),
        });
      }}
    >
      Register for the Course <span aria-hidden>↗</span>
    </a>
  );
}

function TopicGallery() {
  const gallery = useRef<HTMLDivElement>(null);
  const [current, setCurrent] = useState(0);
  const [expanded, setExpanded] = useState<number | null>(null);
  const [swiper, setSwiper] = useState<SwiperInstance | null>(null);
  const [paused, setPaused] = useState(false);
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  const [visible, setVisible] = useState(false);
  const reduced = useReducedMotion();
  useEffect(() => {
    const node = gallery.current;
    if (!node) return;
    const observer = new IntersectionObserver(
      ([entry]) => setVisible(entry.isIntersecting),
      { threshold: 0.15 },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, []);
  useEffect(() => {
    if (!swiper || swiper.destroyed) return;
    if (
      reduced !== false ||
      paused ||
      hovered ||
      focused ||
      !visible ||
      expanded !== null
    )
      swiper.autoplay.stop();
    else swiper.autoplay.start();
  }, [swiper, reduced, paused, hovered, focused, visible, expanded]);
  function move(direction: number) {
    if (!swiper) return;
    if (direction > 0) swiper.slideNext(reduced ? 0 : 320);
    else swiper.slidePrev(reduced ? 0 : 320);
  }
  return (
    <div
      ref={gallery}
      className={styles.topicExperience}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onFocusCapture={() => setFocused(true)}
      onBlurCapture={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget))
          setFocused(false);
      }}
    >
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
          <span aria-live={focused ? "polite" : "off"} aria-atomic="true">
            {String(current + 1).padStart(2, "0")} /{" "}
            {String(topics.length).padStart(2, "0")}
          </span>
          <button
            type="button"
            disabled={reduced === true}
            title={reduced ? "Autoplay is off with reduced motion" : undefined}
            aria-label={paused ? "Play topic carousel" : "Pause topic carousel"}
            aria-pressed={paused}
            onClick={() => setPaused(!paused)}
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 16 16"
              fill="currentColor"
              aria-hidden
            >
              {paused ? (
                <path d="M4 2l9 6-9 6z" />
              ) : (
                <>
                  <rect x="4" y="2" width="3" height="12" />
                  <rect x="10" y="2" width="3" height="12" />
                </>
              )}
            </svg>
          </button>
          <button
            type="button"
            aria-label="Previous topic"
            aria-controls="topic-gallery"
            onClick={() => move(-1)}
          >
            ←
          </button>
          <button
            type="button"
            aria-label="Next topic"
            aria-controls="topic-gallery"
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
        role="region"
        aria-label="Course topic gallery"
        tabIndex={0}
        onKeyDown={(event) => {
          if (
            event.target === event.currentTarget &&
            ["ArrowRight", "ArrowLeft"].includes(event.key)
          ) {
            event.preventDefault();
            move(event.key === "ArrowRight" ? 1 : -1);
          }
        }}
      >
        <Swiper
          className={styles.loopGallery}
          modules={[Autoplay, A11y]}
          loop
          speed={320}
          slidesPerView={1.13}
          spaceBetween={18}
          breakpoints={{
            761: { slidesPerView: 2, spaceBetween: 20 },
            1100: { slidesPerView: 3, spaceBetween: 22 },
          }}
          autoplay={{ delay: 4600, disableOnInteraction: false }}
          onSwiper={setSwiper}
          onSlideChange={(instance) => setCurrent(instance.realIndex)}
        >
          {topics.map((topic, i) => (
            <SwiperSlide key={topic.title}>
              <article
                data-topic={i}
                className={styles.topic}
                aria-label={`Topic ${i + 1} of ${topics.length}`}
              >
                <div
                  className={`${styles.topicArt} ${topic.artwork?.clean ? styles.cleanArt : ""}`}
                >
                  {topic.artwork ? (
                    <Image
                      src={
                        topic.artwork.src.includes(",")
                          ? encodeURI(topic.artwork.src).replaceAll(",", "%2C")
                          : topic.artwork.src
                      }
                      alt={topic.artwork.alt}
                      width={topic.artwork.width}
                      height={topic.artwork.height}
                      style={{
                        objectPosition: topic.artwork.position || "center",
                      }}
                      unoptimized={topic.artwork.src.includes(",")}
                      loading="lazy"
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
                    {expanded === i
                      ? "Close question −"
                      : "Explore this question"}
                    <span className={styles.srOnly}> about {topic.title}</span>
                  </button>
                </div>
              </article>
            </SwiperSlide>
          ))}
        </Swiper>
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
          <h4>The historical question</h4>
          <p>{topic.question}</p>
          <h4>What students will examine</h4>
          <p>{topic.detail}</p>
          <h4>A present-day reflection</h4>
          <p>{topic.reflection}</p>
          <button
            type="button"
            className={styles.readMore}
            onClick={() => {
              setExpanded(null);
              gallery.current
                ?.querySelector<HTMLButtonElement>(`[data-topic="${i}"] button`)
                ?.focus();
            }}
          >
            Close detail −
          </button>
        </div>
      ))}
    </div>
  );
}

function Plan({
  plan,
  annual,
  country,
  available,
  pakistanOnlineAvailable,
}: {
  available?: boolean;
  pakistanOnlineAvailable?: boolean;
  plan: FeePlan | null;
  annual: boolean;
  country: string;
}) {
  return (
    <article className={`${styles.plan} ${annual ? styles.annual : ""}`}>
      <p className={styles.eyebrow}>
        {annual ? "Annual upfront" : "Monthly plan"}
      </p>
      {plan ? (
        <>
          {annual && (
            <p>
              <s>
                {formatSirahMoney(
                  priceFor(country, "MONTHLY", "STRIPE").amountMinor * 12,
                  plan.currency,
                )}
              </s>{" "}
              12 online monthly payments
            </p>
          )}
          <h3>
            {country === "PK" && !annual && (
              <s
                className={styles.manualComparison}
                aria-label="Manual monthly price"
              >
                {formatFee(
                  priceFor("PK", "MONTHLY", "BANK_TRANSFER").amountMinor / 100,
                  "PKR",
                )}
              </s>
            )}
            {formatFee(plan.amount, plan.currency)}
            <small>{plan.frequency}</small>
          </h3>
          <p>Charge currency: {plan.currency}</p>
          <p>{plan.method}</p>
          {!annual && country === "PK" && !pakistanOnlineAvailable && (
            <p>Automatic card payments are currently unavailable</p>
          )}
          {plan.total && <p>{plan.total}</p>}
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
      {annual && plan && (
        <p className={styles.planNote}>
          Save {formatSirahMoney(annualSirahSavings(country).savingMinor, plan.currency)} — approximately {annualSirahSavings(country).approximatePercent}% compared with 12 online monthly payments. Pay once for 12 months.
        </p>
      )}
      {available === false && (
        <p className={styles.paymentNotice}>
          Payment is currently unavailable for this plan. Enquire on WhatsApp
          for assistance.
        </p>
      )}
      <PrimaryAction
        placement={`fees-${country}-${annual ? "annual" : "monthly"}`}
        country={country}
        plan={annual ? "ANNUAL" : "MONTHLY"}
      />
      <ConsultationAction
        className={styles.readMore}
        placement={`fees-${country}-${annual ? "annual" : "monthly"}`}
      />
    </article>
  );
}

function PublicCourseGroups() {
  return (
    <div id="course-enquiries" className={styles.publicGroups}>
      <div>
        <h3>Questions before you register?</h3>
        <p>
          Speak with the Sīrah team about the course and your regional payment
          options.
        </p>
      </div>
      <ConsultationAction
        className={styles.secondary}
        placement="course-enquiries"
      />
    </div>
  );
}

function Fees({
  availability,
  pakistanOnlineAvailable = false,
  country,
  onCountryChange,
}: {
  availability?: Record<string, Record<string, boolean>>;
  pakistanOnlineAvailable?: boolean;
  country: string;
  onCountryChange: (value: string) => void;
}) {
  const market = config.markets.find(
    (m) => m.code === resolveMarket(country)[0],
  )!;
  const monthly = market.monthly;
  function select(value: string) {
    onCountryChange(value);
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
          <div className={styles.feeIntroduction}>
            <p>
              Choose your country of residence to see the fees for your region.
              The 12-month programme includes live teaching, discussion and Q&A.
              Pay monthly or make one upfront payment.
            </p>
            <p>
              Choosing your country accurately is an amānah. Please select the
              country where you currently live. Allah commands us to honour our
              trusts (
              <a
                href="https://quran.com/4/58"
                target="_blank"
                rel="noopener noreferrer"
              >
                Qur’an 4:58
              </a>
              ).
            </p>
          </div>
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
          Country of residence
          <select
            aria-label="Country of residence"
            value={country}
            onChange={(e) => select(e.target.value)}
          >
            {Object.entries(countries)
              .sort((a, b) => a[1].name.localeCompare(b[1].name))
              .map(([code, details]) => (
                <option value={code} key={code}>
                  {details.name}
                </option>
              ))}
          </select>
        </label>
        <div aria-live="polite" aria-atomic="true">
          <h3 className={styles.marketTitle}>{market.name}</h3>
          <div className={styles.plans}>
            <Plan
              plan={monthly}
              annual={false}
              country={country}
              pakistanOnlineAvailable={pakistanOnlineAvailable}
              available={availability?.[market.code]?.MONTHLY}
            />
            <Plan
              plan={market.annual}
              annual
              country={country}
              available={availability?.[market.code]?.ANNUAL}
            />
          </div>
          {market.code === "OTHER" && (
            <p className={styles.paymentNotice}>
              Fees are shown in GBP. Any conversion by your bank may vary; no
              fixed local-currency amount is offered.
            </p>
          )}
          {config.checkoutEnabled && market.terms && (
            <p className={styles.terms}>{market.terms}</p>
          )}
        </div>
        <div className={styles.feeFoot}>
          <a href={config.feeSupportUrl}>Request confidential fee support ↗</a>
        </div>
        <PublicCourseGroups />
      </div>
    </section>
  );
}

function SeerahContent({
  initialCampaign,
  pakistanOnlineAvailable,
  visitorCountry,
  availability,
}: {
  initialCampaign: "orientation" | "enrolment";
  pakistanOnlineAvailable?: boolean;
  visitorCountry?: string;
  availability?: Record<string, Record<string, boolean>>;
}) {
  const openRegistration = useSirahRegistration();
  const mobileHero = getImageProps({
    src: config.heroMobile.src,
    alt: config.heroMobile.alt,
    width: config.heroMobile.width,
    height: config.heroMobile.height,
    sizes: "100vw",
  }).props;
  const root = useRef<HTMLDivElement>(null);
  const activeSection = useSectionExperience(root);
  const { country, hasResidence } = useResidenceSelection(visitorCountry);
  const mobileBar = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const bar = mobileBar.current;
    if (!bar) return;
    const update = () =>
      root.current?.style.setProperty(
        "--sirah-mobile-bar-height",
        `${bar.getBoundingClientRect().height}px`,
      );
    update();
    const observer = new ResizeObserver(update);
    observer.observe(bar);
    return () => observer.disconnect();
  }, []);
  const setCountry = saveResidence;
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
    <ConsultationProvider country={hasResidence ? country : undefined}>
      <div className={styles.page} ref={root}>
        <a className={styles.skip} href="#overview">
          Skip to course content
        </a>
        <Header
          enrolmentAction={{
            href: "/seerah/register",
            label: "Register for the Course",
            onClick: (event) => {
              if (
                event.metaKey ||
                event.ctrlKey ||
                event.shiftKey ||
                event.altKey
              )
                return;
              event.preventDefault();
              openRegistration({ country });
            },
          }}
        />
        <nav className={styles.sectionNav} aria-label="Course sections">
          <div className={styles.container}>
            <a className={styles.navBrand} href="#overview">
              SĪRAH <span>/ BEYOND CHRONOLOGY</span>
            </a>
            <div>
              {sectionLinks.map(([id, label]) => (
                <a
                  href={`#${id}`}
                  key={id}
                  aria-current={activeSection === id ? "location" : undefined}
                >
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
              <picture className={styles.heroMedia}>
                <source
                  media="(max-width: 767px)"
                  srcSet={mobileHero.srcSet}
                  sizes="100vw"
                />
                <Image
                  className={styles.heroImage}
                  src={config.hero.src}
                  alt={config.hero.alt}
                  fill
                  loading="eager"
                  fetchPriority="high"
                  sizes="100vw"
                />
              </picture>
            )}

            <div className={styles.heroShade} />
            <div className={`${styles.container} ${styles.heroInner}`}>
              <div className={styles.heroCopy}>
                <h1 id="course-title">
                  <span className={styles.heroCourseName}>SĪRAH</span>{" "}
                  <span className={styles.heroCourseTitle}>Beyond Chronology</span>
                </h1>
                <p className={styles.heroIntro}>
                  Study the life of the Prophet ﷺ through his decisions, the
                  community he built, and our responsibilities today.
                </p>
                <div className={styles.heroActions}>
                  <PrimaryAction placement="hero" country={country} />
                  <ConsultationAction
                    className={styles.secondary}
                    placement="hero"
                  />
                </div>
              </div>
            </div>
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
                {consultationDestinations.orientation && (
                  <a
                    className={styles.readMore}
                    href={consultationDestinations.orientation}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    Orientation details ↗
                  </a>
                )}
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
                  <CoursePreview country={country} />
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
              <TeachingApproach />
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
          <Fees
            availability={availability}
            pakistanOnlineAvailable={pakistanOnlineAvailable}
            country={country}
            onCountryChange={setCountry}
          />
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
                  <ConsultationAction
                    className={styles.readMore}
                    placement="faq"
                  />
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
            </div>
          </section>
          <section className={styles.closing} aria-labelledby="closing-heading">
            <div className={styles.container}>
              <p className={styles.eyebrow}>Study with purpose</p>
              <h2 id="closing-heading">
                Learn from the life.
                <br />
                <em>Reflect on your responsibility.</em>
              </h2>
              <PrimaryAction placement="closing" country={country} />
              <ConsultationAction
                className={styles.secondary}
                placement="closing"
              />
            </div>
          </section>
        </main>
        <Footer />
        <div className={styles.mobileAction} ref={mobileBar}>
          <PrimaryAction placement="mobile-sticky" country={country} />
        </div>
      </div>
    </ConsultationProvider>
  );
}

export default function SeerahPage(props: {
  registrationEntry?: {
    country?: string;
    plan?: "MONTHLY" | "ANNUAL";
    requireBillingCountry?: boolean;
  };
  initialCampaign: "orientation" | "enrolment";
  pakistanOnlineAvailable?: boolean;
  visitorCountry?: string;
  availability?: Record<string, Record<string, boolean>>;
}) {
  return (
    <SirahRegistrationProvider entry={props.registrationEntry}>
      <SeerahContent {...props} />
    </SirahRegistrationProvider>
  );
}
