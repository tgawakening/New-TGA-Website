export type PolicySection = {
  title: string;
  body?: string;
  bullets?: string[];
};

export type PolicyPageContent = {
  slug: string;
  title: string;
  eyebrow: string;
  updated?: string;
  intro: string;
  sections: PolicySection[];
};

export const policies = [
  {
    slug: "terms-and-conditions",
    title: "Terms & Conditions",
    eyebrow: "Legal",
    updated: "Effective 1 January 2025",
    intro:
      "These terms govern access to Global Awakening Ltd websites, services, courses, learning materials, and related community features.",
    sections: [
      {
        title: "About Global Awakening",
        body:
          "Global Awakening Ltd is registered in England and Wales under company number 15523255. Registered office: 128 City Road, London, EC1V 2NX, United Kingdom.",
      },
      {
        title: "Using the Platform",
        bullets: [
          "Use the platform lawfully, ethically, and in a way that respects the mission of Global Awakening.",
          "Provide accurate registration information and keep your account credentials confidential.",
          "Do not disrupt the platform, attempt unauthorised access, upload malicious software, or share false, offensive, misleading, or illegal content.",
        ],
      },
      {
        title: "Accounts and Access",
        bullets: [
          "Some features require an account. You are responsible for activity under your account.",
          "Notify us promptly if you suspect unauthorised access.",
          "We may suspend or terminate access if these terms are violated or if the platform is misused.",
        ],
      },
      {
        title: "Course Materials and Intellectual Property",
        bullets: [
          "Course materials, videos, text, graphics, and platform content belong to Global Awakening Ltd or its licensors.",
          "Learners receive a limited, non-transferable licence for personal, non-commercial study.",
          "Do not reproduce, distribute, modify, resell, share access to, or remove notices from course materials without permission.",
        ],
      },
      {
        title: "Payments and Refunds",
        body:
          "Course fees must be paid according to the selected payment plan. Refunds and course credits are handled under the Refund Policy. Payments are processed through secure third-party providers, and we do not store card details.",
      },
      {
        title: "User-Generated Content",
        bullets: [
          "You remain responsible for content you post, upload, submit, or share through the platform.",
          "You must not post harassment, hate speech, copyright-infringing material, spam, or false or deceptive information.",
          "We may remove content that violates these standards.",
        ],
      },
      {
        title: "Liability and Service Availability",
        body:
          "We work to provide reliable, high-quality learning experiences, but we do not guarantee specific learning outcomes, career results, uninterrupted access, or freedom from technical disruption. To the fullest extent permitted by law, Global Awakening Ltd is not responsible for losses caused by platform use, third-party links, technical issues, or unforeseen data loss.",
      },
      {
        title: "Governing Law and Contact",
        body:
          "These terms are governed by the laws of England and Wales. Questions can be sent to Enquiries.awakeningteam@outlook.com.",
      },
    ],
  },
  {
    slug: "terms-of-service",
    title: "Terms of Service",
    eyebrow: "Service Use",
    intro:
      "These service terms explain the rules for using Global Awakening learning services, including website access, course enrolment, subscriptions or instalment plans where offered, and community features.",
    sections: [
      {
        title: "Acceptance of Terms",
        body:
          "By accessing or using Global Awakening services, you agree to follow these terms. If you do not agree, you should not use the services.",
      },
      {
        title: "Subscriptions and Payment Plans",
        bullets: [
          "Some services may be billed monthly, annually, or through a structured payment plan.",
          "Where recurring payments apply, billing continues for the agreed period unless cancellation is available under the relevant course or refund policy.",
          "Instalment plans are provided for convenience and may still require completion of the agreed fee after the refund window closes.",
        ],
      },
      {
        title: "Fee Changes",
        body:
          "Global Awakening may update fees for future cohorts, courses, or services. Any change will be communicated through the relevant course or checkout information before it applies to a new purchase or renewal.",
      },
      {
        title: "Intellectual Property",
        body:
          "The service, original course content, learning resources, design, and platform features remain the property of Global Awakening Ltd or its licensors. They may not be copied or reused without written consent.",
      },
      {
        title: "Third-Party Links",
        body:
          "The platform may include links to external websites or third-party services. Global Awakening does not control those sites and is not responsible for their content, privacy practices, or availability.",
      },
      {
        title: "Termination",
        body:
          "We may suspend or terminate access if a user breaches these terms, misuses the service, or acts in a way that harms learners, staff, teachers, or the platform.",
      },
      {
        title: "Limitation of Liability",
        body:
          "To the fullest extent permitted by law, Global Awakening Ltd, its directors, staff, partners, teachers, suppliers, and affiliates are not liable for indirect, incidental, special, consequential, or punitive damages arising from use of the service.",
      },
    ],
  },
  {
    slug: "code-of-conduct",
    title: "Code of Conduct",
    eyebrow: "Community Standards",
    intro:
      "Global Awakening is a faith-driven collaborative platform. Users are expected to help build a respectful, Sharia-aligned learning environment that supports beneficial work for this world and the Akhirah.",
    sections: [
      {
        title: "Respect the Platform Vision",
        bullets: [
          "Participate in ways that respect the mission of establishing good, faith-aligned systems and projects.",
          "Projects, collaborations, and interactions should remain aligned with the values of Global Awakening.",
          "Persistent misalignment may lead to restricted access or removal.",
        ],
      },
      {
        title: "Privacy and Boundaries",
        bullets: [
          "Respect the privacy, comfort, and personal boundaries of all users.",
          "Observe any separate spaces or boundaries created for male and female users.",
          "Do not share another person's personal information without explicit permission.",
        ],
      },
      {
        title: "Professional Collaboration",
        bullets: [
          "Work with kindness, integrity, patience, and respect.",
          "Handle differences constructively and avoid gossip, harassment, or disrespectful behaviour.",
          "Serious or repeated misconduct may lead to account suspension or removal.",
        ],
      },
      {
        title: "Sharia-Aligned Content Standards",
        body:
          "Content shared on the platform should reflect Islamic values and the mission of Global Awakening. Offensive, inappropriate, or non-aligned content may be removed and may result in warnings or access restrictions.",
      },
      {
        title: "Intellectual Property and Confidentiality",
        bullets: [
          "Respect the work and ideas of other users, teachers, and collaborators.",
          "Do not claim, copy, or reuse another person's work without permission.",
          "Handle personal, project, and platform information with care and confidentiality.",
        ],
      },
      {
        title: "Financial Dealings Outside TGA",
        body:
          "TGA does not endorse financial dealings outside the TGA platform between parties connected through the platform. Students, teachers, and users should avoid any conduct that could create financial misconduct or confusion.",
      },
      {
        title: "Consequences",
        body:
          "Violations may result in reminders, warnings, restricted access, suspension, or permanent removal, depending on severity and repetition.",
      },
    ],
  },
  {
    slug: "refund-policy",
    title: "Refund Policy",
    eyebrow: "Student Support",
    updated: "Last updated 12 February 2025",
    intro:
      "This policy explains refund eligibility for Global Awakening Ltd courses and is designed to keep course enrolment transparent and fair.",
    sections: [
      {
        title: "Short-Term Courses",
        bullets: [
          "For online courses lasting 3 to 12 months, students may request a 100% refund before the course start date.",
          "A 100% refund is also available within 14 days of the course start date.",
          "After 14 days, no refund is available. Monthly instalments remain due because the plan is not a subscription cancellation service.",
        ],
      },
      {
        title: "Short-Term Exceptions",
        body:
          "After the 14-day period, exceptional circumstances may be considered for a 50% course credit valid for one year. Requests must be submitted in writing and are subject to academic administration approval within four weeks.",
      },
      {
        title: "Long-Term Courses",
        bullets: [
          "For courses lasting 1 to 8 years, a 100% refund is available before the relevant semester start date.",
          "A 100% refund is available within the first 28 days of the semester.",
          "After 28 days, no refund is available and outstanding semester fees remain due.",
          "Students who do not wish to continue into the next semester must request cancellation before that semester begins.",
        ],
      },
      {
        title: "Self-Paced Courses",
        bullets: [
          "A full refund is available within 7 days of enrolment.",
          "No refund is available after 7 days.",
          "Exceptional cases may be considered for a 50% course credit valid for one year.",
        ],
      },
      {
        title: "How to Request a Refund",
        bullets: [
          "Email Enquiries.awakeningteam@outlook.com with your name, course details, and reason for the refund request.",
          "Approved refunds are processed within 7 to 14 working days.",
          "Refunds are returned to the original payment method and may take 1 to 2 billing cycles to appear.",
        ],
      },
      {
        title: "Donation Option",
        body:
          "Students may choose to donate an eligible refund to the Global Awakening Scholarship Fund by requesting a donation transfer in writing.",
      },
      {
        title: "Need Help?",
        body:
          "For questions, contact Enquiries.awakeningteam@outlook.com or WhatsApp +44 7886 398150.",
      },
    ],
  },
] satisfies PolicyPageContent[];

export function getPolicyBySlug(slug: string) {
  return policies.find((policy) => policy.slug === slug);
}
