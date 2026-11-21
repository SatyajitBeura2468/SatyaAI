import { describe, expect, it } from "vitest";
import { MAX_DRISHTI_HISTORY, sortDrishtiHistory, type DrishtiHistoryItem } from "./history";

function historyItem(index: number): DrishtiHistoryItem {
  return {
    id: "item-" + index,
    prompt: "Prompt " + index,
    model_id: "lite",
    image_data_url: "data:image/png;base64,AA==",
    elapsed_seconds: 1,
    seed: index,
    created_at: index,
  };
}

describe("Drishti image history", () => {
  it("sorts generations newest first", () => {
    expect(sortDrishtiHistory([historyItem(2), historyItem(7), historyItem(4)]).map((item) => item.seed))
      .toEqual([7, 4, 2]);
  });

  it("keeps only the latest twelve entries", () => {
    const items = Array.from({ length: 16 }, (_, index) => historyItem(index));
    const sorted = sortDrishtiHistory(items);
    expect(sorted).toHaveLength(MAX_DRISHTI_HISTORY);
    expect(sorted[0].seed).toBe(15);
    expect(sorted.at(-1)?.seed).toBe(4);
  });
});
