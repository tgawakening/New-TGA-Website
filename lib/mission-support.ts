export const missionPurposes = [
  { id: "LEARNING_ACCESS", label: "Sponsor Learning Access", title: "Open doors to education.", copy: "Help learners facing financial barriers access TGA's educational programmes.", action: "Support Learning Access", image: "/Gen-Mumin.jpeg", imageAlt: "TGA's Gen-Mumin programme artwork", tag: "Access to learning" },
  { id: "EXISTING_PROGRAMMES", label: "Support Existing Programmes", title: "Strengthen the work already happening.", copy: "Support teaching, learning resources, and the delivery of ongoing educational programmes.", action: "Support Our Programmes", image: "/seerah slide-2.jpg", imageAlt: "TGA's Seerah programme artwork", tag: "Ongoing programmes" },
  { id: "NEW_INITIATIVES", label: "Develop New Initiatives", title: "Help build what's next.", copy: "Contribute towards developing future education, leadership, and community initiatives.", action: "Support Future Initiatives", image: "/images/upcoming-courses/critical-thinking.png", imageAlt: "TGA's planned Critical Thinking programme poster", tag: "Future initiatives" },
  { id: "WHERE_NEEDED", label: "Where Most Needed", title: "Support the wider mission.", copy: "Support the mission's educational and community priorities where help is needed.", action: "Support the Wider Mission", image: "/images/upcoming-courses/building-relationship-with-community.png", imageAlt: "TGA's planned community relationships programme poster", tag: "The wider mission" },
] as const;

export type MissionPurpose = (typeof missionPurposes)[number]["id"];
export type GivingFrequency = "ONE_TIME" | "MONTHLY";
export const missionPurposeIds = missionPurposes.map(p => p.id) as [MissionPurpose, ...MissionPurpose[]];
export function missionPurposeLabel(id: string) {
  return missionPurposes.find(p => p.id === id)?.label ?? "Where Most Needed";
}
export const missionContactEmail = "Enquiries.awakeningteam@outlook.com";
export const companyRegisterUrl = "https://find-and-update.company-information.service.gov.uk/company/15523255";
