export const missionPurposes = [
  { id: "LEARNING_ACCESS", label: "Sponsor Learning Access" },
  { id: "EXISTING_PROGRAMMES", label: "Support Existing Programmes" },
  { id: "NEW_INITIATIVES", label: "Develop New Initiatives" },
  { id: "WHERE_NEEDED", label: "Where Most Needed" },
  { id: "SEERAH_LEADERSHIP", label: "Seerah & Leadership Education" },
  { id: "LEARNING_RESOURCES", label: "Learning Resources & Delivery" },
] as const;

export type MissionPurpose = (typeof missionPurposes)[number]["id"];
export type GivingFrequency = "ONE_TIME" | "MONTHLY";
export const missionPurposeIds = missionPurposes.map(p => p.id) as [MissionPurpose, ...MissionPurpose[]];
export function missionPurposeLabel(id: string) {
  return missionPurposes.find(p => p.id === id)?.label ?? "Where Most Needed";
}
export const missionContactEmail = "Enquiries.awakeningteam@outlook.com";
export const companyRegisterUrl = "https://find-and-update.company-information.service.gov.uk/company/15523255";
