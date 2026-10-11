export const fundingAreas = [
  { id: "LEARNING_ACCESS", title: "Scholarships & Access", copy: "Help students in need access Islamic education, wherever they live.", graphic: "scholarships" },
  { id: "SEERAH_LEADERSHIP", title: "Seerah & Leadership", copy: "Help learners build character and leadership through Prophetic guidance.", graphic: "seerah" },
  { id: "LEARNING_RESOURCES", title: "Resources for Learning", copy: "Help teachers create materials and deliver meaningful online lessons.", graphic: "resources" },
] as const;

export const learningPrinciples = [
  { icon: "book", title: "Knowledge with understanding", copy: "Connect Qur’an and Seerah learning with thoughtful reflection." },
  { icon: "heart", title: "Character through practice", copy: "Bring learning into everyday choices, habits and relationships." },
  { icon: "people", title: "Leadership with responsibility", copy: "Develop the skills to contribute thoughtfully to family and community." },
] as const;

export const contributionStages = [
  { icon: "heart", title: "Your contribution", copy: "Help fund scholarships and learning." },
  { icon: "book", title: "Planning & resources", copy: "Help prepare lessons and learning materials." },
  { icon: "people", title: "Teachers & delivery", copy: "Support teaching and programme delivery." },
  { icon: "spark", title: "Scholarship access", copy: "Open learning opportunities for students in need." },
] as const;
