import { regionalFees } from "./regional-fees";

/** Only approved Beyond Chronology facts belong here. Null fields stay unpublished. */
export type Artwork = {
  src: string;
  alt: string;
  width: number;
  height: number;
  clean?: boolean;
};
export type CourseVideo = {
  title: string;
  src: string;
  poster: Artwork;
  captions: string;
  width: number;
  height: number;
};
export type FeePlan = {
  amount: number;
  currency: string;
  frequency: string;
  method: string;
  total: string | null;
  checkoutUrl: string | null;
};
export type Market = {
  code: string;
  name: string;
  monthly: FeePlan | null;
  annual: FeePlan | null;
  manualMonthly?: FeePlan;
  onlineRecurringVerified?: boolean;
  terms: string | null;
};
export type Topic = {
  title: string;
  theme: string;
  question: string;
  focus: string;
  detail: string;
  artwork: Artwork | null;
};

export const courseConfig: {
  campaign: {
    mode: "orientation" | "enrolment";
    orientationEndsAt: string;
    whatsappUrl: string;
    enrolmentUrl: string | null;
  };
  orientation: {
    date: string;
    duration: string;
    times: { time: string; region: string }[];
  };
  hero: Artwork | null;
  socialImage: Artwork | null;
  videos: CourseVideo[];
  essentials: string[];
  curriculum: { title: string; topics: string[] }[];
  instructor: { name: string; bio: string; portrait: Artwork } | null;
  features: string[];
  faqs: { question: string; answer: string }[];
  markets: Market[];
  feeSupportUrl: string;
  checkoutEnabled: boolean;
} = {
  campaign: {
    mode: "orientation",
    orientationEndsAt: "2026-11-07T16:00:00Z",
    // Course WhatsApp destination retained from /seerah for orientation and enquiries.
    whatsappUrl: "https://chat.whatsapp.com/EXcZmIOG9c8LOSdjK7KMko",
    enrolmentUrl: null,
  },
  orientation: {
    date: "Saturday, 7 November 2026",
    duration: "One hour",
    times: [
      { time: "3 PM", region: "UK" },
      { time: "6 PM", region: "Saudi Arabia" },
      { time: "8 PM", region: "Pakistan" },
    ],
  },
  // Insert the supplied SECOND banner here once its original file is available.
  hero: null,
  socialImage: null,
  // The existing video promotes the previous course. Do not publish it for this campaign.
  videos: [],
  essentials: ["12-month programme", "Live teaching", "Discussion & Q&A"],
  curriculum: [],
  instructor: null,
  features: ["Live teaching", "Discussion and Q&A"],
  faqs: [
    {
      question: "How long is the course?",
      answer:
        "This is a 12-month live learning programme, with discussion and Q&A.",
    },
    {
      question: "What are the payment options?",
      answer:
        "The approved fee plans offer monthly payments or one annual upfront payment for 12 months. Annual fees are approximately 10% less than 12 online monthly payments. Payment availability and final terms will be confirmed before enrolment opens.",
    },
  ],
  markets: regionalFees,
  feeSupportUrl: "/seerah/fee-waiver",
  // Enable only after payment links, terms and provider setup are approved.
  checkoutEnabled: false,
};

export const learningOutcomes = [
  {
    title: "Read beyond the report",
    text: "Assess reports through sources and historical context. Practise asking where an account comes from and what surrounds it.",
  },
  {
    title: "Understand leadership",
    text: "Examine leadership, character and public communication through decisions and relationships.",
  },
  {
    title: "Explore collective responsibility",
    text: "Study law, diplomacy and collective responsibility, considering how a community acts together.",
  },
  {
    title: "Connect with care",
    text: "Consider present-day applications with attention to differences in context and the limits of comparison.",
  },
];
export const approach = [
  "Identify the report",
  "Examine transmission and wording",
  "Read the historical context",
  "Compare scholarly interpretations",
  "Discuss conclusions and limits",
];
export const topics: Topic[] = [
  {
    title: "Dār al-Arqam",
    theme: "Education · Character · Community",
    question:
      "What were the early Muslims building when they gathered to learn?",
    focus: "Explore education, character and community formation.",
    detail:
      "Examine accounts of early gatherings and consider the relationship between learning, personal formation and a growing community. Read reports in their historical setting before drawing comparisons with today.",
    artwork: null,
  },
  {
    title: "Ṣafwān ibn Umayyah",
    theme: "Generosity · Trust · Influence",
    question: "How did generosity help change a relationship?",
    focus:
      "Examine generosity, trust and influence in their historical context.",
    detail:
      "Compare the wording and context of reports about generosity and changing relationships. Discuss what a report supports, what remains uncertain and how scholarly interpretations differ.",
    artwork: null,
  },
  {
    title: "Al-Aḥzāb",
    theme: "Preparation · Geography · Collective effort",
    question: "What does preparing under pressure require?",
    focus: "Consider preparation, geography and collective effort.",
    detail:
      "Read accounts of preparation alongside their geographical and historical context. Consider coordination, shared responsibility and the limits of applying a past event to a different situation.",
    artwork: null,
  },
  {
    title: "Mercy and accountability",
    theme: "Character · Responsibility",
    question: "How should we read mercy alongside accountability?",
    focus: "Examine how context shapes the interpretation of a decision.",
    detail:
      "Identify the report, examine its transmission and wording, and compare scholarly interpretations. Distinguish what the source says from conclusions drawn about it.",
    artwork: null,
  },
  {
    title: "Tribal alliances",
    theme: "Diplomacy · Relationships",
    question: "What responsibilities came with an alliance?",
    focus:
      "Explore relationships and obligations within their historical setting.",
    detail:
      "Study reports about alliances in the social setting of their time. Consider the obligations described by the sources and the limits of comparisons with present-day institutions.",
    artwork: null,
  },
  {
    title: "Dār al-Nadwa",
    theme: "Influence · Public decisions",
    question: "How did influence shape collective decisions?",
    focus: "Examine reports about influence and public decision-making.",
    detail:
      "Ask which sources describe an event, how the accounts differ and what historical context helps explain them. Treat disputed accounts as questions for examination.",
    artwork: null,
  },
  {
    title: "The flock between two mountains",
    theme: "Generosity · Source examination",
    question: "What can this account tell us about generosity?",
    focus: "Read the account with attention to wording and interpretation.",
    detail:
      "Keep the report, its reference and explanatory context together during study. Compare interpretations before drawing conclusions about its meaning or contemporary application.",
    artwork: null,
  },
  {
    title: "Seerah Doubts · I",
    theme: "Questions · Sources · Context",
    question: "How do we investigate a disputed report?",
    focus: "Practise separating a claim from its supporting evidence.",
    detail:
      "Begin with the precise claim and its source. Examine transmission, wording and historical context, then compare scholarly interpretations and discuss the limits of the available evidence.",
    artwork: null,
  },
  {
    title: "Seerah Doubts · II",
    theme: "Interpretation · Evidence · Limits",
    question: "What changes when we read an account in context?",
    focus: "Consider how evidence and context inform a careful conclusion.",
    detail:
      "Compare the question being asked with what the evidence can establish. Avoid treating a disputed report as a settled fact.",
    artwork: null,
  },
];

export function activeCampaign(now = Date.now()) {
  return courseConfig.campaign.mode === "orientation" &&
    now < Date.parse(courseConfig.campaign.orientationEndsAt)
    ? "orientation"
    : "enrolment";
}
