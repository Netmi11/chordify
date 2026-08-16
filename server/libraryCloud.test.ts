import { describe, expect, it } from "vitest";
import { formatCloudRecoveryCode, parseCloudRecoveryCode } from "../client/src/lib/libraryCloud";

describe("cloud library recovery code", () => {
  const key = { libraryId: "f47ac10b-58cc-4372-a567-0e02b2c3d479", secret: "a".repeat(64) };

  it("round-trips a private cloud recovery code", () => {
    expect(parseCloudRecoveryCode(formatCloudRecoveryCode(key))).toEqual(key);
  });

  it("rejects malformed recovery codes", () => {
    expect(parseCloudRecoveryCode("not-a-code")).toBeNull();
    expect(parseCloudRecoveryCode(`${key.libraryId}.short`)).toBeNull();
  });
});
