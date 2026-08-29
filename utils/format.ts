/** Small display-only formatting helpers. No numbering-plan logic lives here. */

/** Title-case a raw contact label: `"mobile"` -> `"Mobile"`, `"iPhone"` -> `"iPhone"`. */
export function formatLabel(label: string): string {
  const trimmed = label.trim();
  if (trimmed.length === 0) {
    return 'Other';
  }
  if (trimmed === trimmed.toUpperCase() || /[A-Z]/.test(trimmed.slice(1))) {
    return trimmed; // already styled (e.g. "iPhone", "WORK")
  }
  return trimmed.charAt(0).toUpperCase() + trimmed.slice(1);
}

/** Locale-independent grouped count, e.g. `1024` -> `"1,024"`. */
export function formatCount(n: number): string {
  return n.toLocaleString('en-US');
}

/** First letter for an avatar bubble. */
export function initialOf(name: string): string {
  const ch = name.trim().charAt(0);
  return ch ? ch.toUpperCase() : '#';
}
