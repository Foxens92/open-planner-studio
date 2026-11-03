/**
 * A0 en plotterrol 914 mm in de gedeelde pagineerwiskunde (`computeTileLayout`).
 *
 * Bewaakt:
 *  1. A0 bestaat met de ISO-maat (841 x 1189 mm) en gedraagt zich als elk ander vel.
 *  2. Rol staand: paginabreedte = 914 mm, de lengte volgt de inhoud (één doorlopende band zonder
 *     wit eronder); voorbij de grootste lengte (14 400 pt) loopt hij over op meer pagina's.
 *  3. Rol liggend: paginahoogte = 914 mm, de breedte volgt de inhoud; Auto-fit telt niet (de
 *     pagineerder rekent in 'actual' en de render volgt de handmatige zoom).
 *  4. A0 en rol vragen de lezer op ware grootte af te drukken (`/PrintScaling /None`); A3 niet.
 *  5. De preview-rasterlimieten rekenen met de echte (ingekorte) paginamaat.
 */
import {
  computeTileLayout, isRollPaper, MAX_PAGE_LENGTH_PT, PAPER_PT, printsAtActualSize, ROLL_914_WIDTH_PT,
  rollRunsAlongTimeline, toPaperSize, LOGICAL_PX_TO_PT, DEFAULT_MARGIN_PT, PAGE_NUMBER_PT,
} from '@/services/print/tileLayout';
import { measurePrintReport, type PrintOptions } from '@/services/print/printPreview';
import { computePreviewRasterLimits } from '@/services/print/previewSafety';
import { buildImagePdf } from '@/utils/miniPdf';
import { PAPER_SIZES } from '@/utils/reportSettings';
import type { Task, TaskTime } from '@/types/task';
import type { WorkCalendar } from '@/types/calendar';

let failures = 0;
const fail = (msg: string) => { console.log(`XX ${msg}`); failures++; };
const ok = (cond: boolean, msg: string) => { if (!cond) fail(msg); };
const near = (a: number, b: number, eps = 1e-6) => Math.abs(a - b) <= eps;
const mmToPt = (mm: number) => (mm / 25.4) * 72;

// ── 1. A0 ──────────────────────────────────────────────────────────────────────────────────────
ok(near(PAPER_PT.a0.width, mmToPt(841), 0.05) && near(PAPER_PT.a0.height, mmToPt(1189), 0.05),
  `A0 = 841 x 1189 mm (got ${PAPER_PT.a0.width} x ${PAPER_PT.a0.height} pt)`);
ok(PAPER_SIZES.includes('A0') && PAPER_SIZES.includes('ROLL914'), 'rapportinstelling kent A0 en ROLL914');
ok(toPaperSize('ROLL914') === 'roll914' && toPaperSize('A0') === 'a0', 'toPaperSize: rapportwaarde → pagineersleutel');
{
  const layout = computeTileLayout({
    paperSize: 'a0', orientation: 'landscape', mode: 'fit-width', logicalWidth: 3000, logicalHeight: 800,
  });
  ok(near(layout.pageWidthPt, PAPER_PT.a0.height) && near(layout.pageHeightPt, PAPER_PT.a0.width),
    'A0 landscape: vaste vel-maat, liggend');
  ok(near(layout.scale, (PAPER_PT.a0.height - 2 * DEFAULT_MARGIN_PT) / 3000), 'A0 fit-width: bron op paginabreedte');
}

