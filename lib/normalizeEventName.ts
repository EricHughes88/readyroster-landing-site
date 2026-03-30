export function normalizeEventName(input?: string | null): string | null {
  if (!input) return null;

  let s = String(input)
    .trim()
    .toLowerCase();

  // remove weird punctuation
  s = s.replace(/[^a-z0-9\s]/g, "");

  // collapse spaces
  s = s.replace(/\s+/g, " ");

  if (!s) return null;

  // Title Case it
  return s
    .split(" ")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}