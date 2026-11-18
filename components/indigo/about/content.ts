/* About content for the Indigo Geometry redesign: the page's marketing copy.
 * The numbers are not repeated here; they come from the live site's own stats
 * (components/home/data.ts, via the landing's content module). */
export { stats } from "../landing/content";

export const aboutHero = {
  eyebrow: "Our story",
  titleA: "A generation is",
  titleB: "waking up.",
  lede: "We exist to raise Muslims who lead with their faith, grounded in revelation, equipped to build, serve, and shape the world.",
};

export const whyWeExist = {
  eyebrow: "Why we exist",
  titleA: "Faith was never meant to be",
  titleB: "passive.",
  body: "Too often Islam is inherited as ritual and left there. We see revelation as a blueprint, for leaders, for families, for a Ummah that builds rather than watches. This is where that belief turns into action.",
};

/* Each pillar adds one layer to the same geometry (see story.tsx). */
export const story = {
  eyebrow: "What we are building",
  titleA: "Three pillars.",
  titleB: "One Ummah that leads.",
  pillars: [
    {
      key: "education",
      label: "Education",
      text: "We teach the Sīrah not as dates to memorise but as a method for leadership, power and change. Live, not recorded.",
    },
    {
      key: "projects",
      label: "Projects",
      text: "Through Gen-Mu'min we equip the next generation from the ground up: marriage, parenting, homeschooling and more.",
    },
    {
      key: "community",
      label: "Community",
      text: "A global family of learners carrying each other toward the Akhirah.",
    },
  ],
} as const;

export const difference = {
  eyebrow: "The difference",
  titleA: "Not another",
  titleB: "course library.",
  points: [
    { lead: "Live teaching", rest: "instead of a shelf of recordings." },
    { lead: "A method", rest: "instead of a syllabus." },
    { lead: "A community", rest: "that learns with purpose and holds each other to it." },
  ],
};

export const invitation = {
  titleA: "This is your",
  titleB: "awakening",
  titleC: "too.",
  body: "Wherever you are in the world, there's a place for you here.",
};
