// Conversation starters shown on the home screen. There are many more than
// the four displayed: every page load draws one starter from four different
// categories, and avoids anything shown on the previous load, so the screen
// always feels fresh.
export type Starter = { title: string; hint: string };

export const STARTER_POOL: Record<string, Starter[]> = {
  mindbenders: [
    { title: "Why can't you tickle yourself?", hint: "Your brain's prediction trick" },
    { title: "Is 0.999… really equal to 1?", hint: "Infinity's sneakiest trick" },
    { title: "The ship of Theseus, but it's you", hint: "Are you the same person?" },
    { title: "What if Zeno was right?", hint: "Motion as a paradox" },
    { title: "Where is everybody?", hint: "The Fermi paradox" },
    { title: "Could you be a Boltzmann brain?", hint: "Cosmic randomness, wild odds" },
    { title: "The unexpected hanging paradox", hint: "When logic eats itself" },
    { title: "Why does 1+2+3+… equal −1/12?", hint: "The weirdest result in maths" },
  ],
  space: [
    { title: "What's inside a black hole?", hint: "Beyond the event horizon" },
    { title: "What does a neutron star weigh?", hint: "One teaspoon, one mountain" },
    { title: "If the Sun vanished, when'd we know?", hint: "Gravity vs the speed of light" },
    { title: "A day on Venus, minute by minute", hint: "Hot, slow, and backwards" },
    { title: "Is space really silent?", hint: "Sound, light and the void" },
    { title: "Could we live on Titan?", hint: "Orange skies, methane lakes" },
    { title: "How big is the observable universe?", hint: "Numbers that break brains" },
    { title: "What would a wormhole trip look like?", hint: "Spacetime shortcuts" },
  ],
  ai: [
    { title: "How would an AI dream?", hint: "Strange, fun, maybe true" },
    { title: "Invent a sixth sense for humans", hint: "Beyond sight and sound" },
    { title: "How do LLMs actually 'think'?", hint: "Peek inside the machine" },
    { title: "Design a robot pet with a soul", hint: "Personality included" },
    { title: "Which jobs won't exist in 2060?", hint: "Future of work, honestly" },
    { title: "Could code ever be conscious?", hint: "Take a side" },
    { title: "Write a law for the first AI", hint: "Three rules, no loopholes" },
    { title: "Teach me to prompt like a wizard", hint: "Spells for better answers" },
  ],
  brainstorm: [
    { title: "Invent a sport for zero gravity", hint: "Rules, scoring, chaos" },
    { title: "Design a city on Mars", hint: "Brainstorm with me" },
    { title: "Name 5 startups the world needs", hint: "Weird but useful" },
    { title: "Build the perfect 24-hour day", hint: "No wasted minutes" },
    { title: "Create a holiday for all humanity", hint: "Date, rituals, snacks" },
    { title: "Design a language with no verbs", hint: "How would it work?" },
    { title: "Reinvent the school bell", hint: "Small idea, big change" },
    { title: "Pitch a museum of the future", hint: "What goes inside?" },
  ],
  weird: [
    { title: "Explain the internet to a medieval king", hint: "Dragons optional" },
    { title: "Why do we yawn when others yawn?", hint: "A contagious mystery" },
    { title: "Why do cats purr?", hint: "More than just happiness" },
    { title: "What if humans could photosynthesize?", hint: "Lunch in the sunshine" },
    { title: "Which animal would win at chess?", hint: "Ranked by pure brainpower" },
    { title: "Do goldfish really forget?", hint: "Myth or science?" },
    { title: "What would aliens think of our music?", hint: "Beats from another world" },
    { title: "Make me laugh with a physics joke", hint: "Nerd humour, fully loaded" },
  ],
  philosophy: [
    { title: "Is free will an illusion?", hint: "Pick a side and defend it" },
    { title: "Would you plug into the Matrix?", hint: "Blue pill, red pill" },
    { title: "Is maths invented or discovered?", hint: "Plato vs the formalists" },
    { title: "Trolley problem for a self-driving car", hint: "Who should it save?" },
    { title: "What is consciousness, really?", hint: "The hardest problem" },
    { title: "Is a perfect copy of you still you?", hint: "The teleporter test" },
    { title: "Does the universe have a purpose?", hint: "Meaning vs mechanics" },
    { title: "Would you want to know your death date?", hint: "A fair warning dilemma" },
  ],
  nature: [
    { title: "How do octopuses think with arms?", hint: "Nine brains, one animal" },
    { title: "How do tardigrades survive space?", hint: "Tiny, tough, nearly immortal" },
    { title: "Why is the sea salty?", hint: "A billion-year recipe" },
    { title: "How do birds sense Earth's magnetism?", hint: "A quantum compass, maybe" },
    { title: "Why do we dream at all?", hint: "The leading theories, ranked" },
    { title: "Could life exist without carbon?", hint: "Silicon, ammonia, and more" },
    { title: "How do bees do maths?", hint: "Tiny brains, big tricks" },
    { title: "What's the loudest sound in history?", hint: "Krakatoa, and beyond" },
  ],
  creative: [
    { title: "Write a villain who is right", hint: "Make readers squirm" },
    { title: "Tell a story in exactly 50 words", hint: "Tiny tale, big twist" },
    { title: "Invent a mythical creature", hint: "With its own legend" },
    { title: "Describe a colour no one has seen", hint: "Words for the impossible" },
    { title: "A haiku about a black hole", hint: "Gravity in 17 syllables" },
    { title: "Pitch a film: Titanic, but in space", hint: "Logline in one line" },
    { title: "Name a star and write its legend", hint: "Mythology on demand" },
    { title: "Write a letter from the year 2100", hint: "Dear past, listen up" },
  ],
};

const RECENT_KEY = "satya-starters-last";

function shuffle<T>(items: T[], random: () => number): T[] {
  const copy = items.slice();
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

// One starter from each of `count` different categories, skipping anything in
// `recent` whenever an alternative exists.
export function pickStarters(
  random: () => number = Math.random,
  recent: string[] = [],
  count = 4,
  pool: Record<string, Starter[]> = STARTER_POOL,
): Starter[] {
  const categories = shuffle(Object.keys(pool), random).slice(0, count);
  return categories.map((category) => {
    const items = pool[category];
    const fresh = items.filter((item) => !recent.includes(item.title));
    const choices = fresh.length > 0 ? fresh : items;
    return choices[Math.floor(random() * choices.length)];
  });
}

// Draws a new set for this page load and remembers it, so the next load
// shows four different ones.
export function freshStarters(): Starter[] {
  let recent: string[] = [];
  try {
    const raw = localStorage.getItem(RECENT_KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    if (Array.isArray(parsed)) recent = parsed.filter((item): item is string => typeof item === "string");
  } catch {
    recent = [];
  }
  const picked = pickStarters(Math.random, recent);
  try {
    localStorage.setItem(RECENT_KEY, JSON.stringify(picked.map((item) => item.title)));
  } catch {
    // Storage unavailable: the set is still random, just not de-duplicated.
  }
  return picked;
}
