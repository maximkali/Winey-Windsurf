export function stripTrailingNumberMatchingLetter(label: string | null | undefined, letter: string | null | undefined) {
  const base = (label ?? '').trim();
  const l = (letter ?? '').trim();
  if (!base) return '';
  // Only strip the numeric suffix when it matches the bottle's "display number" (`letter`).
  // This avoids breaking real labels like "... 2015".
  if (!/^\d+$/.test(l)) return base;

  const m = base.match(/^(.*\S)\s+(\d+)\s*$/);
  if (!m) return base;
  const suffix = m[2] ?? '';
  if (suffix === l) return (m[1] ?? '').trim();
  return base;
}


