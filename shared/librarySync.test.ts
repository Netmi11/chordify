import { describe, expect, it } from "vitest";
import { canApplyUpsert } from "./librarySync";

describe("library sync conflict policy", () => {
  it("rejects an upsert from a device that has not observed a newer deletion", () => {
    expect(canApplyUpsert(4, 5)).toBe(false);
  });

  it("allows a re-add after the device observed the deletion", () => {
    expect(canApplyUpsert(5, 5)).toBe(true);
  });
});
