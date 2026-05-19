export type StatItem = {
  label: string;
  value: string;
};

export type PropheticSlide = {
  title: string;
  subtitle: string;
  description: string;
  image: string;
  duration: string;
  sessions: string;
  fee: string;
  points: string[];
};

export type AkhiraPhase = {
  id: string;
  tab: string;
  title: string;
  subtitle: string;
  color: string;
  points: string[];
  next: string;
  stats: string[];
};

export type MuminsStep = {
  id: string;
  tab: string;
  title: string;
  subtitle: string;
  color: string;
  points: string[];
  next: string;
  stats: string[];
};

export type CourseItem = {
  id: string;
  title: string;
  subtitle: string;
  status: string;
  timeline: string;
  category: string;
  fee: string;
  description: string;
  outcomes: string[];
  track: string;
  mentor: string;
  duration: string;
  learners: string;
  rating: string;
  level: string;
  action: string;
  icon: string;
  iconMotion: "pulse" | "orbit" | "float" | "spin";
  accent: string;
};

export type UpcomingPoster = {
  id: string;
  title: string;
  audience: string;
  theme: string;
  status: string;
  image: string;
  accent: string;
};

export type NavItem = {
  label: string;
  href?: string;
  children?: Array<{ label: string; href: string }>;
};

export const navItems = [
  { label: "Home", href: "/" },
  {
    label: "Courses",
    children: [{ label: "Seerah:Prophetic Strategies", href: "/seerah" }],
  },
  {
    label: "Projects",
    children: [{ label: "Gen-Mumin Project", href: "/projects/gen-mumin" }],
  },
] satisfies NavItem[];

export const missionStats: StatItem[] = [
  { label: "Students", value: "200+" },
  { label: "Courses", value: "15+" },
  { label: "Countries", value: "10+" },
  { label: "Lessons", value: "1000+" },
];

export const missionPillars = [
  "Psychological Well-being",
  "Socio-political Development",
  "Economic Empowerment",
];

export const propheticSlides: PropheticSlide[] = [
  {
    title: "Intelligence & Community Protection",
    subtitle: "Every Saturday",
    description:
      "Discover how the Prophet Muhammad (PBUH) established sophisticated networks to safeguard the early Muslim community.",
    image: "/seerah%20slide-1.jpg",
    duration: "10 Months",
    sessions: "40+ Sessions",
    fee: "£20/month",
    points: [
      "Community safety",
      "Strategic networks",
      "Political wisdom",
      "Protective leadership",
    ],
  },
  {
    title: "Diplomacy, Treaties & Leadership",
    subtitle: "Live Interactive",
    description:
      "Explore how prophetic strategy balanced peace-making, long-term planning, and principled leadership under pressure.",
    image: "/seerah%20slide-2.jpg",
    duration: "8 Months",
    sessions: "32 Sessions",
    fee: "£18/month",
    points: [
      "Treaty frameworks",
      "Conflict de-escalation",
      "Coalition building",
      "Ethical statecraft",
    ],
  },
  {
    title: "System Building from Seerah",
    subtitle: "Project Labs",
    description:
      "Translate timeless prophetic methods into modern family, education, and community organizing blueprints.",
    image: "/seerah%20slide-3.jpg",
    duration: "6 Months",
    sessions: "24 Sessions",
    fee: "£15/month",
    points: [
      "Institution design",
      "Youth mentoring",
      "Community policy",
      "Impact execution",
    ],
  },
  {
    title: "Civilizational Thinking & Renewal",
    subtitle: "Cohort Journey",
    description:
      "Build a long-horizon mindset grounded in revelation with practical frameworks for movement-level impact.",
    image: "/seerah%20slide-4.jpg",
    duration: "12 Months",
    sessions: "52 Sessions",
    fee: "£25/month",
    points: [
      "Vision architecture",
      "Narrative power",
      "Collective discipline",
      "Sustainable growth",
    ],
  },
  {
    title: "Prophetic Planning Intensive",
    subtitle: "Capstone Track",
    description:
      "A hands-on capstone where learners design and present a full strategy document for real community change.",
    image: "/seerah%20slide-5.jpg",
    duration: "4 Months",
    sessions: "16 Sessions",
    fee: "£12/month",
    points: [
      "Strategic analysis",
      "Roadmap drafting",
      "KPI definition",
      "Mentor feedback",
    ],
  },
];

