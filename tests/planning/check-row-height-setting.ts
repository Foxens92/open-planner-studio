// Tekengrootte en rijhoogte in PIXELS, op scherm en in de afdruk (eigenaarsbesluiten 2026-11-04):
// twee losse instellingen per kant, elk met een knop terug naar de standaard (de oude 100 %).
//  - Scherm: tekengrootte = de tekstrol `body` (11 px = 100 %), intern `ui.uiFontScale` als vrij
//    percentage; rijhoogte = `ui.rowHeightPx` (22..96, `null` = automatisch: 32 px × tekengrootte).
//  - Afdruk: lettergrootte = de taaknaam (9 px = 100 %), intern `reportFontScale`; rijhoogte =
//    `rowHeightPx` (12..96, `null` = automatisch: 24 px × lettergrootte).
// De balken houden de dikte van de automatische rij; een hogere rij geeft lucht eromheen.
//
// Bewaakt:
//  1. Raster en tijdlijn delen één rijhoogtefunctie (afronding + grenzen), anders lopen ze uiteen.
//  2. `barLayout` met `barRowHeight`: zelfde balk, in het midden van een hogere rij.
//  3. De afdruk: px-rij, automatische rij, vrije lettergrootte, klemmen; balkdikte vast.
//  4. Laden van alle vier de waarden, tolerant, met oude trapwaarden ongewijzigd.
//  5. De px-invoer: klemmen, afronden op de stap, onleesbare invoer.
import './domStub';
import { MAX_TASK_ROW_HEIGHT, MIN_TASK_ROW_HEIGHT, TASK_ROW_HEIGHT, taskBarRowHeight, taskRowHeight } from '@/engine/taskGrid/rowHeight';
import { barLayout } from '@/engine/renderer/rowGeometry';
import {
  ROW_HEIGHT_PX_MAX, ROW_HEIGHT_PX_MIN, UI_FONT_SCALE_MAX, UI_FONT_SCALE_MIN, UI_TEXT_BASE_PX,
} from '@/state/slices/types';
import { loadAllSettings } from '@/utils/settingsRegistry';
import { DEFAULT_REPORT_SETTINGS, loadReportSettings } from '@/utils/reportSettings';
import {
  measurePrintReport, renderReport, reportAutoRowHeightPx, REPORT_FONT_SCALE_MAX, REPORT_ROW_PX_MIN,
  type PrintOptions,
} from '@/services/print/printPreview';
import { normalizePx, formatPx } from '@/utils/pxSize';
import type { Draw2D } from '@/services/pdf/draw2d';
import type { Task, TaskTime } from '@/types/task';
import type { WorkCalendar } from '@/types/calendar';

let failures = 0;
const ok = (cond: boolean, msg: string) => { if (!cond) { console.log(`XX ${msg}`); failures++; } };
const near = (a: number, b: number, eps = 1e-9) => Math.abs(a - b) <= eps;

// ── 1. Eén rijhoogte voor raster en tijdlijn ────────────────────────────────────────────────────
ok(MIN_TASK_ROW_HEIGHT === ROW_HEIGHT_PX_MIN && MAX_TASK_ROW_HEIGHT === ROW_HEIGHT_PX_MAX, 'grenzen van functie en instelling gelijk');
ok(taskRowHeight(100) === TASK_ROW_HEIGHT && taskRowHeight(100, null) === TASK_ROW_HEIGHT, 'automatisch bij 100 % = de oude rij (32)');
ok(taskRowHeight(100, 48) === 48 && taskRowHeight(125, 48) === 48, 'ingestelde px is absoluut, los van de tekengrootte');
ok(taskRowHeight(100, 10) === MIN_TASK_ROW_HEIGHT && taskRowHeight(100, 500) === MAX_TASK_ROW_HEIGHT, 'ingestelde px geklemd');
ok(taskRowHeight(100, 40.6) === 41, 'ingestelde px afgerond op hele px');
// Automatisch blijft voor elke oude tekengrootte gelijk aan vroeger (round(32 × f)).
for (const f of [90, 100, 110, 125]) {
  ok(taskRowHeight(f) === Math.round(TASK_ROW_HEIGHT * f / 100), `tekengrootte ${f}%: automatische rij ongewijzigd`);
  ok(taskBarRowHeight(f) === taskRowHeight(f, null), `tekengrootte ${f}%: balkrij = automatische rij`);
}
ok(taskRowHeight(12 / UI_TEXT_BASE_PX * 100) === Math.round(TASK_ROW_HEIGHT * 12 / 11), 'tekengrootte 12 px: automatische rij schaalt mee');

