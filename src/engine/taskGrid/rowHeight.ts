// Gedeelde basisrijhoogte voor het taakraster (DOM) en de Gantt-tijdlijn (canvas).
//
// Eén bron, zodat raster en tijdlijn rij-op-rij gelijk blijven lopen: `FullTaskGrid` en
// `GanttCanvas` leiden hun effectieve rijhoogte allebei af van deze waarde × tekengrootte.
// De balkgeometrie binnen de rij staat in `engine/renderer/rowGeometry.ts`.

/** Rijhoogte bij Tekengrootte 100% (px). */
export const TASK_ROW_HEIGHT = 32;

/** Kleinste rijhoogte (px): één ondergrens voor raster én tijdlijn, anders lopen ze uiteen. */
export const MIN_TASK_ROW_HEIGHT = 22;

/**
 * Rijhoogte van raster en tijdlijn: basis × tekengrootte × rijhoogte-instelling (beide in procent).
 * EÉN functie voor `FullTaskGrid` en `GanttCanvas`; een eigen afronding of ondergrens in één van de
 * twee laat de rijen na een paar honderd taken zichtbaar uit de pas lopen.
 */
export function taskRowHeight(uiFontScale: number, rowHeightScale = 100): number {
  return Math.max(MIN_TASK_ROW_HEIGHT, Math.round(TASK_ROW_HEIGHT * uiFontScale / 100 * rowHeightScale / 100));
}

/**
 * De rijhoogte waarop de balken gemaakt zijn: die van rijhoogte 100%. Een hogere rij krijgt extra
 * ruimte rond een balk van dezelfde dikte (eigenaarsbesluit 2026-11-04); een lagere rij een
 * dunnere balk, want hij moet erin passen (`barLayout` neemt het minimum).
 */
export function taskBarRowHeight(uiFontScale: number): number {
  return taskRowHeight(uiFontScale, 100);
}
