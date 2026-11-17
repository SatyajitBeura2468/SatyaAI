import { describe, expect, it } from "vitest";
import {
  createLoadingPhraseOrder,
  DOWNLOAD_STALL_THRESHOLD_MS,
  LOADING_MESSAGE_POOLS,
  LOADING_PHRASE_ROTATION_MS,
  type LoadingMessageStage,
} from "./loading-phrases";

const stages: LoadingMessageStage[] = [
  "cache-check",
  "download",
  "download-slow",
  "download-progress",
  "cache-load",
  "initializing",
  "switching",
  "recovery",
  "ready",
];

describe("SatyaAI model-loading messages", () => {
  it("keeps each real model lifecycle stage populated with its selected copy", () => {
    expect(Object.keys(LOADING_MESSAGE_POOLS).sort()).toEqual([...stages].sort());
    expect(LOADING_MESSAGE_POOLS["cache-check"]).toHaveLength(3);
    expect(LOADING_MESSAGE_POOLS.download).toHaveLength(11);
    expect(LOADING_MESSAGE_POOLS["download-slow"]).toHaveLength(11);
    expect(LOADING_MESSAGE_POOLS["download-progress"]).toHaveLength(11);
    expect(LOADING_MESSAGE_POOLS["cache-load"]).toHaveLength(10);
    expect(LOADING_MESSAGE_POOLS.initializing).toHaveLength(13);
    expect(LOADING_MESSAGE_POOLS.switching).toHaveLength(7);
    expect(LOADING_MESSAGE_POOLS.recovery).toHaveLength(11);
    expect(LOADING_MESSAGE_POOLS.ready).toHaveLength(10);
  });

  it("keeps the long-wait threshold and phrase cadence deliberate", () => {
    expect(DOWNLOAD_STALL_THRESHOLD_MS).toBe(25_000);
    expect(LOADING_PHRASE_ROTATION_MS).toBe(5500);
  });

  it("shuffles every line once per cycle for every stage", () => {
    for (const stage of stages) {
      const pool = LOADING_MESSAGE_POOLS[stage];
      const order = createLoadingPhraseOrder(stage);
      expect(order).toHaveLength(pool.length);
      expect([...order].sort((a, b) => a - b)).toEqual(
        Array.from({ length: pool.length }, (_, index) => index),
      );
    }
  });

  it("does not repeat the previous cycle's final line at the next cycle boundary", () => {
    for (const stage of stages) {
      const pool = LOADING_MESSAGE_POOLS[stage];
      if (pool.length < 2) continue;
      for (let previousLastIndex = 0; previousLastIndex < pool.length; previousLastIndex += 1) {
        const nextOrder = createLoadingPhraseOrder(stage, previousLastIndex);
        expect(nextOrder[0]).not.toBe(previousLastIndex);
      }
    }
  });
});
