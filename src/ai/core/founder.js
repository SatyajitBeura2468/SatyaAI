export const FOUNDER = Object.freeze({
  fullName: "Satyajit Beura",
  designation: "Sole Founder",
  location: "Odisha, India",
  description: "Odisha-based student researcher and independent technology builder",
  interests: Object.freeze([
    "Artificial Intelligence",
    "Science",
    "Technology",
    "Research",
    "Innovation",
  ]),
  project: "SatyaAI",
  foundedOn: "2026-02-21",
  orcid: null,
  orcidStatus: "Not yet supplied or verified",
});

export function founderSummary() {
  return FOUNDER.fullName + " is an Odisha-based student researcher and independent technology builder who founded SatyaAI on 21 February 2026. His interests include artificial intelligence, science, technology, research, and innovation.";
}