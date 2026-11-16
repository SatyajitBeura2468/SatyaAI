export const TEAM = Object.freeze([
  Object.freeze({ name: "Satyajit Beura", designation: "Sole Founder" }),
  Object.freeze({ name: "Amit Kumar Panigrahi", designation: "Project Lead" }),
  Object.freeze({ name: "Krishna Sharma", designation: "Collaborator" }),
  Object.freeze({ name: "Aditya Soni", designation: "Product Designer" }),
  Object.freeze({ name: "Vaibhav Mishra", designation: "Lead Researcher" }),
]);

export function teamMemberByDesignation(designation) {
  return TEAM.find((member) => member.designation.toLowerCase() === String(designation).toLowerCase()) ?? null;
}