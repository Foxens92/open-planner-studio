// Rijhoogte-instelling (eigenaarsbesluit 2026-11-04): twee losse instellingen, één voor het scherm
// (taakraster + Gantt, `ui.rowHeightScale`) en één voor de Gantt-afdruk (`ReportSettings.rowHeightScale`),
// elk een percentage 75..200 in stappen van 25. De balken houden de dikte van de rij bij 100%; een
// hogere rij geeft lucht eromheen, een lagere rij een dunnere balk.
//
// Bewaakt:
//  1. Raster en tijdlijn delen één rijhoogtefunctie (afronding + ondergrens), anders lopen ze uiteen.
//  2. `barLayout` met `barRowHeight`: zelfde balk, in het midden van een hogere rij; lagere rij = rij zelf.
//  3. De afdruk: rijen schalen mee, de balkdikte niet.
//  4. Beide instellingen worden geladen, gesnapt naar een aangeboden waarde en tolerant ingelezen.
import './domStub';
import { MIN_TASK_ROW_HEIGHT, TASK_ROW_HEIGHT, taskBarRowHeight, taskRowHeight } from '@/engine/taskGrid/rowHeight';
import { barLayout } from '@/engine/renderer/rowGeometry';
import { ROW_HEIGHT_SCALES } from '@/state/slices/types';
import { loadAllSettings } from '@/utils/settingsRegistry';
import { DEFAULT_REPORT_SETTINGS, loadReportSettings } from '@/utils/reportSettings';
import { measurePrintReport, renderReport, REPORT_ROW_HEIGHT_SCALES, type PrintOptions } from '@/services/print/printPreview';
import type { Draw2D } from '@/services/pdf/draw2d';
import type { Task, TaskTime } from '@/types/task';
import type { WorkCalendar } from '@/types/calendar';

let failures = 0;
const ok = (cond: boolean, msg: string) => { if (!cond) { console.log(`XX ${msg}`); failures++; } };
const near = (a: number, b: number, eps = 1e-9) => Math.abs(a - b) <= eps;

// ── 1. Eén rijhoogte voor raster en tijdlijn ────────────────────────────────────────────────────
ok(JSON.stringify(ROW_HEIGHT_SCALES) === '[75,100,125,150,175,200]', 'schermkeuzes 75..200 per 25');
ok(JSON.stringify(REPORT_ROW_HEIGHT_SCALES) === '[75,100,125,150,175,200]', 'afdrukkeuzes 75..200 per 25');
ok(taskRowHeight(100) === TASK_ROW_HEIGHT && taskRowHeight(100, 100) === TASK_ROW_HEIGHT, '100% × 100% = de oude rij');
ok(taskRowHeight(100, 150) === 48 && taskRowHeight(125, 200) === 80, `hogere rij schaalt mee (got ${taskRowHeight(100, 150)}, ${taskRowHeight(125, 200)})`);
ok(taskRowHeight(90, 75) === MIN_TASK_ROW_HEIGHT, `ondergrens geldt voor beide (got ${taskRowHeight(90, 75)})`);
// Zonder rijhoogte-instelling blijft elke bestaande tekengrootte gelijk aan vroeger (round(32 × f)).
for (const f of [90, 100, 110, 125]) {
  ok(taskRowHeight(f) === Math.round(TASK_ROW_HEIGHT * f / 100), `tekengrootte ${f}%: rij ongewijzigd`);
  ok(taskBarRowHeight(f) === taskRowHeight(f, 100), `tekengrootte ${f}%: balkrij = rij bij 100%`);
}

