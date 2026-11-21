import { describe, expect, it } from "vitest";
import {
  DEFAULT_DRISHTI_MODEL_ID,
  DRISHTI_MODELS,
  getDrishtiModel,
  isDrishtiModelId,
} from "./registry";

describe("Drishti model registry", () => {
  it("provides four stable product-facing model tiers", () => {
    expect(DRISHTI_MODELS.map((model) => model.name)).toEqual([
      "Drishti Lite 1.0",
      "Drishti Core 1.5",
      "Drishti Ultra 2.0",
      "Drishti X 3.0 MAX",
    ]);
  });

  it("marks only the MAX tier as experimental", () => {
    expect(DRISHTI_MODELS.filter((model) => model.experimental).map((model) => model.id))
      .toEqual(["max"]);
  });

  it("validates persisted model selections and falls back to Lite", () => {
    expect(DEFAULT_DRISHTI_MODEL_ID).toBe("lite");
    expect(isDrishtiModelId("ultra")).toBe(true);
    expect(isDrishtiModelId("unknown")).toBe(false);
    expect(isDrishtiModelId(null)).toBe(false);
    expect(getDrishtiModel("max").experimental).toBe(true);
  });
});
