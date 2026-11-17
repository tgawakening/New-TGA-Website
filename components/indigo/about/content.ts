/* About content for the Indigo Geometry redesign. Every string is the live
 * site's own: app/about/page.tsx (hero, story, pillars, pathways) and
 * components/home/data.ts (stats, courses, mission pillars, via the landing's
 * content module). Nothing here is invented copy. */
import { courses } from "@/components/home/data";

export { stats, visionMission } from "../landing/content";

export const aboutHero = {
  eyebrow: "About Global Awakening",
  titleA: "Faith-led learning for a",
  titleB: "global Ummah.",
  lede: "Global Awakening is a faith-driven learning platform and community helping Muslims grow through revelation-grounded education, meaningful projects, and supportive collaboration.",
  note: { title: "Faith-led learning", body: "For students, families, and future community builders." },
};

/* The story: the live "What We Are Building" block. Its three pillars become
 * the first three chapters; its paragraph is the fourth, where the figure
 * completes. Each chapter adds one layer to the same geometry. */
export const story = {
  eyebrow: "What we are building",
  titleA: "Education that connects belief with",
  titleB: "confident action.",
  chapters: [
    {
      key: "revelation",
      label: "Revelation",
      text: "Learning begins with Qur'an, Seerah, adab, and a clear Islamic worldview.",
    },
    {
      key: "leadership",
      label: "Leadership",
      text: "Students are guided to think, plan, serve, and lead with responsibility.",
    },
    {
      key: "action",
      label: "Action",
      text: "Courses and projects turn knowledge into family, community, and Ummah benefit.",
    },
    {
      key: "direction",
      label: "One shared direction",
      text: "The platform brings together live courses, youth tracks, Seerah strategy, social projects, student support, and community spaces with one shared direction: learning that serves deen and prepares people for beneficial work.",
    },
  ],
} as const;

/* Pathways: the same four courses and links as the live About page. */
export const pathways = courses.slice(0, 4).map((c) => ({
  id: c.id,
  category: c.category,
  title: c.title,
  href: c.id === "prophetic-strategy" ? "/seerah" : null, // null: the home page's #courses
}));

/* Closing call: the live community line (components/home/sections). */
export const aboutCta = {
  title: "Join our growing community",
  body: "Be part of a global movement to unite Muslims through faith, knowledge, and compassion.",
};