// ── 2. Balkgeometrie ────────────────────────────────────────────────────────────────────────────
for (const opts of [{}, { resourceAccent: true }, { resourceAccent: true, baselines: true }]) {
  const base = barLayout(32, opts);
  const tall = barLayout(64, { ...opts, barRowHeight: 32 });
  ok(near(tall.barHeight, base.barHeight) && near(tall.accentHeight, base.accentHeight) && near(tall.baselineHeight, base.baselineHeight),
    `hogere rij: balk, accent en baseline even dik (${JSON.stringify(opts)})`);
  ok(near(tall.barOffset, base.barOffset + 16), `hogere rij: blok in het midden (got ${tall.barOffset} vs ${base.barOffset + 16})`);
  const low = barLayout(24, { ...opts, barRowHeight: 32 });
  ok(JSON.stringify(low) === JSON.stringify(barLayout(24, opts)), 'lagere rij: de rij zelf bepaalt de balk');
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
const opts = (rowHeightScale?: number): PrintOptions => ({
  showCritical: true, showFloat: false, showDeps: false, showWeekends: true, showLegend: true,
  showTaskNames: false, showCompletion: false, autoFit: false, customZoom: 20,
  paperSize: 'A3', orientation: 'landscape', companyName: 'Test', rowHeightScale,
} as PrintOptions);
const rowStep = (o: PrintOptions) => {
  const d = measurePrintReport(tasks, [], cal, 'P', o);
  const b = d.breakOffsets ?? [];
  return b[1] - b[0];
};
ok(near(rowStep(opts()), 24) && near(rowStep(opts(100)), 24), `afdruk 100%: rij 24 (got ${rowStep(opts())})`);
ok(near(rowStep(opts(150)), 36), `afdruk 150%: rij 36 (got ${rowStep(opts(150))})`);
ok(near(rowStep(opts(133)), 24 * 1.25), `afdruk: ongeldige waarde snapt naar 125% (got ${rowStep(opts(133))})`);

// Balken uit de afdruk opnemen: alleen `roundRect` telt (balken); de rest is een no-op.
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
  const body = rects.filter(r => r.y >= dims.headerHeight && r.y < dims.height - dims.footerHeight && r.h > 4);
  return { body, dims };
}
const r100 = barRects(opts(100));
const r200 = barRects(opts(200));
ok(r100.body.length === 2 && r200.body.length === 2, `twee balken getekend (got ${r100.body.length}, ${r200.body.length})`);
ok(r100.body.every((b, i) => near(b.h, r200.body[i].h)), `afdruk 200%: balken even dik (got ${r100.body.map(b => b.h)} vs ${r200.body.map(b => b.h)})`);
// Balk in het midden van zijn rij: rij i begint op headerHeight + i × rij.
ok(r200.body.every((b, i) => near(b.y + b.h / 2, r200.dims.headerHeight + (i + 0.5) * 48, 1e-6)),
  'afdruk 200%: balk in het midden van de rij');
const r75 = barRects(opts(75));
ok(r75.body.every((b, i) => b.h < r100.body[i].h), 'afdruk 75%: balk dunner, hij moet in de rij passen');

// ── 4. Instellingen laden ───────────────────────────────────────────────────────────────────────
localStorage.setItem('ops-rowHeightScale', JSON.stringify(150));
ok((await loadAllSettings()).rowHeightScale === 150, 'scherm: opgeslagen 150% wordt geladen');
localStorage.setItem('ops-rowHeightScale', JSON.stringify(140));
ok((await loadAllSettings()).rowHeightScale === 150, 'scherm: 140 snapt naar 150');
localStorage.setItem('ops-rowHeightScale', JSON.stringify('hoog'));
ok((await loadAllSettings()).rowHeightScale === undefined, 'scherm: rommel ⇒ store-default blijft');
ok(DEFAULT_REPORT_SETTINGS.rowHeightScale === 100, 'afdruk: default 100%');
localStorage.setItem('ops-reportSettings', JSON.stringify({ rowHeightScale: 175 }));
ok((await loadReportSettings()).rowHeightScale === 175, 'afdruk: opgeslagen 175% wordt geladen');
localStorage.setItem('ops-reportSettings', JSON.stringify({ rowHeightScale: 'veel' }));
ok((await loadReportSettings()).rowHeightScale === 100, 'afdruk: rommel ⇒ default');

if (failures > 0) { console.log(`row-height-setting: ${failures} faalregels`); process.exit(1); }
console.log('row-height-setting: alles groen');
