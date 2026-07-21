/**
 * QwenCloud Wan/HappyHorse plugin — shared utilities.
 *
 * @module qwencloud-plugin-utils
 */

/** Type guard: is the value a plain record (non-null object, not array)? */
export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** Extract a string value from an unknown, returning undefined for non-strings. */
export function stringValue(value: unknown): string | undefined {
  return typeof value === "string" ? value : undefined;
}
