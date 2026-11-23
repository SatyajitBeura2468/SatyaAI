export type HeadlineCopy = { lead: string; accent: string };
export function pickOnLoad<T>(items: readonly T[], random: () => number = Math.random): T {
  if (items.length === 0) throw new Error("At least one copy option is required.");
  return items[Math.min(items.length - 1, Math.floor(random() * items.length))];
}

export const REASONING_MODE_DESCRIPTIONS = Object.freeze({
  micro: "Featherweight intelligence for the simplest of everyday tasks.",
  nano: "Light on resources, ready for a wider range of everyday tasks.",
  fast: "Responsive intelligence that gets things done without the wait.",
  smart: "Balanced reasoning for thoughtful, well-rounded answers.",
  deep: "Deeper analysis for ambitious ideas and challenging problems.",
});

export const MORE_TOOLS_COPY = Object.freeze([
  {
    id: "web-search",
    label: "Web search",
    description: "Search and cite live sources",
    status: "Coming soon",
  },
  {
    id: "deep-research",
    label: "Deep research",
    description: "Investigate complex questions in depth and turn findings into detailed reports.",
    status: "Coming soon",
  },
] as const);
export const HOME_HERO_OPTIONS = Object.freeze([
  { lead: "Well, what are we", accent: "curious about today?", tagline: "Big questions, strange ideas, serious thinking. Bring everything." },
  { lead: "Got a question?", accent: "Let's make it interesting.", tagline: "From tiny curiosities to full-blown rabbit holes." },
  { lead: "What's on your mind?", accent: "Let's investigate.", tagline: "A little curiosity, a lot of possibilities. Let's see where this goes." },
  { lead: "Big questions?", accent: "Let's get wonderfully lost.", tagline: "Ask freely. Think deeply. Wander responsibly." },
  { lead: "That thought you can't drop?", accent: "Let's chase it.", tagline: "Your curiosity gets the steering wheel. We'll keep a map." },
  { lead: "Curiosity brought you here.", accent: "Let's see where it goes.", tagline: "Reasoning, research and creation, minus the unnecessary ceremony." },
] as const);
export const DRISHTI_STUDIO_HEADLINES: readonly HeadlineCopy[] = Object.freeze([
  { lead: "Your imagination called.", accent: "Drishti answered." },
  { lead: "From what if", accent: "to there it is." },
  { lead: "Let's turn that thought", accent: "into pixels." },
  { lead: "A picture in your head?", accent: "Let's make it real." },
  { lead: "You bring the idea.", accent: "Drishti brings the canvas." },
  { lead: "One prompt closer", accent: "to the picture." },
]);
export const CHAKSHU_STUDIO_HEADLINES: readonly HeadlineCopy[] = Object.freeze([
  { lead: "Your imagination called.", accent: "Chakshu answered." },
  { lead: "Dream it. Describe it.", accent: "Watch it unfold." },
  { lead: "From a sentence", accent: "to a cinematic moment." },
  { lead: "Got a scene in mind?", accent: "Let's give it motion." },
  { lead: "Your idea, now", accent: "with a timeline." },
  { lead: "A few words in.", accent: "A whole scene out." },
]);
export const DRISHTI_IDEA_COPY = Object.freeze([
  { title: "What are we creating today?", subtitle: "Pick a starting point, then make the prompt your own." },
  { title: "Got an image in mind?", subtitle: "Borrow an idea, change every detail, make it yours." },
  { title: "Let's start with a spark.", subtitle: "Choose a scene and give your imagination somewhere to go." },
]);
export const CHAKSHU_IDEA_COPY = Object.freeze([
  { title: "Got a scene in mind?", subtitle: "Pick a starting point, then direct the scene your way." },
  { title: "What's moving today?", subtitle: "Choose a scene, tweak the prompt and call the shots." },
  { title: "Let's roll something.", subtitle: "Start with an idea. The camera can take it from here." },
]);
export const EMPTY_CONVERSATION_COPY = Object.freeze([
  "An empty universe. Plenty of room for questions.",
  "No conversations yet. The plot is yours to start.",
  "Fresh space, zero context. What's the first question?",
  "The chat history is a blank canvas. Go on, make a mark.",
]);
export const EMPTY_SAVED_COPY = Object.freeze([
  "Nothing bookmarked. Apparently, nothing has impressed you yet.",
  "No saved answers. The collection era starts whenever you do.",
  "Nothing tucked away yet. Save the good bits as you go.",
  "Your saved shelf is empty. Room for one genuinely useful answer.",
]);
export const EMPTY_SEARCH_COPY = Object.freeze([
  "No matches in this rabbit hole. Try another search.",
  "Nothing found. Maybe that conversation has a different name?",
  "No results this time. Try a broader search.",
]);