// ── 2. Balkgeometrie ────────────────────────────────────────────────────────────────────────────
for (const opts of [{}, { resourceAccent: true }, { resourceAccent: true, baselines: true }]) {
  const base = barLayout(32, opts);
  const tall = barLayout(64, { ...opts, barRowHeight: 32 });
  ok(near(tall.barHeight, base.barHeight) && near(tall.accentHeight, base.accentHeight) && near(tall.baselineHeight, base.baselineHeight),
    `hogere rij: balk, accent en baseline even dik (${JSON.stringify(opts)})`);
  ok(near(tall.barOffset, base.barOffset + 16), `hogere rij: blok in het midden (got ${tall.barOffset} vs ${base.barOffset + 16})`);
  ok(JSON.stringify(barLayout(24, { ...opts, barRowHeight: 32 })) === JSON.stringify(barLayout(24, opts)), 'lagere rij: de rij zelf bepaalt de balk');
  ok(JSON.stringify(barLayout(32, { ...opts, barRowHeight: 32 })) === JSON.stringify(base), 'gelijke rij: byte-identiek');
}
ok(JSON.stringify(barLayout(40, { barRowHeight: Number.NaN })) === JSON.stringify(barLayout(40)), 'onbruikbare barRowHeight: genegeerd');

// ── 3. Afdruk ───────────────────────────────────────────────────────────────────────────────────
const cal = {
  id: 'c1', name: 'Standaard', description: '', workDays: [1, 2, 3, 4, 5, 6, 7],
  workStartHour: 7, workEndHour: 15, hoursPerDay: 8, holidays: [],
} as unknown as WorkCalendar;
const mkTask = (id: string, start: string, finish: string): Task => ({
  id, name: id, parentId: undefined, childIds: [], isMilestone: false, wbsCode: id,
  taskType: 'CONSTRUCTION', activityCodes: {}, customFields: {},
  time: {
    earlyStart: start, earlyFinish: finish, lateStart: '', lateFinish: '', duration: 5, totalFloat: 0,
    isCritical: false, completion: 0, scheduleStart: start, scheduleFinish: finish,
  } as unknown as TaskTime,
} as unknown as Task);
const tasks = [mkTask('a', '2026-01-05', '2026-01-09'), mkTask('b', '2026-01-12', '2026-01-16')];
const opts = (over: Partial<PrintOptions> = {}): PrintOptions => ({
  showCritical: true, showFloat: false, showDeps: false, showWeekends: true, showLegend: true,
  showTaskNames: false, showCompletion: false, autoFit: false, customZoom: 20,
  paperSize: 'A3', orientation: 'landscape', companyName: 'Test', ...over,
} as PrintOptions);
const rowStep = (o: PrintOptions) => {
  const b = measurePrintReport(tasks, [], cal, 'P', o).breakOffsets ?? [];
  return b[1] - b[0];
};
ok(near(rowStep(opts()), 24) && near(rowStep(opts({ rowHeightPx: null })), 24), `afdruk automatisch: rij 24 (got ${rowStep(opts())})`);
ok(near(rowStep(opts({ reportFontScale: 125 })), 30), 'afdruk automatisch volgt de lettergrootte (125 % ⇒ 30)');
ok(near(rowStep(opts({ rowHeightPx: 40 })), 40) && near(rowStep(opts({ rowHeightPx: 40, reportFontScale: 125 })), 40), 'afdruk ingesteld: absolute px');
ok(near(rowStep(opts({ rowHeightPx: 2 })), REPORT_ROW_PX_MIN), 'afdruk ingesteld: geklemd op de ondergrens');
ok(near(rowStep(opts({ reportFontScale: 1000 })), 24 * REPORT_FONT_SCALE_MAX / 100), 'afdruk: lettergrootte geklemd op de bovengrens');
ok(near(reportAutoRowHeightPx(12 / 9 * 100), 32), 'afdruk: lettergrootte 12 px ⇒ automatische rij 32');

