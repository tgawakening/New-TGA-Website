import {
  CommunityCta,
  ConnectAkhiraTimeline,
  CoursesCarousel,
  Footer,
  GenMuminsTimeline,
  Header,
  HeroSection,
  MissionVisionSection,
  SirahPromotion,
  UpcomingCoursesSection,
} from "@/components/home/sections";

export default function HomePage() {
  return (
    <div className="ga-page">
      <Header />
      <main>
        <HeroSection />
        <SirahPromotion />
        <MissionVisionSection />
        <ConnectAkhiraTimeline />
        <GenMuminsTimeline />
        <CoursesCarousel />
        <UpcomingCoursesSection />
        <CommunityCta />
      </main>
      <Footer />
    </div>
  );
}

