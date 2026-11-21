import { describe, expect, it } from "vitest";
import { MAX_CHAKSHU_HISTORY, sortChakshuHistory, type ChakshuHistoryItem } from "./history";

function entry(index: number): ChakshuHistoryItem {
  return {
    id: "video-" + index,
    prompt: "Video prompt " + index,
    blob: new Blob(["video-content"], { type: "video/mp4" }),
    model_id: "light",
    elapsed_seconds: 2,
    seed: index,
    created_at: index,
  };
}

describe("Chakshu video history", () => {
  it("orders newest first and keeps the last twelve videos", () => {
    const items = sortChakshuHistory(Array.from({ length: 16 }, (_, index) => entry(index)));
    expect(items).toHaveLength(MAX_CHAKSHU_HISTORY);
    expect(items[0].seed).toBe(15);
    expect(items.at(-1)?.seed).toBe(4);
  });
});