function barRects(o: PrintOptions) {
  const rects: { y: number; h: number }[] = [];
  const st: Record<string, unknown> = {};
  const d2d = new Proxy({} as Draw2D, {
    get(_t, prop: string) {
      if (prop === 'roundRect') return (_x: number, y: number, _w: number, h: number) => { rects.push({ y, h }); };
      if (prop === 'measureText') return (t: string) => ({ width: t.length * 6 });
      if (prop in st) return st[prop];
      return () => {};
    },
    set(_t, prop: string, v) { st[prop] = v; return true; },
  });
  const dims = renderReport(() => d2d, tasks, [], cal, 'P', o);
  return { body: rects.filter(r => r.y >= dims.headerHeight && r.y < dims.height - dims.footerHeight && r.h > 4), dims };
}
const auto = barRects(opts());
const tall = barRects(opts({ rowHeightPx: 48 }));
ok(auto.body.length === 2 && tall.body.length === 2, `twee balken getekend (got ${auto.body.length}, ${tall.body.length})`);
ok(auto.body.every((b, i) => near(b.h, tall.body[i].h)), 'afdruk 48 px: balken even dik als automatisch');
ok(tall.body.every((b, i) => near(b.y + b.h / 2, tall.dims.headerHeight + (i + 0.5) * 48, 1e-6)), 'afdruk 48 px: balk in het midden van de rij');
ok(barRects(opts({ rowHeightPx: 14 })).body.every((b, i) => b.h < auto.body[i].h), 'afdruk 14 px: balk dunner, hij moet in de rij passen');

// ── 4. Instellingen laden ───────────────────────────────────────────────────────────────────────
const load = async () => loadAllSettings();
localStorage.setItem('ops-uiFontScale', JSON.stringify(110));
ok((await load()).uiFontScale === 110, 'scherm: oude trapwaarde 110 % blijft 110 %');
localStorage.setItem('ops-uiFontScale', JSON.stringify(12.5 / 11 * 100));
ok(near((await load()).uiFontScale ?? 0, 12.5 / 11 * 100), 'scherm: vrije tekengrootte (12,5 px) wordt geladen');
localStorage.setItem('ops-uiFontScale', JSON.stringify(400));
ok((await load()).uiFontScale === UI_FONT_SCALE_MAX, 'scherm: te grote tekengrootte geklemd');
localStorage.setItem('ops-uiFontScale', JSON.stringify(10));
ok((await load()).uiFontScale === UI_FONT_SCALE_MIN, 'scherm: te kleine tekengrootte geklemd');
localStorage.setItem('ops-rowHeightPx', JSON.stringify(48));
ok((await load()).rowHeightPx === 48, 'scherm: opgeslagen rijhoogte 48 px wordt geladen');
localStorage.setItem('ops-rowHeightPx', JSON.stringify(200));
ok((await load()).rowHeightPx === ROW_HEIGHT_PX_MAX, 'scherm: te hoge rij geklemd');
localStorage.setItem('ops-rowHeightPx', 'null');
ok((await load()).rowHeightPx === undefined, 'scherm: terug naar standaard (null) ⇒ store-default (automatisch)');

ok(DEFAULT_REPORT_SETTINGS.rowHeightPx === null && DEFAULT_REPORT_SETTINGS.reportFontScale === 100, 'afdruk: defaults automatisch en 100 %');
localStorage.setItem('ops-reportSettings', JSON.stringify({ rowHeightPx: 36, reportFontScale: 12 / 9 * 100 }));
const rs = await loadReportSettings();
ok(rs.rowHeightPx === 36 && near(rs.reportFontScale, 12 / 9 * 100), 'afdruk: px-rij en vrije lettergrootte worden geladen');
localStorage.setItem('ops-reportSettings', JSON.stringify({ rowHeightPx: 'hoog', reportFontScale: 'groot' }));
const junk = await loadReportSettings();
ok(junk.rowHeightPx === null && junk.reportFontScale === 100, 'afdruk: rommel ⇒ defaults');
localStorage.setItem('ops-reportSettings', JSON.stringify({ reportFontScale: 125 }));
ok((await loadReportSettings()).reportFontScale === 125, 'afdruk: oude trapwaarde 125 % blijft 125 %');

// ── 5. De px-invoer ─────────────────────────────────────────────────────────────────────────────
ok(normalizePx('12,3', 9, 14, 0.5) === 12.5, 'invoer: komma als decimaalteken, afgerond op de stap');
ok(normalizePx('99', 9, 14, 0.5) === 14 && normalizePx('1', 9, 14, 0.5) === 9, 'invoer: geklemd');
ok(normalizePx('', 9, 14, 0.5) === undefined && normalizePx('  ', 9, 14, 0.5) === undefined, 'invoer: leeg veld ⇒ niets (de vorige waarde blijft)');
ok(normalizePx('abc', 9, 14, 0.5) === undefined, 'invoer: onleesbaar ⇒ niets');
ok(formatPx(11 * 110 / 100) === '12.1', `weergave zonder lange decimalen (got ${formatPx(11 * 110 / 100)})`);

if (failures > 0) { console.log(`row-height-setting: ${failures} faalregels`); process.exit(1); }
console.log('row-height-setting: alles groen');
