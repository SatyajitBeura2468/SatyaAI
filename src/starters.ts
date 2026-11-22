// Four curiosity starters are selected from four different categories per page load.
export type Starter = { title: string; hint: string };
export const STARTER_POOL: Record<string, Starter[]> = {
  mindbenders: [
    { title: "Why can't you tickle yourself?", hint: "Your brain saw that coming." },
    { title: "Is 0.999… actually equal to 1?", hint: "Maths is about to get weird." },
    { title: "Ship of Theseus: when is it not you?", hint: "Identity has entered the chat." },
    { title: "What if Zeno was right about motion?", hint: "Are we secretly going nowhere?" },
    { title: "Where is everybody? Seriously.", hint: "The Fermi paradox, basically." },
    { title: "Could you be a Boltzmann brain?", hint: "A cosmic shower thought." },
    { title: "Can a paradox actually make sense?", hint: "Logic is doing backflips." },
    { title: "Why does 1+2+3+… equal −1/12?", hint: "The maths is legal. Somehow." },
  ],
  space: [
    { title: "What's inside a black hole?", hint: "Beyond the event horizon" },
    { title: "Could a neutron star outweigh a mountain?", hint: "One teaspoon. Absolutely wild." },
    { title: "If the Sun vanished, when would we know?", hint: "Even gravity has a speed limit." },
    { title: "Why is a day on Venus longer than its year?", hint: "Venus has its own calendar." },
    { title: "Is space actually silent?", hint: "No air. No sound. Big void." },
    { title: "Could humans live on Titan?", hint: "Methane lakes, orange skies." },
    { title: "How big is the observable universe?", hint: "The numbers are frankly rude." },
    { title: "Could a wormhole be a cosmic shortcut?", hint: "Spacetime's possible backdoor." },
  ],
  ai: [
    { title: "How would an AI dream, if it could?", hint: "A weird question for a machine." },
    { title: "Could AI ever become conscious?", hint: "What even counts as awareness?" },
    { title: "Can a machine genuinely understand jokes?", hint: "Getting the joke is the test." },
    { title: "What happens when AI makes a mistake?", hint: "Who catches the confident guess?" },
    { title: "Could code ever have a sense of self?", hint: "Identity, but make it digital." },
    { title: "Which jobs might look different in 2060?", hint: "Let's not ask a crystal ball." },
    { title: "Can an AI invent something truly new?", hint: "Creativity or clever remixing?" },
    { title: "What should be the first law for AI?", hint: "Three rules. No loopholes." },
  ],
  brainstorm: [
    { title: "Invent a sport for zero gravity", hint: "Rules, scoring and pure chaos." },
    { title: "Design a city on Mars", hint: "Daily life, but make it red." },
    { title: "What startup should exist already?", hint: "A useful idea waiting to happen." },
    { title: "What would your perfect day look like?", hint: "No meetings? Bold proposal." },
    { title: "Invent a holiday everyone would love", hint: "Traditions, snacks, good timing." },
    { title: "Design a language with no verbs", hint: "How would anyone do anything?" },
    { title: "How would you redesign the school bell?", hint: "A tiny change, a big win." },
    { title: "What belongs in a museum of tomorrow?", hint: "Future history starts here." },
  ],
  weird: [
    { title: "Explain the internet to a medieval king", hint: "Dragons are optional." },
    { title: "Why do we yawn when others yawn?", hint: "Your brain copies the room." },
    { title: "Why do cats purr, really?", hint: "It's not just a happy noise." },
    { title: "What if humans could photosynthesise?", hint: "Lunch in the sunshine." },
    { title: "Which animal would win at chess?", hint: "Brainpower, no opposable thumbs." },
    { title: "Do goldfish really forget everything?", hint: "This myth needs a fact-check." },
    { title: "What would aliens think of humans?", hint: "We're a lot to explain." },
    { title: "Can physics make a genuinely good joke?", hint: "Nerd humour, now peer-reviewed." },
  ],
  philosophy: [
    { title: "Is free will an illusion?", hint: "Pick a side. Defend the chaos." },
    { title: "Would you plug into the Matrix?", hint: "A suspiciously tempting offer." },
    { title: "Is maths invented or discovered?", hint: "Plato, meet the real world." },
    { title: "A trolley problem for self-driving cars?", hint: "Ethics gets a steering wheel." },
    { title: "What is consciousness, really?", hint: "The hardest question around." },
    { title: "If you copied yourself, which is you?", hint: "Identity has a loading problem." },
    { title: "Does the universe need a purpose?", hint: "Meaning versus mechanics." },
    { title: "Would you want to know your future?", hint: "Some spoilers are a bad idea." },
  ],
  nature: [
    { title: "How do octopuses think with their arms?", hint: "Eight arms, one clever mystery." },
    { title: "How do tardigrades survive extreme places?", hint: "Tiny, tough, wildly resilient." },
    { title: "Why is the sea salty?", hint: "Earth's longest-running recipe." },
    { title: "Can birds sense Earth's magnetic field?", hint: "A built-in navigation mystery." },
    { title: "Why do we dream at all?", hint: "The brain's nightly side quest." },
    { title: "Could life exist without carbon?", hint: "Silicon, ammonia and wild ideas." },
    { title: "Can bees actually count?", hint: "Tiny brains, serious maths." },
    { title: "What was the loudest sound ever?", hint: "Krakatoa has entered the chat." },
  ],
  creative: [
    { title: "Write a villain who might be right", hint: "Make the moral compass wobble." },
    { title: "Tell a story in exactly 50 words", hint: "Tiny tale. Maximum plot." },
    { title: "Invent a mythical creature with a backstory", hint: "Lore first. Biology optional." },
    { title: "Describe a colour nobody has seen", hint: "Find words for the impossible." },
    { title: "Write a haiku about a black hole", hint: "Gravity, but make it poetic." },
    { title: "Pitch Titanic, but set in space", hint: "One ship. Zero easy exits." },
    { title: "Name a star and invent its legend", hint: "Cosmic mythology starts now." },
    { title: "Write a letter from the year 2100", hint: "The future has a few notes." },
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
export function pickStarters(random: () => number = Math.random, recent: string[] = [], count = 4, pool: Record<string, Starter[]> = STARTER_POOL): Starter[] {
  const categories = shuffle(Object.keys(pool), random).slice(0, count);
  return categories.map((category) => {
    const items = pool[category];
    const fresh = items.filter((item) => !recent.includes(item.title));
    const choices = fresh.length > 0 ? fresh : items;
    return choices[Math.floor(random() * choices.length)];
  });
}
export function freshStarters(): Starter[] {
  let recent: string[] = [];
  try {
    const raw = localStorage.getItem(RECENT_KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    if (Array.isArray(parsed)) recent = parsed.filter((item): item is string => typeof item === "string");
  } catch { recent = []; }
  const picked = pickStarters(Math.random, recent);
  try {
    localStorage.setItem(RECENT_KEY, JSON.stringify(picked.map((item) => item.title)));
  } catch {
    // Storage unavailable: the set is still random, just not de-duplicated.
  }
  return picked;
}
