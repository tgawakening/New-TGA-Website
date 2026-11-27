/* Gen-Mu'min project page content for the Indigo Geometry redesign.
 * The programmes come from components/gen-mumin/programs.ts (the live
 * source). Everything below is copied verbatim from the constants and copy
 * inline in components/gen-mumin/gen-mumin-page.tsx, so the live
 * /projects/gen-mumin stays untouched. Same links, same videos, same offer. */

export { genMuminPrograms as programmes } from "@/components/gen-mumin/programs";

export const links = {
  registration: "https://genmumin.com/registration",
};

/* The two films, by YouTube id (live: heroVideoEmbed, introVideoEmbed). */
export const videos = {
  orientation: { id: "g4RwUl_eSlY", title: "Gen Mumin orientation session" },
  intro: { id: "dDoOINvjVoQ", title: "Gen Mumin intro video" },
} as const;

export const offer = {
  badge: "Limited slots",
  headline: "Early bird 25% OFF",
  code: "GENM25",
  was: "PKR 12,000",
  now: "PKR 8,999",
};

export const hero = {
  badge: "Gen Mumin Orientation Session",
  title: "Empowered Muslim Children, Not Just Educated Children.",
  lede: "Gen Mumin helps children grow beyond ordinary learning into faith, character, leadership, Qur'an connection, and purposeful living.",
  pills: ["Strong in faith", "Kind in character", "Courageous in leadership"],
};

/* Live: transformationCards. */
export const transformations = [
  { from: "Hollow", to: "Nurturing" },
  { from: "Shallow", to: "Deep" },
  { from: "Following", to: "Guiding" },
];

export const launch = {
  kicker: "Limited Time Launch Offer",
  title: "Guide them before something else does.",
  body: "Gen Mumin is for families who want children shaped by faith, knowledge, values, and purpose while the digital world competes for their attention.",
};

export const preview = {
  kicker: "Orientation Preview",
  title: "See why Gen Mumin is built for this generation.",
  body: "Watch the orientation session to understand the programme vision, launch offer, and what families can expect from the learning journey.",
};

export const path = {
  kicker: "Programme Path",
  title: "Five connected areas for stronger values and purposeful living.",
  lede: "Clear, child-friendly learning areas summarized for parents who want quick understanding.",
};

export const closing = {
  kicker: "Registration Now Open",
  title: "Reserve your child's Gen Mumin spot today.",
};
