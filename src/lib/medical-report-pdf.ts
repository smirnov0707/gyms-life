import type { MedicalReport } from "./medical-report.functions";
import { formatLocale, tr, type Lang } from "./i18n";
import { browserTimeZone, dayInTimeZone } from "./local-day";

/**
 * Draws the 30-day report on canvases first (so diacritics render correctly)
 * and packs them into a downloadable A4 PDF.
 */

const SCALE = 2.5;
const PAGE_W = 595;
const PAGE_H = 842;
const MARGIN = 44;
const BOTTOM = PAGE_H - 52;

type Ctx = CanvasRenderingContext2D;

function newPage() {
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(PAGE_W * SCALE);
  canvas.height = Math.round(PAGE_H * SCALE);
  const ctx = canvas.getContext("2d")!;
  ctx.scale(SCALE, SCALE);
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, PAGE_W, PAGE_H);
  ctx.textBaseline = "alphabetic";
  return { canvas, ctx };
}

function wrap(ctx: Ctx, text: string, maxWidth: number): string[] {
  const lines: string[] = [];
  for (const paragraph of text.split("\n")) {
    let line = "";
    for (const word of paragraph.split(/\s+/)) {
      const candidate = line ? `${line} ${word}` : word;
      if (ctx.measureText(candidate).width > maxWidth && line) {
        lines.push(line);
        line = word;
      } else line = candidate;
    }
    lines.push(line);
  }
  return lines;
}