// ── 2. Rol staand ──────────────────────────────────────────────────────────────────────────────
ok(near(ROLL_914_WIDTH_PT, mmToPt(914)) && isRollPaper('roll914') && !isRollPaper('a0'), 'rol = 914 mm, A0 is geen rol');
ok(!rollRunsAlongTimeline('roll914', 'portrait') && rollRunsAlongTimeline('roll914', 'landscape')
  && !rollRunsAlongTimeline('a0', 'landscape'), 'rollRunsAlongTimeline: alleen rol liggend');
{
  const cw = 2400;
  const ch = 6000;
  const header = 120;
  const layout = computeTileLayout({
    paperSize: 'roll914', orientation: 'portrait', mode: 'fit-width', logicalWidth: cw, logicalHeight: ch,
    frozenColumnWidthPx: 500, repeatHeaderHeightPx: header, repeatFooterHeightPx: 90,
  });
  const printW = ROLL_914_WIDTH_PT - 2 * DEFAULT_MARGIN_PT;
  ok(near(layout.pageWidthPt, ROLL_914_WIDTH_PT), 'rol staand: paginabreedte = rolbreedte');
  ok(near(layout.scale, printW / cw), 'rol staand fit-width: bron op rolbreedte');
  ok(layout.rows === 1 && layout.cols === 1, `rol staand: één doorlopende pagina (got ${layout.rows}x${layout.cols})`);
  ok(near(layout.printH, ch * layout.scale), `rol staand: printhoogte = inhoud (got ${layout.printH} vs ${ch * layout.scale})`);
  ok(near(layout.pageHeightPt, ch * layout.scale + 2 * DEFAULT_MARGIN_PT + PAGE_NUMBER_PT), 'rol staand: paginalengte = inhoud + marges');
  ok(layout.repeatFooterPx === 0, 'rol staand op één pagina: voet blijft onder de laatste rij');
  ok(near(layout.bodyRows[0].srcY, header) && near(layout.bodyRows[0].srcY + layout.bodyRows[0].srcH, ch),
    'rol staand: body loopt van onder de kop tot het einde van de bron');
}
{
  // Langer dan de grootste lengte: meer pagina's, elk zo lang als de grootste tegel en ≤ 14 400 pt.
  const cw = 2400;
  const scale = (ROLL_914_WIDTH_PT - 2 * DEFAULT_MARGIN_PT) / cw;
  const ch = Math.ceil((MAX_PAGE_LENGTH_PT * 2.5) / scale);
  const rowBreaks = Array.from({ length: Math.floor(ch / 20) }, (_, i) => (i + 1) * 20);
  const layout = computeTileLayout({
    paperSize: 'roll914', orientation: 'portrait', mode: 'fit-width', logicalWidth: cw, logicalHeight: ch,
    repeatHeaderHeightPx: 100, repeatFooterHeightPx: 80, breakOffsetsPx: rowBreaks,
  });
  ok(layout.rows === 3, `rol staand > 5,08 m: drie pagina's (got ${layout.rows})`);
  ok(layout.pageHeightPt <= MAX_PAGE_LENGTH_PT + 1e-6, `rol staand: geen pagina langer dan 14 400 pt (got ${layout.pageHeightPt})`);
  const tallest = Math.max(...layout.bodyRows.map(r => r.srcH));
  ok(near(layout.printH, (100 + tallest + 80) * layout.scale), 'rol staand meerdere pagina\'s: lengte = grootste tegel + kop + voet');
  ok(near(layout.footerTopPt, layout.marginPt + layout.printH - layout.repeatFooterPtH), 'rol staand: voet direct onder de grootste tegel');
}

// ── 3. Rol liggend ─────────────────────────────────────────────────────────────────────────────
{
  const cw = 9000;
  const ch = 1200;
  const fit = computeTileLayout({
    paperSize: 'roll914', orientation: 'landscape', mode: 'fit-width', logicalWidth: cw, logicalHeight: ch, frozenColumnWidthPx: 600,
  });
  const actual = computeTileLayout({
    paperSize: 'roll914', orientation: 'landscape', mode: 'actual', logicalWidth: cw, logicalHeight: ch, frozenColumnWidthPx: 600,
  });
  ok(JSON.stringify(fit) === JSON.stringify(actual), 'rol liggend: fit-width rekent als actual');
  ok(near(fit.scale, LOGICAL_PX_TO_PT), 'rol liggend: vaste CSS→papierverhouding');
  ok(near(fit.pageHeightPt, ROLL_914_WIDTH_PT), 'rol liggend: paginahoogte = rolbreedte');
  ok(fit.cols === 1 && near(fit.printW, cw * LOGICAL_PX_TO_PT), `rol liggend: één band zo lang als de inhoud (got ${fit.cols} kol, ${fit.printW} pt)`);
  ok(near(fit.pageWidthPt, cw * LOGICAL_PX_TO_PT + 2 * DEFAULT_MARGIN_PT), 'rol liggend: paginabreedte = inhoud + marges');
  ok(near(fit.footerWindow.srcW, cw) && near(fit.footerLayoutWidthPx, cw), 'rol liggend: voet binnen de echte paginabreedte');
}
{
  // Band langer dan 14 400 pt: overloop met de bevroren naamkolom herhaald.
  const cw = Math.ceil((MAX_PAGE_LENGTH_PT * 1.5) / LOGICAL_PX_TO_PT);
  const layout = computeTileLayout({
    paperSize: 'roll914', orientation: 'landscape', mode: 'actual', logicalWidth: cw, logicalHeight: 800, frozenColumnWidthPx: 500,
  });
  ok(layout.cols === 2, `rol liggend > 5,08 m: twee pagina's (got ${layout.cols})`);
  ok(near(layout.pageWidthPt, MAX_PAGE_LENGTH_PT), `rol liggend overloop: volle lengte per pagina (got ${layout.pageWidthPt})`);
  ok(layout.columns[1].xWindows.length === 2 && layout.columns[1].xWindows[0].srcX === 0, 'rol liggend overloop: naamkolom herhaald');
}

