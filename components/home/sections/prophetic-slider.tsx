"use client";

import { motion } from "framer-motion";
import Image from "next/image";
import Link from "next/link";
import { Swiper, SwiperSlide } from "swiper/react";
import { Autoplay, Navigation, Pagination } from "swiper/modules";
import { propheticSlides } from "@/components/home/data";
import { fadeInUp } from "@/components/home/sections/shared";
import "swiper/css";
import "swiper/css/navigation";
import "swiper/css/pagination";

export function PropheticStrategiesSlider() {
  const regularPrice = "View regional fees";

  return (
    <section className="ga-section ga-seerah-section">
      <div className="ga-container">
        <motion.div {...fadeInUp} className="text-center ga-seerah-heading">
          <h2 className="ga-seerah-title">
            <span className="ga-seerah-green">SĪRAH</span> | BEYOND CHRONOLOGY
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
                        <span className="ga-seerah-icon">{"\u2318"}</span>
                        <div>
                          <p className="ga-seerah-kicker">
                            {"12-Month Programme"}
                          </p>
                          <p className="ga-seerah-green-text">
                            {slide.subtitle}
                          </p>
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
                          <span className="ga-seerah-check">{"\u2713"}</span>
                          {point}
                        </div>
                      ))}
                    </div>

                    <div className="ga-seerah-metrics">
                      <div className="ga-seerah-metric">
                        <p className="ga-seerah-metric-value">12</p>
                        <p className="ga-seerah-metric-label">Months</p>
                      </div>
                      <div className="ga-seerah-metric">
                        <p className="ga-seerah-metric-value">Live</p>
                        <p className="ga-seerah-metric-label">Online</p>
                      </div>
                      <div className="ga-seerah-metric">
                        <p className="ga-seerah-metric-value">Q&amp;A</p>
                        <p className="ga-seerah-metric-label">Included</p>
                      </div>
                    </div>

                    <div className="ga-seerah-cta-row">
                      <Link href="/seerah" className="ga-seerah-btn">
                        Explore the Course
                      </Link>
                      <p className="ga-seerah-price">{regularPrice}</p>
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
