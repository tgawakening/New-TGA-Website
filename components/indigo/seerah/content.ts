/* Sīrah course page content for the Indigo Geometry redesign. The course data
 * itself (topics, outcomes, videos, FAQs, markets, campaign) is imported from
 * components/seerah/course-config.ts, the live page's single source. Only the
 * copy that lives inline in the live components is repeated here, verbatim,
 * with its source noted, so the live /seerah stays untouched. */

export {
  activeCampaign,
  approach,
  courseConfig,
  learningOutcomes,
  topics,
  type FeePlan,
} from "@/components/seerah/course-config";

/* Live: components/indigo/landing/content.ts flagship (from the home page's
 * Sīrah promotion). The four pillars of the course title. */
export const pillars = ["The Law", "The Power", "The Leadership", "The Movement"] as const;

/* Live: components/seerah/seerah-page.tsx sectionLinks. */
export const sectionLinks = [
  ["overview", "Overview"],
  ["topics", "Topics"],
  ["course-details", "Course details"],
  ["fees", "Fees"],
  ["faqs", "FAQs"],
] as const;

/* Live: components/seerah/course-interactions.tsx methodSteps (text only;
 * labels match `approach` in course-config). */
export const methodSteps = [
  {
    label: "Report",
    title: "The report",
    text: "Every account begins with a source. The precise report stays distinct from later claims about it.",
  },
  {
    label: "Transmission",
    title: "Transmission & wording",
    text: "Transmission and variations in wording shape how a report is assessed.",
  },
  {
    label: "Context",
    title: "Historical context",
    text: "Geography, community and circumstances form the setting of an account.",
  },
  {
    label: "Perspectives",
    title: "Scholarly interpretations",
    text: "Scholarly readings can differ. Their reasoning belongs alongside their conclusions.",
  },
  {
    label: "Conclusions",
    title: "Conclusions & limits",
    text: "Evidence, uncertainty and the limits of modern comparisons remain visible together.",
  },
] as const;

/* Live: components/seerah/seerah-page.tsx headings and body copy. */
export const copy = {
  heroIntro:
    "Study the life of the Prophet ﷺ through his decisions, the community he built, and our responsibilities today.",
  learning: {
    eyebrow: "The learning",
    titleA: "More than a sequence",
    titleB: "of events.",
    lead: "Look closely at the decisions. Understand the setting. Consider the responsibilities.",
    body: "This course connects source examination with questions of law, power, leadership and movement. Explore what the evidence tells us and where careful interpretation begins.",
  },
  topics: {
    eyebrow: "Questions you’ll study",
    titleA: "Begin with a question.",
    titleB: "Go deeper into the sources.",
    intro: "Explore decisions, relationships and responsibilities. Each topic is an invitation to examine the evidence.",
  },
  details: {
    eyebrow: "Course details",
    titleA: "A considered way",
    titleB: "to study the Sīrah.",
    intro: "Move from the report to its setting, from interpretation to conclusions. Keep the evidence and its limits in view.",
  },
  fees: {
    eyebrow: "Regional fees",
    titleA: "Choose your way",
    titleB: "to begin.",
    intro:
      "Choose your country of residence to see the fees for your region. The 12-month programme includes live teaching, discussion and Q&A. Pay monthly or make one upfront payment.",
  },
  faqs: {
    eyebrow: "Before you begin",
    titleA: "A few things",
    titleB: "you may be wondering.",
    study:
      "Explore source examination, leadership, character, public communication, law, diplomacy and collective responsibility. Consider present-day applications with attention to differences in context.",
  },
  closing: {
    eyebrow: "Study with purpose",
    titleA: "Learn from the life.",
    titleB: "Reflect on your responsibility.",
  },
  sponsor: { href: "/support-our-mission?purpose=LEARNING_ACCESS#mission-giving", label: "Sponsor a Student" },
};
