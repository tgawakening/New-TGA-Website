/* Landing content for the Indigo Geometry redesign.
 * Every value is pulled from (or quoted from) the live site's own sources so the
 * two pages cannot drift: components/home/data.ts, components/home/sections/*,
 * components/seerah/course-config.ts and components/gen-mumin/*. */
import { courses as liveCourses, missionPillars, missionStats } from "@/components/home/data";
import { courseConfig, learningOutcomes } from "@/components/seerah/course-config";

/* Hero ayah: the one live in components/home/sections/hero.tsx (Ar-Rūm 30:22). */
export const heroAyah = {
  arabic:
    "وَمِنْ آيَاتِهِ خَلْقُ السَّمَاوَاتِ وَالأَرْضِ وَاخْتِلَافُ أَلْسِنَتِكُمْ وَأَلْوَانِكُمْ ۚ إِنَّ فِي ذَٰلِكَ لَآيَاتٍ لِّلْعَالِمِينَ",
  // Live wording; only the capitalisation is normalised.
  translation:
    "And among His signs is the creation of the heavens and the earth and the difference of your tongues and colours. Surely in this there are signs for the persons having knowledge.",
  reference: "Ar-Rūm 30:22",
};

/** "1000+" -> { n: "1,000", suffix: "+" } */
export const stats = missionStats.map((s) => {
  const digits = Number.parseInt(s.value.replace(/[^\d]/g, ""), 10);
  return { label: s.label, n: digits.toLocaleString("en-GB"), suffix: s.value.replace(/[\d,]/g, "") };
});

export const statByLabel = (label: string) => stats.find((s) => s.label === label);

/* Vision / Mission: components/home/sections/mission-vision.tsx */
export const visionMission = {
  vision: {
    tab: "Our vision",
    titleA: "A united, empowered",
    titleB: "global Muslim community",
    lead: "Grounded in the timeless wisdom of the Qur'an, where future generations rise as compassionate, innovative leaders, shaping a better world for all.",
    motto: "Unity. Wisdom. Legacy.",
    focusTitle: "Our future direction",
    points: [
      "Faith-centered civilizational thinking",
      "Compassionate and innovative leadership",
      "Interconnected global Muslim collaboration",
    ],
    ayah: {
      arabic: "إِنَّ أَكْرَمَكُمْ عِندَ ٱللَّهِ أَتْقَىٰكُمْ",
      translation: "Indeed, the most noble of you in the sight of Allah is the most righteous of you.",
      reference: "Al-Ḥujurāt 49:13",
    },
  },
  mission: {
    tab: "Our mission",
    titleA: "Awakening the Ummah,",
    titleB: "one journey at a time",
    lead: "We are a global platform driven by the mission of awakening and empowering intellectual and concerned Muslims to inspire meaningful change.",
    motto: "Action. Service. Reform.",
    focusTitle: "Our focus in action",
    points: missionPillars,
    ayah: {
      arabic: "وَتَعَاوَنُوا عَلَى الْبِرِّ وَالتَّقْوَىٰ",
      translation: "And cooperate in righteousness and piety.",
      reference: "Al-Mā'idah 5:2",
    },
  },
} as const;

export type VisionMissionKey = keyof typeof visionMission;

/* Flagship: components/home/sections/sirah-promotion.tsx + course-config essentials. */
export const flagship = {
  eyebrow: "Sīrah · the flagship",
  title: "Beyond Chronology",
  pillars: ["The Law", "The Power", "The Leadership", "The Movement"],
  body: "Study the life of the Prophet, peace be upon him, through his decisions, leadership, and the community he built.",
  essentials: courseConfig.essentials, // ["12-month programme", "Live teaching", "Discussion & Q&A"]
  href: "/seerah",
};

/* Course cards. */
type Tone = "teal" | "gold" | "terra";
export type CourseCard = {
  id: string;
  badge: string;
  tone: Tone;
  title: string;
  subtitle: string;
  mentor: string | null;
  points: string[];
  meta: string[];
  rating: string | null;
  action: { label: string; href: string };
};

const toneFor: Record<string, Tone> = { "ENROLLING NOW": "teal", FREE: "gold", "IN PROGRESS": "terra" };
const sentence = (s: string) => s.charAt(0) + s.slice(1).toLowerCase();

const contactHref = (title: string) =>
  `mailto:admin@tgaawakening.com?subject=${encodeURIComponent(`Course enquiry: ${title}`)}`;

export const courseCards: CourseCard[] = [
  {
    id: "beyond-chronology",
    badge: "Flagship",
    tone: "teal",
    title: "Sīrah: Beyond Chronology",
    subtitle: "Law, Power, Leadership & Movement",
    mentor: null, // courseConfig.instructor is null: not yet approved for publication
    points: learningOutcomes.slice(0, 3).map((o) => o.title),
    meta: ["12 months", "Live"],
    rating: null,
    action: { label: "View course", href: "/seerah" },
  },
  // Live courses that are still running or open (the completed batch is left out).
  ...liveCourses
    .filter((c) => c.status !== "COMPLETED")
    .map<CourseCard>((c) => ({
      id: c.id,
      badge: sentence(c.status),
      tone: toneFor[c.status] ?? "teal",
      title: c.title,
      subtitle: c.subtitle,
      mentor: c.mentor,
      points: c.outcomes,
      meta: [c.duration, `${c.learners} learners`],
      rating: c.rating,
      // No course pages exist yet; the live "View Course" button has no target.
      action: { label: "Ask about this course", href: contactHref(c.title) },
    })),
];

/* Gen-Mu'min: components/gen-mumin/gen-mumin-page.tsx */
export const genMumin = {
  eyebrow: "Project Gen-Mu'min",
  title: "Empowered Muslim children, not just educated children.",
  lede: "Gen Mumin helps children grow beyond ordinary learning into faith, character, leadership, Qur'an connection, and purposeful living.",
  href: "/projects/gen-mumin",
};
