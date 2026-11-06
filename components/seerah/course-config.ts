import { regionalFees } from "./regional-fees";

/** Only approved Beyond Chronology facts belong here. Null fields stay unpublished. */
export type Artwork = {
  src: string;
  alt: string;
  width: number;
  height: number;
  clean?: boolean;
  position?: string;
};
export type CourseVideo = {
  title: string;
  src: string;
  poster: Artwork;
  captions?: string;
  language: "en" | "ur";
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
  reflection: string;
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
  hero: {
    src: "/Seerah new/hero banner page.png",
    alt: "A learner entering a stone doorway in warm evening light",
    width: 1672,
    height: 941,
  },
  socialImage: {
    src: "/Seerah new/hero banner home.png",
    alt: "A learner approaching an ancient doorway",
    width: 1942,
    height: 809,
  },
  // Web copies derived from the verified 4K Git LFS originals; full vertical frame retained.
  videos: [
    {
      language: "en",
      title: "Course overview · English",
      src: "/videos/sirah-preview-en.mp4",
      poster: {
        src: "/videos/sirah-preview-en.jpg",
        alt: "English course overview",
        width: 720,
        height: 1280,
      },
      width: 720,
      height: 1280,
    },
    {
      language: "ur",
      title: "Course overview · اردو",
      src: "/videos/sirah-preview-ur.mp4",
      poster: {
        src: "/videos/sirah-preview-ur.jpg",
        alt: "Urdu course overview",
        width: 720,
        height: 1280,
      },
      width: 720,
      height: 1280,
    },
  ],
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
    reflection:
      "How might learning shape the responsibilities you carry in your community?",
    artwork: {
      src: "/Seerah new/Learner at the ancient doorway-2.png",
      alt: "A learner at an ancient stone doorway",
      width: 1586,
      height: 992,
      clean: true,
      position: "center",
    },
  },
  {
    title: "Ṣafwān ibn Umayyah",
    theme: "Generosity · Trust · Influence",
    question: "How did generosity help change a relationship?",
    focus:
      "Examine generosity, trust and influence in their historical context.",
    detail:
      "Compare the wording and context of reports about generosity and changing relationships. Discuss what a report supports, what remains uncertain and how scholarly interpretations differ.",
    reflection:
      "What helps trust develop when people have different starting points?",
    artwork: {
      src: "/Seerah new/Desert caravan at golden hour-8.png",
      alt: "A desert caravan in golden light",
      width: 1586,
      height: 992,
      clean: true,
      position: "center",
    },
  },
  {
    title: "Al-Aḥzāb",
    theme: "Preparation · Geography · Collective effort",
    question: "What does preparing under pressure require?",
    focus: "Consider preparation, geography and collective effort.",
    detail:
      "Read accounts of preparation alongside their geographical and historical context. Consider coordination, shared responsibility and the limits of applying a past event to a different situation.",
    reflection:
      "How do you prepare and share responsibility under pressure today?",
    artwork: {
      src: "/Seerah new/Dusty Trench Preparations-6.png",
      alt: "People preparing a trench together",
      width: 1586,
      height: 992,
      clean: true,
      position: "center",
    },
  },
  {
    title: "Mercy and accountability",
    theme: "Character · Responsibility",
    question: "How should we read mercy alongside accountability?",
    focus: "Examine how context shapes the interpretation of a decision.",
    detail:
      "Identify the report, examine its transmission and wording, and compare scholarly interpretations. Distinguish what the source says from conclusions drawn about it.",
    reflection:
      "What context would you need before judging a difficult decision?",
    artwork: {
      src: "/Seerah new/Backlit cloaked figure on rocky ridge-5.png",
      alt: "A backlit cloaked figure on a rocky ridge",
      width: 1586,
      height: 992,
      clean: true,
      position: "center",
    },
  },
  {
    title: "Tribal alliances",
    theme: "Diplomacy · Relationships",
    question: "What responsibilities came with an alliance?",
    focus:
      "Explore relationships and obligations within their historical setting.",
    detail:
      "Study reports about alliances in the social setting of their time. Consider the obligations described by the sources and the limits of comparisons with present-day institutions.",
    reflection:
      "What obligations should you consider before entering a partnership?",
    artwork: {
      src: "/Seerah new/Golden Caravan Crossing Dusty Horizons-1.png",
      alt: "A caravan crossing dusty horizons",
      width: 1586,
      height: 992,
      clean: true,
      position: "center",
    },
  },
  {
    title: "Dār al-Nadwa",
    theme: "Influence · Public decisions",
    question: "How did influence shape collective decisions?",
    focus: "Examine reports about influence and public decision-making.",
    detail:
      "Ask which sources describe an event, how the accounts differ and what historical context helps explain them. The smartphone is a modern comparison about public influence, not a historical object or a claim that today’s platforms directly match Dār al-Nadwa.",
    reflection:
      "How do today’s communication platforms influence public discussion, and where does the comparison stop?",
    artwork: {
      src: "/Seerah new/Robed Council by Lamplight, Modern Smartphone-10.png",
      alt: "A council scene juxtaposed with a modern smartphone",
      width: 1586,
      height: 992,
      clean: true,
      position: "center",
    },
  },
  {
    title: "The flock between two mountains",
    theme: "Generosity · Source examination",
    question: "What can this account tell us about generosity?",
    focus: "Read the account with attention to wording and interpretation.",
    detail:
      "Keep the report, its reference and explanatory context together during study. Compare interpretations before drawing conclusions about its meaning or contemporary application.",
    reflection:
      "What questions should guide how resources are offered and received?",
    artwork: {
      src: "/Seerah new/Flock and camels at sunrise-4.png",
      alt: "A flock and camels at sunrise",
      width: 1586,
      height: 992,
      clean: true,
      position: "center",
    },
  },
  {
    title: "The first-revelation report",
    theme: "Questions · Sources · Context",
    question: "How do we investigate a disputed report?",
    focus: "Practise separating a claim from its supporting evidence.",
    detail:
      "Begin with the precise claim and its source. Examine transmission, wording and historical context, then compare scholarly interpretations and discuss the limits of the available evidence.",
    reflection:
      "How would you separate a repeated claim from the evidence supporting it?",
    artwork: {
      src: "/Seerah new/Ancient Makkah from rocky heights-7.png",
      alt: "Ancient Makkah viewed from rocky heights",
      width: 1586,
      height: 992,
      clean: true,
      position: "center",
    },
  },
  {
    title: "Women, children and warfare ethics",
    theme: "Interpretation · Evidence · Limits",
    question:
      "How do we examine reports about women, children and warfare ethics?",
    focus: "Consider how evidence and context inform a careful conclusion.",
    detail:
      "Examine wording, historical context and scholarly interpretation before drawing conclusions about warfare ethics. The image is a thematic illustration, not a depiction of a documented event.",
    reflection:
      "How can careful source reading inform a discussion of responsibility toward vulnerable people?",
    artwork: {
      src: "/Seerah new/Mothers and Children in Golden Light-9.png",
      alt: "A thematic illustration of mothers and children in warm light",
      width: 1942,
      height: 809,
      clean: true,
      position: "60% center",
    },
  },
  {
    title: "Skills and responsibility",
    theme: "Contemporary reflection · Practical skills",
    question: "How can practical skills serve a responsibility?",
    focus: "Reflect on learning, useful skills and responsible choices today.",
    detail:
      "This contemporary illustration opens a reflection on skills and responsibility. It does not depict a Sīrah event or establish a direct historical equivalence. Consider the evidence and limits of any comparison.",
    reflection:
      "Which skills could you develop, and what responsibilities come with using them?",
    artwork: {
      src: "/Seerah new/Student prepares a drone for repair-3.png",
      alt: "A student preparing a drone for repair, a contemporary illustration",
      width: 1586,
      height: 992,
      clean: true,
    },
  },
];

export function activeCampaign(now = Date.now()) {
  return courseConfig.campaign.mode === "orientation" &&
    now < Date.parse(courseConfig.campaign.orientationEndsAt)
    ? "orientation"
    : "enrolment";
}

// Public enquiry/update groups: visitors may join before registering.
// These are independent of the protected, post-payment course invitations.
export const publicCourseGroups = {
  pakistan: "https://chat.whatsapp.com/Hhs5PieBzen7YvYnkLF9Fo",
  overseas: "https://chat.whatsapp.com/Ghr9XgXpncIIFYuWcs45oI",
};
export function publicCourseGroup(country: string) {
  return country === "PK"
    ? publicCourseGroups.pakistan
    : publicCourseGroups.overseas;
}
