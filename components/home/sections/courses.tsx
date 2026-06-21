"use client";

import { type CSSProperties, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { motion } from "framer-motion";
import { Swiper, SwiperSlide } from "swiper/react";
import { Autoplay, Pagination } from "swiper/modules";
import { courses, upcomingCourses } from "@/components/home/data";
import { fadeInUp, SectionHeading } from "@/components/home/sections/shared";
import "swiper/css";
import "swiper/css/pagination";

const upcomingRegistrationHref = "https://forms.gle/qXhqNy1FF8bNbmfw7";

export function CtaArrow() {
  return (
    <svg viewBox="0 0 24 24" className="ga-cta-arrow" aria-hidden>
      <path d="M5 12h12" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <path d="M13 7l5 5-5 5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function getCourseMotiveIcon(courseId: string) {
  if (courseId === "seerah-kids") {
    return (
      <svg viewBox="0 0 24 24" className="ga-motive-svg" aria-hidden>
        <path d="M4.5 6.5h7.2a2.1 2.1 0 0 1 2.1 2.1v9.3H6.6a2.1 2.1 0 0 0-2.1 2.1V6.5z" fill="none" stroke="currentColor" strokeWidth="1.6" />
        <path d="M19.5 6.5h-7.2a2.1 2.1 0 0 0-2.1 2.1v9.3h7.2a2.1 2.1 0 0 1 2.1 2.1V6.5z" fill="none" stroke="currentColor" strokeWidth="1.6" />
      </svg>
    );
  }
  if (courseId === "arabic-40-b3" || courseId === "arabic-40-b2" || courseId === "advance-arabic") {
    return (
      <svg viewBox="0 0 24 24" className="ga-motive-svg" aria-hidden>
        <rect x="5" y="5" width="14" height="14" rx="2" fill="none" stroke="currentColor" strokeWidth="1.7" />
        <path d="M8 9h8M8 12h8M8 15h5" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
      </svg>
    );
  }
  if (courseId === "prophetic-strategy") {
    return (
      <svg viewBox="0 0 24 24" className="ga-motive-svg" aria-hidden>
        <circle cx="12" cy="12" r="7.8" fill="none" stroke="currentColor" strokeWidth="1.6" />
        <path d="M12 7l3.1 6.2L8.8 15z" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
      </svg>
    );
  }
  if (courseId === "ai-vs-ai") {
    return (
      <svg viewBox="0 0 24 24" className="ga-motive-svg" aria-hidden>
        <rect x="7" y="7" width="10" height="10" rx="1.3" fill="none" stroke="currentColor" strokeWidth="1.7" />
        <path d="M12 3v3M12 18v3M3 12h3M18 12h3" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      </svg>
    );
  }
  if (courseId === "earn-as-you-learn" || courseId === "islamic-economic-principles") {
    return (
      <svg viewBox="0 0 24 24" className="ga-motive-svg" aria-hidden>
        <path d="M5.5 15.5l4-4 3.1 2.6 5-5.6" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M5 18h14" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      </svg>
    );
  }
  if (courseId === "global-mission-quran") {
    return (
      <svg viewBox="0 0 24 24" className="ga-motive-svg" aria-hidden>
        <circle cx="12" cy="12" r="8" fill="none" stroke="currentColor" strokeWidth="1.6" />
        <path d="M4 12h16M12 4a13 13 0 0 1 0 16M12 4a13 13 0 0 0 0 16" fill="none" stroke="currentColor" strokeWidth="1.4" />
      </svg>
    );
  }
  if (courseId === "isha-night-club") {
    return (
      <svg viewBox="0 0 24 24" className="ga-motive-svg" aria-hidden>
        <path d="M14.8 4.9a7.2 7.2 0 1 0 4.3 12.6 6.2 6.2 0 1 1-4.3-12.6z" fill="none" stroke="currentColor" strokeWidth="1.7" />
      </svg>
    );
  }
  if (courseId === "holistic-muslim-linkedin") {
    return (
      <svg viewBox="0 0 24 24" className="ga-motive-svg" aria-hidden>
        <circle cx="6" cy="8" r="2" fill="none" stroke="currentColor" strokeWidth="1.5" />
        <circle cx="18" cy="8" r="2" fill="none" stroke="currentColor" strokeWidth="1.5" />
        <circle cx="12" cy="17" r="2" fill="none" stroke="currentColor" strokeWidth="1.5" />
        <path d="M7.7 9.3l2.8 5.2M16.3 9.3l-2.8 5.2M8 8h8" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
      </svg>
    );
  }
  if (courseId === "first-aid-medfusion") {
    return (
      <svg viewBox="0 0 24 24" className="ga-motive-svg" aria-hidden>
        <path d="M12 5v14M5 12h14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        <circle cx="12" cy="12" r="8.2" fill="none" stroke="currentColor" strokeWidth="1.4" />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 24 24" className="ga-motive-svg" aria-hidden>
      <circle cx="12" cy="12" r="7.6" fill="none" stroke="currentColor" strokeWidth="1.7" />
      <path d="M12 4.4v15.2M4.4 12h15.2" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

export function CoursesCarousel() {
  const courseSlides = [...courses];

  return (
    <section id="courses" className="ga-section">
      <div className="ga-container">
        <SectionHeading
          badge="Live & Active Learning"
          title={
            <>
              Our <span className="ga-sky">Courses</span>
            </>
          }
          subtitle="Join our growing community of learners with live sessions and expert instructors."
        />

        <motion.div {...fadeInUp} className="ga-courses-track mt-10">
          <Swiper
            modules={[Autoplay, Pagination]}
            spaceBetween={20}
            autoplay={{ delay: 3600, disableOnInteraction: false }}
            pagination={{ clickable: true }}
            breakpoints={{
              320: { slidesPerView: 1.04 },
              700: { slidesPerView: 1.6 },
              1024: { slidesPerView: 2 },
              1280: { slidesPerView: 3 },
            }}
            className="ga-swiper ga-course-swiper"
          >
            {courseSlides.map((course) => (
              <SwiperSlide key={course.id}>
                <article className="ga-course-card-v2" style={{ "--course-accent": course.accent } as CSSProperties}>
                  <div className="ga-course-topline" />
                  <div className="ga-course-chip-row">
                    <span className="ga-course-status">{course.status}</span>
                    <div className={`ga-course-icon ga-icon-${course.iconMotion}`} aria-hidden>
                      {getCourseMotiveIcon(course.id)}
                    </div>
                  </div>
                  <div className="ga-course-meta-row">
                    <span className="ga-course-timeline">{course.timeline}</span>
                    <span className="ga-course-category">{course.category}</span>
                  </div>
                  <h3 className="ga-course-title">{course.title}</h3>
                  <p className="ga-course-subtitle">{course.subtitle}</p>
                  <p className="ga-course-mentor">{course.mentor}</p>

                  <ul className="ga-course-points">
                    {course.outcomes.map((point) => (
                      <li key={point}>{point}</li>
                    ))}
                  </ul>

                  <div className="ga-course-footer-meta">
                    <span>{course.duration}</span>
                    <span>{course.learners}</span>
                    <span>{course.rating}</span>
                  </div>

                  <button type="button" className="ga-course-cta">
                    {course.action} <CtaArrow />
                  </button>
                </article>
              </SwiperSlide>
            ))}
          </Swiper>
        </motion.div>
      </div>
    </section>
  );
}

export function UpcomingCoursesSection() {
  const upcomingSlides = [...upcomingCourses];
  const [activePosterId, setActivePosterId] = useState<string | null>(null);
  const activePoster = upcomingSlides.find((course) => course.id === activePosterId);

  return (
    <section id="projects" className="ga-section ga-upcoming-section">
      <div className="ga-container">
        <SectionHeading
          badge="Next Launches"
          title="Upcoming Courses"
        />

        <motion.div {...fadeInUp} className="ga-upcoming-register-action">
          <Link href={upcomingRegistrationHref} target="_blank" rel="noreferrer" className="ga-upcoming-register-btn">
            Register your interest <CtaArrow />
          </Link>
        </motion.div>

        <motion.div {...fadeInUp} className="ga-upcoming-posters-track mt-10">
          <Swiper
            modules={[Autoplay, Pagination]}
            spaceBetween={28}
            autoplay={{ delay: 4300, disableOnInteraction: false, pauseOnMouseEnter: true }}
            pagination={{ clickable: true }}
            breakpoints={{
              320: { slidesPerView: 1.02, spaceBetween: 18 },
              620: { slidesPerView: 1.45, spaceBetween: 24 },
              900: { slidesPerView: 2.1, spaceBetween: 28 },
              1240: { slidesPerView: 3, spaceBetween: 30 },
            }}
            className="ga-swiper ga-upcoming-posters-swiper"
          >
            {upcomingSlides.map((course) => (
              <SwiperSlide key={course.id}>
                <article className="ga-upcoming-poster-card" style={{ "--course-accent": course.accent } as CSSProperties}>
                  <button type="button" className="ga-upcoming-poster-button" onClick={() => setActivePosterId(course.id)} aria-label={`Open ${course.title} poster`}>
                    <span className="ga-upcoming-poster-media">
                      <Image src={course.image} alt={`${course.title} poster`} width={1080} height={1527} sizes="(min-width: 1240px) 31vw, (min-width: 900px) 43vw, (min-width: 620px) 64vw, 92vw" />
                    </span>
                  </button>
                </article>
              </SwiperSlide>
            ))}
          </Swiper>
        </motion.div>
      </div>

      {activePoster ? (
        <div className="ga-poster-lightbox" role="dialog" aria-modal="true" aria-label={`${activePoster.title} poster`}>
          <button type="button" className="ga-poster-lightbox-backdrop" aria-label="Close poster preview" onClick={() => setActivePosterId(null)} />
          <div className="ga-poster-lightbox-panel">
            <button type="button" className="ga-poster-lightbox-close" onClick={() => setActivePosterId(null)} aria-label="Close poster preview">
              Close
            </button>
            <Image src={activePoster.image} alt={`${activePoster.title} poster`} width={1080} height={1527} sizes="92vw" priority />
          </div>
        </div>
      ) : null}
    </section>
  );
}