export const akhiraPhases: AkhiraPhase[] = [
  {
    id: "divine-bonds",
    tab: "Divine Bonds",
    title: "Divine Bonds",
    subtitle: "Marriage & Nikah",
    color: "rgb(80 152 245)",
    points: [
      "OCEAN + Islamic values assessment",
      "AI-powered compatibility matching",
      "Marriage preparation courses",
      "Family-involved process",
    ],
    next: "Islamic Parenting",
    stats: ["4 Phases", "28 Chapters", "116 Lessons"],
  },
  {
    id: "parenting",
    tab: "Parenting",
    title: "Nurturing Tomorrow",
    subtitle: "Islamic Parenting",
    color: "rgb(96 169 255)",
    points: [
      "Tarbiyah frameworks by age",
      "Faith-first home routines",
      "Digital safety and adab",
      "Parent support circles",
    ],
    next: "Nashrah",
    stats: ["3 Tracks", "21 Chapters", "84 Lessons"],
  },
  {
    id: "nashrah",
    tab: "Nashrah",
    title: "Healing & Expansion",
    subtitle: "Mental Clarity and Purpose",
    color: "rgb(57 120 214)",
    points: [
      "Inner purification path",
      "Emotional resilience tools",
      "Purpose mapping workshops",
      "Mentor-guided reflections",
    ],
    next: "Muslims LinkedIn",
    stats: ["5 Stages", "19 Chapters", "67 Lessons"],
  },
  {
    id: "muslims-linkedin",
    tab: "Muslims LinkedIn",
    title: "Ethical Professional Network",
    subtitle: "Ummah Career Ecosystem",
    color: "rgb(68 133 230)",
    points: [
      "Mission-based career paths",
      "Mentor and employer network",
      "Portfolio + skill visibility",
      "Halal growth opportunities",
    ],
    next: "Leadership Pathways",
    stats: ["2 Paths", "12 Chapters", "45 Lessons"],
  },
];

export const muminsSteps: MuminsStep[] = [
  {
    id: "seerah",
    tab: "Seerah",
    title: "The Prophet's Seerah",
    subtitle: "Stories of Our Beloved Prophet",
    color: "rgb(106 173 255)",
    points: [
      "Birth & early life",
      "Hijrah to Madinah",
      "Prophethood and revelation",
      "Key events and battles",
    ],
    next: "Arabic",
    stats: ["24+ Lessons", "50+ Activities", "4.9 Rating"],
  },
  {
    id: "arabic",
    tab: "Arabic",
    title: "Arabic in 40 Days",
    subtitle: "From Foundation to Fluency",
    color: "rgb(88 160 245)",
    points: [
      "Letter and sound mastery",
      "Grammar and sentence structure",
      "Conversation drills",
      "Quranic vocabulary",
    ],
    next: "Tajweed",
    stats: ["40 Days", "90+ Activities", "4.8 Rating"],
  },
  {
    id: "tajweed",
    tab: "Tajweed",
    title: "Quran Recitation Mastery",
    subtitle: "Beauty, Rules and Precision",
    color: "rgb(126 190 255)",
    points: [
      "Makharij and sifaat",
      "Rules of noon and meem",
      "Rhythm and flow training",
      "Live recitation feedback",
    ],
    next: "Leadership",
    stats: ["30 Lessons", "70+ Practices", "4.9 Rating"],
  },
  {
    id: "leadership",
    tab: "Leadership",
    title: "Character-Centered Leadership",
    subtitle: "Build the Servant-Leader Mindset",
    color: "rgb(78 146 230)",
    points: [
      "Leadership in prophetic lens",
      "Public communication",
      "Teamwork and responsibility",
      "Service and impact projects",
    ],
    next: "Real-world Projects",
    stats: ["20 Lessons", "12 Projects", "4.9 Rating"],
  },
];

