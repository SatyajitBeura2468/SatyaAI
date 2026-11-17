/**
 * Candid, English-first Hinglish loading copy, grouped by the real model
 * lifecycle. These lines never replace factual progress percentages/stages.
 */
export type LoadingMessageStage =
  | "cache-check"
  | "download"
  | "download-slow"
  | "download-progress"
  | "cache-load"
  | "initializing"
  | "switching"
  | "recovery"
  | "ready";

export const LOADING_PHRASE_ROTATION_MS = 5500;
export const DOWNLOAD_STALL_THRESHOLD_MS = 25_000;
export const DOWNLOAD_PROGRESS_STEP_PERCENT = 5;
export const PROGRESS_COMMENTARY_DURATION_MS = 4500;

export const LOADING_MESSAGE_POOLS = {
  "cache-check": [
    "Let's see if this model is already ghar ka mehmaan…",
    "Checking if I've met this model before…",
    "Looking for some familiar files. Suspense is unnecessary…",
  ],
  download: [
    "Downloading my new brain cells. Handle with care…",
    "Fetching some fresh intelligence. Internet, don't disappoint me…",
    "Building my brain, one file at a time. Very productive, apparently…",
    "The brain shipment has left the warehouse…",
    "Downloading the goods. No jugaad this time…",
    "My brain is travelling at internet speed. Pray for me…",
    "Somewhere out there, my neurons are being shipped…",
    "This brain better be worth the delivery charges…",
    "Waiting for my intelligence to arrive. Quite ironic…",
    "The neurons are on their way. Traffic must be terrible…",
    "My brain is currently somewhere between the cloud and reality…",
  ],
  "download-slow": [
    "Still here. Still downloading. Still optimistic…",
    "Patience is a virtue. Apparently, so is having good Wi-Fi…",
    "The download has its own personality at this point…",
    "I promise I'm not downloading the entire internet…",
    "Some things take time. Apparently, this brain is one of them…",
    "Taking longer than expected. Classic technology behaviour…",
    "Should've ordered express intelligence…",
    "My neurons are probably stuck at a toll plaza…",
    "No worries, I'm just having a very long loading-screen character arc…",
    "The internet said 'trust the process'. I am trying…",
    "Still assembling the brain. Missing parts? Hopefully not…",
  ],
  "download-progress": [
    "A few more brain cells have arrived…",
    "The intelligence inventory is growing…",
    "Progress detected. Someone tell my neurons…",
    "Another batch of digital dimaag secured…",
    "The brain shipment is making moves…",
    "Collecting neurons like they're Pokémon…",
    "One more step towards becoming slightly less clueless…",
    "The download gods have finally shown some mercy…",
    "A little more buddhi in the building…",
    "The intelligence department is expanding…",
    "We're getting somewhere. Finally, some character development…",
  ],
  "cache-load": [
    "Found my old brain. Still looks usable…",
    "Good news, past-me actually saved something…",
    "No fresh downloads today. Recycling intelligence…",
    "Found the files. See, I do remember things…",
    "Retrieving my brain from the local locker…",
    "Look who remembered to save their homework…",
    "No need to download twice. I'm not that forgetful…",
    "Found the brain. It was right where we left it…",
    "The good old cache. Doing the heavy lifting again…",
    "Past-me deserves a promotion for this…",
  ],
  initializing: [
    "Putting all these brain cells in the right places…",
    "Connecting the neurons. Please don't touch the wires…",
    "Teaching my GPU some manners…",
    "Time to turn this pile of files into actual intelligence…",
    "Connecting the dots. And a few thousand other things…",
    "The neurons are getting their seating arrangements…",
    "Giving my GPU a little pep talk…",
    "Making sure nothing is wired backwards. Hopefully…",
    "Brain assembly in progress. IKEA instructions would help…",
    "Getting everything to cooperate. Typical team project…",
    "The circuits are meeting for the first time…",
    "A little calibration, a little jugaad…",
    "Final preparations. Nobody panic…",
  ],
  switching: [
    "New model, new vibes. Give me a second…",
    "Putting the old brain aside. Time for an upgrade…",
    "Changing the engine without changing the driver…",
    "One brain out, another brain in. Very sophisticated surgery…",
    "Changing gears. Please keep your arms inside the vehicle…",
    "Switching intelligence providers. Very corporate of me…",
    "Switching models without changing the conversation. Fancy, right…",
  ],
  recovery: [
    "Well, that didn't go as planned. Trying Plan B…",
    "A little technical drama. Nothing to panic about yet…",
    "Calling the backup brain. The first one needs a break…",
    "The GPU and I are having a serious conversation…",
    "Well, the GPU woke up on the wrong side of the bed…",
    "A small technical tantrum. We're negotiating…",
    "Plan A is reconsidering its life choices…",
    "That was unexpected. Trying a different route…",
    "The GPU needs a minute. Don't we all…",
    "A little turbulence. Keeping the ship steady…",
    "Attempting some respectable digital jugaad…",
  ],
  ready: [
    "Brain installed. Let's pretend we're professionals…",
    "All neurons accounted for. Let's get to work…",
    "New brain, who dis?",
    "And we're officially operational. Shabaash, team…",
    "The machinery is ready. Your move…",
    "Brain cells online. Let's make some sense…",
    "The brain has entered the building…",
    "Brain online. Let's not waste this expensive electricity…",
    "All systems go. Ab bolo, kya karna hai?",
    "Finally operational. That was quite the entrance…",
  ],
} as const satisfies Record<LoadingMessageStage, readonly string[]>;

/** Create a shuffled cycle without replacement, avoiding the previous cycle's final line. */
export function createLoadingPhraseOrder(
  stage: LoadingMessageStage,
  previousLastIndex?: number,
): number[] {
  const order = Array.from(
    { length: LOADING_MESSAGE_POOLS[stage].length },
    (_, index) => index,
  );

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
