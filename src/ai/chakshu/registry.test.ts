import { describe, expect, it } from "vitest";
import {
  CHAKSHU_MODELS,
  DEFAULT_CHAKSHU_MODEL_ID,
  getChakshuModel,
  isChakshuModelId,
} from "./registry";

describe("Chakshu video model registry", () => {
  it("exposes the three named family tiers in order", () => {
    expect(CHAKSHU_MODELS.map((model) => model.name)).toEqual([
      "Chakshu Light",
      "Chakshu",
      "Divya Chakshu 1",
    ]);
  });

  it("defaults to Light and validates stored model selections", () => {
    expect(DEFAULT_CHAKSHU_MODEL_ID).toBe("light");
    expect(isChakshuModelId("divya")).toBe(true);
    expect(isChakshuModelId("unknown")).toBe(false);
    expect(isChakshuModelId(null)).toBe(false);
    expect(getChakshuModel("chakshu").license).toBe("Apache-2.0");
  });

  it("marks Divya Chakshu as a separately licensed flagship", () => {
    const model = getChakshuModel("divya");
    expect(model.experimental).toBe(true);
    expect(model.license).toContain("Community License");
  });
});
