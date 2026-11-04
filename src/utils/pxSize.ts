/**
 * Rekenhulp voor een maat in pixels (tekstgrootte of rijhoogte) die de gebruiker typt, gedeeld door
 * `PxSizeField` en de tests. Puur, zonder React.
 */

/** Klem op het bereik en rond af op de stap; `undefined` bij lege of onleesbare invoer. */
export function normalizePx(raw: string | number, min: number, max: number, step: number): number | undefined {
  const text = typeof raw === 'number' ? String(raw) : raw.trim().replace(',', '.');
  if (text === '') return undefined;
  const n = Number(text);
  if (!Number.isFinite(n)) return undefined;
  const clamped = Math.min(max, Math.max(min, n));
  const stepped = Math.round(clamped / step) * step;
  // Afronding op de stap kan net buiten het bereik vallen (bv. max 13,75 bij stap 0,5).
  return Math.min(max, Math.max(min, Number(stepped.toFixed(4))));
}

/** Toon een px-waarde zonder lange decimalen ("12.1", niet "12.100000000000001"). */
export function formatPx(px: number): string {
  return String(Number(px.toFixed(2)));
}