export async function downloadMedicalReportPdf(
  report: MedicalReport,
  lang: Lang,
  displayName: string,
) {
  const { jsPDF } = await import("jspdf");
  const s = report.stats;
  // These documents are built in the browser and carry the athlete's own
  // date. The UTC slice put yesterday's date on a report generated in the
  // evening west of Greenwich, and tomorrow's east of it.
  const today = dayInTimeZone(new Date(), browserTimeZone());

  const txt = {
    title: tr(lang, "sc.report.pdfTitle"),
    period: tr(lang, "sc.report.period"),
    subject: tr(lang, "sc.report.subject"),
    adherence: tr(lang, "sc.report.adherence"),
    risks: tr(lang, "sc.report.risks"),
    recs: tr(lang, "sc.report.recs"),
    questions: tr(lang, "sc.report.questions"),
    gaps: tr(lang, "sc.report.gaps"),
    disclaimer: tr(lang, "sc.report.disclaimer"),
    page: tr(lang, "sc.report.page"),
  };

  const pages: HTMLCanvasElement[] = [];
  let page = newPage();
  let y = 0;

  const finish = () => {
    const { ctx } = page;
    ctx.fillStyle = "#8b8f83";
    ctx.font = "400 7.5px Helvetica, Arial, sans-serif";
    for (const [i, line] of wrap(ctx, txt.disclaimer, PAGE_W - MARGIN * 2 - 60)
      .slice(0, 2)
      .entries()) {
      ctx.fillText(line, MARGIN, PAGE_H - 30 + i * 9);
    }
    const label = `${txt.page} ${pages.length + 1}`;
    ctx.fillText(label, PAGE_W - MARGIN - ctx.measureText(label).width, PAGE_H - 30);
    pages.push(page.canvas);
  };

  const header = (first: boolean) => {
    const { ctx } = page;
    const h = first ? 108 : 54;
    ctx.fillStyle = "#12140f";
    ctx.fillRect(0, 0, PAGE_W, h);
    ctx.fillStyle = "#c6f24e";
    ctx.fillRect(0, h, PAGE_W, 4);
    ctx.fillStyle = "#c6f24e";
    ctx.font = `700 ${first ? 28 : 16}px "Bebas Neue", Impact, sans-serif`;
    ctx.fillText(txt.title, MARGIN, first ? 54 : 34);
    ctx.fillStyle = "#ffffff";
    ctx.font = "400 10px Helvetica, Arial, sans-serif";
    if (first) {
      ctx.fillText(`${txt.subject}: ${displayName || "—"}`, MARGIN, 76);
      ctx.fillText(`${txt.period}: ${s.from} — ${s.to}`, MARGIN, 92);
      const brand = "GYMS.LIFE";
      ctx.font = '700 18px "Bebas Neue", Impact, sans-serif';
      ctx.fillText(brand, PAGE_W - MARGIN - ctx.measureText(brand).width, 54);
    } else {
      ctx.fillText("GYMS.LIFE", PAGE_W - MARGIN - ctx.measureText("GYMS.LIFE").width, 34);
    }
    y = first ? 140 : 86;
  };

  const ensure = (needed: number) => {
    if (y + needed <= BOTTOM) return;
    finish();
    page = newPage();
    header(false);
  };

  const para = (text: string, size = 10, color = "#3c4034") => {
    const c = page.ctx;
    c.font = `400 ${size}px Helvetica, Arial, sans-serif`;
    for (const line of wrap(c, text, PAGE_W - MARGIN * 2)) {
      ensure(size + 4);
      page.ctx.font = `400 ${size}px Helvetica, Arial, sans-serif`;
      page.ctx.fillStyle = color;
      page.ctx.fillText(line, MARGIN, y);
      y += size + 3.5;
    }
  };

  const heading = (label: string) => {
    ensure(34);
    const c = page.ctx;
    c.fillStyle = "#c6f24e";
    c.fillRect(MARGIN, y - 9, 22, 3);
    c.fillStyle = "#12140f";
    c.font = '700 14px "Bebas Neue", Helvetica, Arial, sans-serif';
    c.fillText(label.toUpperCase(), MARGIN + 30, y + 2);
    y += 20;
  };

  header(true);

  // headline + adherence badge
  {
    const c = page.ctx;
    c.fillStyle = "#f3f5ee";
    c.fillRect(MARGIN, y - 18, PAGE_W - MARGIN * 2, 56);
    c.fillStyle = "#12140f";
    c.font = '700 15px "Bebas Neue", Helvetica, Arial, sans-serif';
    c.fillText(report.headline.toUpperCase().slice(0, 58), MARGIN + 12, y);
    c.font = "400 9.5px Helvetica, Arial, sans-serif";
    c.fillStyle = "#3c4034";
    const scoreTxt = `${txt.adherence}: ${report.adherence.score}/100 · ${report.adherence.label}`;
    c.fillText(scoreTxt, MARGIN + 12, y + 16);
    // score bar
    const barX = MARGIN + 12;
    const barW = PAGE_W - MARGIN * 2 - 24;
    c.fillStyle = "#dde1d3";
    c.fillRect(barX, y + 24, barW, 5);
    c.fillStyle =
      report.adherence.score >= 70
        ? "#4a9d3f"
        : report.adherence.score >= 40
          ? "#c99a1e"
          : "#c0392b";
    c.fillRect(barX, y + 24, (barW * report.adherence.score) / 100, 5);
    y += 52;
  }

  para(report.summary);
  y += 8;

  // key stats grid
  heading(txt.period);
  {
    const cells: [string, string][] = [
      [tr(lang, "sc.report.sessions"), `${s.sessions} (${s.sessionsPerWeek}/w)`],
      [
        tr(lang, "sc.report.totalTonnage"),
        `${s.totalVolumeKg.toLocaleString(formatLocale(lang))} kg`,
      ],
      [tr(lang, "sc.report.trainingTime"), `${s.trainingMinutes} min`],
      [tr(lang, "sc.report.readiness"), s.avgReadiness != null ? `${s.avgReadiness}/100` : "—"],
      [tr(lang, "sc.report.sleep"), s.avgSleepHours != null ? `${s.avgSleepHours} h` : "—"],
      [tr(lang, "sc.report.kcal"), s.avgKcal != null ? `${s.avgKcal} kcal` : "—"],
      [tr(lang, "sc.report.protein"), s.avgProtein != null ? `${s.avgProtein} g` : "—"],
      [
        tr(lang, "sc.report.weightChange"),
        s.weightDeltaKg != null ? `${s.weightDeltaKg > 0 ? "+" : ""}${s.weightDeltaKg} kg` : "—",
      ],
    ];
    const cols = 4;
    const cw = (PAGE_W - MARGIN * 2) / cols;
    const rows = Math.ceil(cells.length / cols);
    ensure(rows * 40 + 8);
    for (const [i, [label, value]] of cells.entries()) {
      const cx = MARGIN + (i % cols) * cw;
      const cy = y + Math.floor(i / cols) * 40;
      const c = page.ctx;
      c.strokeStyle = "#e4e7dc";
      c.lineWidth = 0.8;
      c.strokeRect(cx + 0.5, cy - 12.5, cw - 6, 34);
      c.fillStyle = "#6c7162";
      c.font = "400 7.5px Helvetica, Arial, sans-serif";
      c.fillText(wrap(c, label.toUpperCase(), cw - 16)[0] ?? label, cx + 8, cy);
      c.fillStyle = "#12140f";
      c.font = "700 12px Helvetica, Arial, sans-serif";
      c.fillText(value, cx + 8, cy + 15);
    }
    y += rows * 40 + 10;
  }

  for (const section of report.sections) {
    heading(section.title);
    para(section.body);
    y += 4;
    for (const m of section.metrics) {
      ensure(15);
      const c = page.ctx;
      c.fillStyle = "#12140f";
      c.font = "700 9.5px Helvetica, Arial, sans-serif";
      const val = m.value;
      c.fillText(val, MARGIN, y);
      const vw = Math.max(c.measureText(val).width + 10, 70);
      c.fillStyle = "#3c4034";
      c.font = "400 9.5px Helvetica, Arial, sans-serif";
      const line = m.note ? `${m.label} — ${m.note}` : m.label;
      c.fillText(wrap(c, line, PAGE_W - MARGIN * 2 - vw)[0] ?? line, MARGIN + vw, y);
      y += 14;
    }
    y += 10;
  }

  if (s.topLifts.length) {
    heading(tr(lang, "sc.report.topLifts"));
    for (const lift of s.topLifts) {
      ensure(14);
      const c = page.ctx;
      c.fillStyle = "#3c4034";
      c.font = "400 9.5px Helvetica, Arial, sans-serif";
      c.fillText(lift.exercise, MARGIN, y);
      const v = `${lift.bestWeight} kg × ${lift.reps}`;
      c.font = "700 9.5px Helvetica, Arial, sans-serif";
      c.fillStyle = "#12140f";
      c.fillText(v, PAGE_W - MARGIN - c.measureText(v).width, y);
      c.strokeStyle = "#eef0e8";
      c.beginPath();
      c.moveTo(MARGIN, y + 4);
      c.lineTo(PAGE_W - MARGIN, y + 4);
      c.stroke();
      y += 14;
    }
    y += 10;
  }

  if (report.risks.length) {
    heading(txt.risks);
    for (const r of report.risks) {
      ensure(20);
      const c = page.ctx;
      const color =
        r.severity === "high" ? "#c0392b" : r.severity === "medium" ? "#c99a1e" : "#6c7162";
      c.fillStyle = color;
      c.fillRect(MARGIN, y - 8, 3, 12);
      c.fillStyle = "#12140f";
      c.font = "700 10px Helvetica, Arial, sans-serif";
      c.fillText(r.title, MARGIN + 10, y);
      y += 13;
      para(r.detail, 9.5, "#3c4034");
      y += 6;
    }
    y += 4;
  }

  if (report.recommendations.length) {
    heading(txt.recs);
    for (const [i, r] of report.recommendations.entries()) {
      ensure(20);
      const c = page.ctx;
      c.fillStyle = "#12140f";
      c.font = "700 10px Helvetica, Arial, sans-serif";
      c.fillText(`${i + 1}. ${r.title}`, MARGIN, y);
      y += 13;
      para(r.detail, 9.5);
      y += 6;
    }
    y += 4;
  }

  if (report.questionsForDoctor.length) {
    heading(txt.questions);
    for (const q of report.questionsForDoctor) para(`• ${q}`, 9.5);
    y += 12;
  }

  if (report.dataGaps.length) {
    heading(txt.gaps);
    for (const g of report.dataGaps) para(`• ${g}`, 9.5, "#6c7162");
  }

  finish();

  const doc = new jsPDF({ unit: "pt", format: "a4", compress: true });
  pages.forEach((canvas, i) => {
    if (i > 0) doc.addPage();
    doc.addImage(canvas.toDataURL("image/jpeg", 0.94), "JPEG", 0, 0, PAGE_W, PAGE_H);
  });
  doc.save(`gyms-life-report-${today}.pdf`);
}
