import { describe, it, expect } from "vitest";
import {
  determineInitialStatus,
  REJECTION_THRESHOLD_SECONDS,
} from "../src/services/itemStatus.js";

describe("determineInitialStatus", () => {
  it("rejects audio at or under 15 seconds", () => {
    expect(determineInitialStatus(15)).toBe("REJECTED");
    expect(determineInitialStatus(5)).toBe("REJECTED");
    expect(determineInitialStatus(0)).toBe("REJECTED");
  });

  it("accepts audio over 15 seconds", () => {
    expect(determineInitialStatus(15.01)).toBe("PENDING");
    expect(determineInitialStatus(120)).toBe("PENDING");
  });

  it("uses the exported threshold constant", () => {
    expect(REJECTION_THRESHOLD_SECONDS).toBe(15);
  });
});
