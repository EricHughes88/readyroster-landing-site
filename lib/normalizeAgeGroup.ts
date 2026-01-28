export function normalizeAgeGroup(input: string | null | undefined): string | null {
  if (!input) return null;

  const raw = String(input).trim();
  if (!raw) return null;

  const s = raw.toLowerCase().replace(/\s+/g, " ").trim();

  const isGirls = s.startsWith("girls ");
  const base = isGirls ? s.replace(/^girls\s+/, "") : s;

  // Middle / High school
  if (base === "middle school" || base === "ms") return isGirls ? "girls_ms" : "ms";
  if (base === "high school" || base === "hs") return isGirls ? "girls_hs" : "hs";

  // K-3 .. K-12 (k-3, k3, k 3)
  const kMatch = base.match(/^k\s*-\s*(\d+)$/) || base.match(/^k\s*(\d+)$/);
  if (kMatch) {
    const key = `k${kMatch[1]}`;
    return isGirls ? `girls_${key}` : key;
  }

  // 12u / 12 u / 12 and under / 12 & under
  const uMatch =
    base.match(/^(\d+)\s*u$/) ||
    base.match(/^(\d+)u$/) ||
    base.match(/^(\d+)\s*(and\s*)?under$/) ||
    base.match(/^(\d+)\s*&\s*under$/);

  if (uMatch) {
    const key = `${uMatch[1]}u`;
    return isGirls ? `girls_${key}` : key;
  }

  // "12 and under"
  const andUnderMatch = base.match(/^(\d+)\s+and\s+under$/);
  if (andUnderMatch) {
    const key = `${andUnderMatch[1]}u`;
    return isGirls ? `girls_${key}` : key;
  }

  // fallback: stable key
  const fallback = base.replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
  return isGirls ? `girls_${fallback}` : fallback;
}
