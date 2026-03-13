"use client";

import { motion } from "framer-motion";
import Image from "next/image";
import { Swiper, SwiperSlide } from "swiper/react";
import { Autoplay, Navigation, Pagination } from "swiper/modules";
import { propheticSlides } from "@/components/home/data";
import { fadeInUp } from "@/components/home/sections/shared";
import "swiper/css";
import "swiper/css/navigation";
import "swiper/css/pagination";

export function PropheticStrategiesSlider() {
  const getStatPair = (value: string) => {
    const parts = value.trim().split(/\s+/);
    if (parts.length === 1) {
      return { value: parts[0], label: "" };
    }
    return { value: parts[0], label: parts.slice(1).join(" ") };
  };

  return (
    <section className="ga-section ga-seerah-section">
      <div className="ga-container">
        <motion.div {...fadeInUp} className="text-center ga-seerah-heading">
          <h2 className="ga-seerah-title">
            <span className="ga-seerah-green">Prophetic</span> Strategies &amp; Planning
          </h2>
        </motion.div>

        <motion.div {...fadeInUp} className="ga-seerah-slider-wrap">
          <Swiper
            modules={[Navigation, Pagination, Autoplay]}
            spaceBetween={20}
            loop
            navigation
            pagination={{ clickable: true }}
            autoplay={{ delay: 4500, disableOnInteraction: false }}
            className="ga-swiper ga-seerah-swiper"
          >
            {propheticSlides.map((slide) => (
              <SwiperSlide key={slide.title}>
                <article className="ga-seerah-card">
                  <div className="ga-seerah-poster-wrap">
                    <Image
                      src={slide.image}
                      alt={slide.title}
                      width={700}
                      height={900}
                      className="ga-seerah-poster"
                    />
                  </div>

                  <div className="ga-seerah-content">
                    <div className="ga-seerah-head-row">
                      <div className="ga-seerah-kicker-wrap">
                        <span className="ga-seerah-icon">⌘</span>
                        <div>
                          <p className="ga-seerah-kicker">{`${getStatPair(slide.duration).value}-Month Journey`}</p>
                          <p className="ga-seerah-green-text">{slide.subtitle}</p>
                        </div>
                      </div>
                      <span className="ga-seerah-pill">Live Course</span>
                    </div>

                    <h3 className="ga-seerah-slide-title">{slide.title}</h3>
                    <p className="ga-seerah-tagline">Safeguarding the Ummah</p>
                    <p className="ga-seerah-copy">{slide.description}</p>

                    <div className="ga-seerah-points">
                      {slide.points.map((point) => (
                        <div key={point} className="ga-seerah-point">
                          <span className="ga-seerah-check">✓</span>
                          {point}
                        </div>
                      ))}
                    </div>

                    <div className="ga-seerah-metrics">
                      <div className="ga-seerah-metric">
                        <p className="ga-seerah-metric-value">{getStatPair(slide.duration).value}</p>
                        <p className="ga-seerah-metric-label">Months</p>
                      </div>
                      <div className="ga-seerah-metric">
                        <p className="ga-seerah-metric-value">{getStatPair(slide.sessions).value}</p>
                        <p className="ga-seerah-metric-label">Sessions</p>
                      </div>
                      <div className="ga-seerah-metric">
                        <p className="ga-seerah-metric-value">1.5hr</p>
                        <p className="ga-seerah-metric-label">Per Session</p>
                      </div>
                    </div>

                    <div className="ga-seerah-cta-row">
                      <button type="button" className="ga-seerah-btn">
                        Enroll Now
                      </button>
                      <p className="ga-seerah-price">
                        {slide.fee.replace("Â£", "£").replace("/month", "")}
                        <span>/month</span>
                      </p>
                    </div>
                  </div>
                </article>
              </SwiperSlide>
            ))}
          </Swiper>
        </motion.div>
      </div>
    </section>
  );
}
