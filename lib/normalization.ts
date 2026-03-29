export function normalizeWeightClass(input: string | null | undefined): string | null {
  if (!input) return null;

  const raw = String(input).trim();
  if (!raw) return null;

  const s = raw.toLowerCase().replace(/\s+/g, " ").trim();

  if (["hwt", "heavyweight", "hvy", "hw"].includes(s)) {
    return "HWT";
  }

  const match = s.match(/^(\d{2,3})\s*(lb|lbs)?$/);
  if (match) {
    return match[1];
  }

  return raw;
}

export function splitWeightClasses(input: string | null | undefined): string[] {
  if (!input) return [];

  return [
    ...new Set(
      String(input)
        .split(",")
        .map((part) => normalizeWeightClass(part))
        .filter((value): value is string => Boolean(value))
    ),
  ];
}