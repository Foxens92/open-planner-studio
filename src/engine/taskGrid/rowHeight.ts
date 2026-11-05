// Gedeelde basisrijhoogte voor het taakraster (DOM) en de Gantt-tijdlijn (canvas).
//
// Eén bron, zodat raster en tijdlijn rij-op-rij gelijk blijven lopen: `FullTaskGrid` en
// `GanttCanvas` leiden hun effectieve rijhoogte allebei af van deze waarde × tekengrootte.
// De balkgeometrie binnen de rij staat in `engine/renderer/rowGeometry.ts`.

/** Rijhoogte bij Tekengrootte 100% (px). */
export const TASK_ROW_HEIGHT = 32;

/** Kleinste rijhoogte (px): één ondergrens voor raster én tijdlijn, anders lopen ze uiteen. */
export const MIN_TASK_ROW_HEIGHT = 22;
/** Grootste rijhoogte (px) die de instelling toelaat. */
export const MAX_TASK_ROW_HEIGHT = 96;

/**
 * De automatische rijhoogte (de standaard, "100 %"): 32 px × tekengrootte, met de ondergrens.
 * Hierop zijn de balken gemaakt: een hogere rij krijgt extra ruimte rond een balk van dezelfde dikte
 * (eigenaarsbesluit 2026-11-04); een lagere rij een dunnere balk (`barLayout` neemt het minimum).
 */
export function taskBarRowHeight(uiFontScale: number): number {
  return Math.max(MIN_TASK_ROW_HEIGHT, Math.round(TASK_ROW_HEIGHT * uiFontScale / 100));
}

/**
 * Rijhoogte van raster en tijdlijn: de ingestelde px (`ui.rowHeightPx`), of de automatische rij als
 * die `null` is. EÉN functie voor `FullTaskGrid` en `GanttCanvas`; een eigen afronding of ondergrens
 * in één van de twee laat de rijen na een paar honderd taken zichtbaar uit de pas lopen.
 */
export function taskRowHeight(uiFontScale: number, rowHeightPx: number | null = null): number {
  if (rowHeightPx === null || !Number.isFinite(rowHeightPx)) return taskBarRowHeight(uiFontScale);
  return Math.min(MAX_TASK_ROW_HEIGHT, Math.max(MIN_TASK_ROW_HEIGHT, Math.round(rowHeightPx)));
}
