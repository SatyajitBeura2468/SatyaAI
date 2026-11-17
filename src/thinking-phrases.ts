/**
 * English-first Hinglish status lines shown while a model is generating.
 * Keep these separate from model-download progress and actual answer content.
 */
export const THINKING_PHRASES = Object.freeze([
  "One sec, logging in to my dimaag…",
  "Hold on, my neurons are having chai…",
  "My virtual buddhi is waking up…",
  "Hang on, I don't want to embarrass myself with a guess…",
  "Checking the facts before my overconfidence kicks in…",
  "This deserves an answer, not a random jugaad…",
  "Let me think before I pretend to know everything…",
  "Trying to keep the nonsense-to-accuracy ratio low…",
  "A little patience, I'm aiming for sensible today…",
  "Because apparently guessing is not a valid profession…",
  "Please hold, buddhi.exe is loading…",
  "Installing some fresh vichaar into the system…",
  "Clearing the cache of unnecessary bakwaas…",
  "My logic engine is doing a little jugaad…",
  "Processing your request with extra tadka…",
  "Interesting question. My dimaag wants a closer look…",
  "Give me a moment, this needs some proper thinking…",
  "Let's get this jawaab sorted…",
  "Putting the puzzle pieces together, thoda carefully…",
  "One sec, the facts are still gathering…",
  "Let me make some sense out of this…",
  "Calling all available brain cells. This is not a drill…",
  "Deploying maximum buddhi. Stand by…",
  "I could guess, but meri bhi kuch reputation hai…",
  "The dimaag is cooking. Please don't inspect the kitchen…",
  "This question has more layers than a good biryani…",
  "I'm putting the 'intelligence' in artificial intelligence. Hopefully…",
  "Let me give this some proper dimaag time…",
  "Sorting the facts from the unnecessary drama…",
  "Let's not rush into a beautiful mistake…",
]);

/**
 * Returns a random permutation of every phrase index. When supplied, the first
 * index is guaranteed not to match the last index from the previous deck.
 */
export function createThinkingPhraseOrder(previousLastIndex?: number): number[] {
  const order = Array.from({ length: THINKING_PHRASES.length }, (_, index) => index);

  // Fisher-Yates gives every phrase a position without replacement.
  for (let index = order.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [order[index], order[swapIndex]] = [order[swapIndex], order[index]];
  }

  if (
    previousLastIndex !== undefined &&
    order.length > 1 &&
    order[0] === previousLastIndex
  ) {
    const swapIndex = 1 + Math.floor(Math.random() * (order.length - 1));
    [order[0], order[swapIndex]] = [order[swapIndex], order[0]];
  }

  return order;
}