// De render negeert Auto-fit bij een rol liggend: de tijdlijn volgt de zoom.
{
  const cal = {
    id: 'c1', name: 'Standaard', description: '', workDays: [1, 2, 3, 4, 5, 6, 7],
    workStartHour: 7, workEndHour: 15, hoursPerDay: 8, holidays: [],
  } as unknown as WorkCalendar;
  const time = {
    earlyStart: '2026-01-05', earlyFinish: '2026-03-27', lateStart: '', lateFinish: '',
    duration: 60, totalFloat: 0, isCritical: false, completion: 0,
    scheduleStart: '2026-01-05', scheduleFinish: '2026-03-27',
  } as unknown as TaskTime;
  const task = {
    id: 't1', name: 'Ruwbouw', parentId: undefined, childIds: [], isMilestone: false, wbsCode: '1',
    taskType: 'CONSTRUCTION', activityCodes: {}, customFields: {}, time,
  } as unknown as Task;
  const opts = (over: Partial<PrintOptions>): PrintOptions => ({
    showCritical: true, showFloat: true, showDeps: true, showWeekends: true, showLegend: true,
    showTaskNames: true, showCompletion: true, autoFit: true, customZoom: 22,
    paperSize: 'ROLL914', orientation: 'landscape', companyName: 'Test',
    ...over,
  } as PrintOptions);
  const auto = measurePrintReport([task], [], cal, 'P', opts({ autoFit: true }));
  const manual = measurePrintReport([task], [], cal, 'P', opts({ autoFit: false }));
  ok(auto.width === manual.width, `rol liggend: Auto-fit genegeerd (breedte ${auto.width} vs ${manual.width})`);
  const portrait = measurePrintReport([task], [], cal, 'P', opts({ orientation: 'portrait', autoFit: true }));
  const portraitAvail = (ROLL_914_WIDTH_PT - 2 * DEFAULT_MARGIN_PT) / LOGICAL_PX_TO_PT;
  ok(Math.abs(portrait.width - portraitAvail) < 2, `rol staand Auto-fit: tijdlijn vult de rolbreedte (got ${portrait.width} vs ${portraitAvail})`);
  const a0 = measurePrintReport([task], [], cal, 'P', opts({ paperSize: 'A0', autoFit: true }));
  const a0Avail = (PAPER_PT.a0.height - 2 * DEFAULT_MARGIN_PT) / LOGICAL_PX_TO_PT;
  ok(Math.abs(a0.width - a0Avail) < 2, `A0 liggend Auto-fit: tijdlijn vult de A0-breedte (got ${a0.width} vs ${a0Avail})`);
}

// ── 4. Afdrukken op ware grootte ───────────────────────────────────────────────────────────────
ok(printsAtActualSize('a0') && printsAtActualSize('roll914') && !printsAtActualSize('a3') && !printsAtActualSize('a1'),
  'printsAtActualSize: alleen A0 en rol');
{
  const page = { jpegBytes: new Uint8Array([0xff, 0xd8, 0xff, 0xd9]), widthPt: 100, heightPt: 100, imageWidthPx: 1, imageHeightPx: 1 };
  const text = (bytes: Uint8Array) => new TextDecoder('latin1').decode(bytes);
  ok(text(buildImagePdf([page], { printScalingNone: true })).includes('/ViewerPreferences << /PrintScaling /None >>'),
    'raster-PDF: PrintScaling None wanneer gevraagd');
  ok(!text(buildImagePdf([page])).includes('/PrintScaling'), 'raster-PDF: standaard geen PrintScaling');
}

// ── 5. Preview met de echte paginamaat ─────────────────────────────────────────────────────────
{
  const sheet = computePreviewRasterLimits(1000, 1000, 'roll914', 'portrait', 900, 1, 2);
  const real = computePreviewRasterLimits(1000, 1000, 'roll914', 'portrait', 900, 1, 2, { width: ROLL_914_WIDTH_PT, height: 1500 });
  ok(real.pageRasterHeight < sheet.pageRasterHeight, 'preview: korte rol krijgt een lagere rasterpagina dan de grootste lengte');
  ok(near(real.pageRasterHeight / real.pageRasterWidth, 1500 / ROLL_914_WIDTH_PT, 0.01), 'preview: rasterverhouding = echte paginaverhouding');
}

if (failures > 0) { console.log(`print-roll-paper: ${failures} faalregels`); process.exit(1); }
console.log('print-roll-paper: alles groen');