export const courses: CourseItem[] = [
  {
    id: "arabic-40-b3",
    status: "ENROLLING NOW",
    timeline: "Batch 3",
    category: "Arabic",
    fee: "£50",
    title: "Arabic in 40 Days (Batch 3)",
    subtitle: "Next Intensive Cohort",
    description: "Accelerated speaking track focused on practical grammar and daily conversation.",
    outcomes: [
      "Essential grammar foundations",
      "Daily conversations practice",
      "Reading comprehension",
    ],
    track: "Next Intensive Cohort",
    mentor: "Ustadh Bilal",
    duration: "40 hours",
    learners: "8+",
    rating: "4.9",
    level: "Beginner",
    action: "View Course",
    icon: "🗣",
    iconMotion: "orbit",
    accent: "rgb(67 142 255)",
  },
  {
    id: "advance-arabic",
    status: "ENROLLING NOW",
    timeline: "6 Months",
    category: "Arabic",
    fee: "£180",
    title: "Advance Arabic Course",
    subtitle: "From Foundation to Fluency",
    description: "Structured fluency program for confident Arabic communication and text understanding.",
    outcomes: [
      "Advanced Arabic grammar and structure",
      "Confident communication in everyday communication",
      "Reading and understanding Islamic texts",
    ],
    track: "From Foundation to Fluency",
    mentor: "Ustadh Bilal",
    duration: "6 Months",
    learners: "10+",
    rating: "4.9",
    level: "Intermediate",
    action: "View Course",
    icon: "📚",
    iconMotion: "float",
    accent: "rgb(135 103 255)",
  },
  {
    id: "seerah-kids",
    status: "FREE",
    timeline: "Live",
    category: "Foundations",
    fee: "FREE",
    title: "Seerah Course for Kids",
    subtitle: "A fun & engaging journey",
    description: "Build identity and love for Islam through stories, duas, and practical routines.",
    outcomes: [
      "The inspiring stories of the prophets",
      "The names of Allah and their meanings",
      "Essential duas for daily life",
    ],
    track: "Stories from Seerah",
    mentor: "Ustadh Ahmad",
    duration: "Ongoing",
    learners: "13+",
    rating: "4.9",
    level: "Beginner",
    action: "View Course",
    icon: "🌱",
    iconMotion: "pulse",
    accent: "rgb(24 193 118)",
  },
  {
    id: "prophetic-strategy",
    status: "IN PROGRESS",
    timeline: "Cohort",
    category: "Leadership",
    fee: "£20/mo",
    title: "Prophetic Strategies and Planning Course",
    subtitle: "Leadership from Seerah",
    description: "Deep dive into prophetic governance, foresight, and decision frameworks.",
    outcomes: [
      "In-depth Seerah study",
      "Pre-Islamic Arabia context",
      "Makkan period analysis",
    ],
    track: "Leadership from Seerah",
    mentor: "Sheikh Abdullah",
    duration: "Ongoing",
    learners: "61+",
    rating: "4.9",
    level: "Advanced",
    action: "View Course",
    icon: "🧭",
    iconMotion: "spin",
    accent: "rgb(245 167 28)",
  },
  {
    id: "arabic-40-b2",
    status: "COMPLETED",
    timeline: "Batch 2",
    category: "Arabic",
    fee: "£50",
    title: "Arabic in 40 Days (Batch 2)",
    subtitle: "Intensive Arabic Program",
    description: "Completed cohort with class recordings and guided practice support.",
    outcomes: [
      "Essential grammar foundations",
      "Daily conversations practice",
      "Reading comprehension",
    ],
    track: "Intensive Arabic Program",
    mentor: "Ustadh Bilal",
    duration: "40 hours",
    learners: "47+",
    rating: "4.8",
    level: "Beginner",
    action: "Get Recordings",
    icon: "✅",
    iconMotion: "pulse",
    accent: "rgb(34 205 121)",
  },
];

export const upcomingCourses: UpcomingPoster[] = [
  {
    id: "building-community-1",
    title: "Building Relationships with Community",
    audience: "All ages",
    theme: "Community connection",
    status: "Launching soon",
    image: "/upcoming-building-community-1.jpeg",
    accent: "rgb(60 154 103)",
  },
  {
    id: "building-community-2",
    title: "Building Relationships with Community",
    audience: "All ages",
    theme: "Build trust",
    status: "Launching soon",
    image: "/upcoming-building-community-2.jpeg",
    accent: "rgb(78 161 98)",
  },
  {
    id: "emotional-intelligence",
    title: "Emotional Intelligence Program",
    audience: "Age 6-14",
    theme: "Empathy and confidence",
    status: "Launching soon",
    image: "/upcoming-emotional-intelligence.jpeg",
    accent: "rgb(37 195 156)",
  },
  {
    id: "critical-thinking",
    title: "Critical Thinking Program",
    audience: "Age 6-25",
    theme: "Reasoning and decisions",
    status: "Launching soon",
    image: "/upcoming-critical-thinking.jpeg",
    accent: "rgb(42 142 86)",
  },
  {
    id: "building-community-3",
    title: "Building Relationships with Community",
    audience: "All ages",
    theme: "Stronger communities",
    status: "Launching soon",
    image: "/upcoming-building-community-3.jpeg",
    accent: "rgb(60 154 103)",
  },
  {
    id: "ethics-of-debate",
    title: "Ethics of Debate",
    audience: "Age 10+",
    theme: "Respectful dialogue",
    status: "Launching soon",
    image: "/upcoming-ethics-of-debate.jpeg",
    accent: "rgb(67 161 105)",
  },
];
