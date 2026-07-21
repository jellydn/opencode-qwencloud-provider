import { describe, it, expect } from "vitest";
import { isRecord, stringValue } from "../../plugin/utils";

describe("isRecord", () => {
  it("returns true for plain objects", () => {
    expect(isRecord({ key: "value" })).toBe(true);
    expect(isRecord({})).toBe(true);
  });

  it("returns false for null", () => {
    expect(isRecord(null)).toBe(false);
  });

  it("returns false for arrays", () => {
    expect(isRecord(["a", "b"])).toBe(false);
    expect(isRecord([])).toBe(false);
  });

  it("returns false for primitives", () => {
    expect(isRecord("string")).toBe(false);
    expect(isRecord(42)).toBe(false);
    expect(isRecord(true)).toBe(false);
    expect(isRecord(undefined)).toBe(false);
  });
});

describe("stringValue", () => {
  it("returns the string for string input", () => {
    expect(stringValue("hello")).toBe("hello");
  });

  it("returns undefined for non-strings", () => {
    expect(stringValue(42)).toBeUndefined();
    expect(stringValue(null)).toBeUndefined();
    expect(stringValue(undefined)).toBeUndefined();
    expect(stringValue({})).toBeUndefined();
    expect(stringValue(["a"])).toBeUndefined();
    expect(stringValue(true)).toBeUndefined();
  });
});
