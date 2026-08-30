import type { GeneratedMealPlan } from "./meal-types";
import { tr, type Lang } from "./i18n";

/**
 * Renders the weekly shopping list to a downloadable PDF.
 * Pages are drawn on a canvas first so Lithuanian diacritics always render
 * correctly (the PDF core fonts are WinAnsi-only).
 */

const SCALE = 2.5; // canvas px per PDF pt
const PAGE_W = 595; // A4 pt
const PAGE_H = 842;
const MARGIN = 44;

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
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let line = "";
  for (const word of words) {
    const candidate = line ? `${line} ${word}` : word;
    if (ctx.measureText(candidate).width > maxWidth && line) {
      lines.push(line);
      line = word;
    } else {
      line = candidate;
    }
  }
  if (line) lines.push(line);
  return lines;
}

export async function downloadShoppingListPdf(plan: GeneratedMealPlan, lang: Lang) {
  const { jsPDF } = await import("jspdf");
  const txt = {
    title: tr(lang, "rm.shopping.title"),
    week: tr(lang, "rm.shopping.week"),
    targets: tr(lang, "rm.shopping.targets"),
    generated: tr(lang, "rm.shopping.generated"),
    page: tr(lang, "rm.shopping.page"),
    items: tr(lang, "rm.shopping.items"),
    footer: tr(lang, "rm.shopping.footer"),
  };
  const today = new Date().toISOString().slice(0, 10);

  const pages: HTMLCanvasElement[] = [];
  let page = newPage();
  let y = 0;

  const totalItems = plan.shopping_list.reduce((n, g) => n + g.items.length, 0);

  const header = (first: boolean) => {
    const { ctx } = page;
    ctx.fillStyle = "#12140f";
    ctx.fillRect(0, 0, PAGE_W, first ? 104 : 58);
    ctx.fillStyle = "#c6f24e";
    ctx.fillRect(0, first ? 104 : 58, PAGE_W, 4);
    ctx.fillStyle = "#c6f24e";
    ctx.font = `700 ${first ? 30 : 18}px "Bebas Neue", Impact, sans-serif`;
    ctx.fillText(txt.title, MARGIN, first ? 56 : 38);
    ctx.fillStyle = "#ffffff";
    ctx.font = "400 10px Helvetica, Arial, sans-serif";
    if (first) {
      ctx.fillText(`${plan.title} · ${txt.week}`, MARGIN, 76);
      ctx.fillText(
        `${txt.generated}: ${today}   ·   ${totalItems} ${txt.items}`,
        MARGIN,
        92,
      );
    } else {
      ctx.fillText("GYMS.LIFE", PAGE_W - MARGIN - ctx.measureText("GYMS.LIFE").width, 38);
    }
    y = first ? 140 : 92;
  };

  const finish = () => {
    const { ctx } = page;
    ctx.fillStyle = "#9aa08c";
    ctx.font = "400 8px Helvetica, Arial, sans-serif";
    ctx.fillText(txt.footer, MARGIN, PAGE_H - 24);
    const label = `${txt.page} ${pages.length + 1}`;
    ctx.fillText(label, PAGE_W - MARGIN - ctx.measureText(label).width, PAGE_H - 24);
    pages.push(page.canvas);
  };

  const ensure = (needed: number) => {
    if (y + needed <= PAGE_H - 52) return;
    finish();
    page = newPage();
    header(false);
  };

  header(true);

  // macro target strip
  {
    const { ctx } = page;
    ctx.fillStyle = "#f3f5ee";
    ctx.fillRect(MARGIN, y - 22, PAGE_W - MARGIN * 2, 44);
    ctx.fillStyle = "#12140f";
    ctx.font = "700 9px Helvetica, Arial, sans-serif";
    ctx.fillText(txt.targets.toUpperCase(), MARGIN + 12, y - 6);
    ctx.font = "400 11px Helvetica, Arial, sans-serif";
    ctx.fillText(
      `${Math.round(plan.kcal_target)} kcal · ${Math.round(plan.protein_target)} g P · ${Math.round(
        plan.carbs_target,
      )} g C · ${Math.round(plan.fat_target)} g F`,
      MARGIN + 12,
      y + 12,
    );
    y += 46;
  }

  const colW = (PAGE_W - MARGIN * 2 - 24) / 2;
  let col = 0;
  let colTop = y;
  let colY = [y, y];

  const columnX = () => MARGIN + col * (colW + 24);

  for (const group of plan.shopping_list) {
    const { ctx } = page;
    ctx.font = "400 10px Helvetica, Arial, sans-serif";
    const blockHeight = 26 + group.items.length * 16 + 10;

    // choose column with more space; break page when both are full
    col = colY[0]! <= colY[1]! ? 0 : 1;
    if (colY[col]! + blockHeight > PAGE_H - 52) {
      col = col === 0 ? 1 : 0;
      if (colY[col]! + blockHeight > PAGE_H - 52) {
        y = Math.max(colY[0]!, colY[1]!);
        ensure(PAGE_H); // force a new page
        colTop = y;
        colY = [colTop, colTop];
        col = 0;
      }
    }

    const c = page.ctx;
    const x = columnX();
    let cy = colY[col]!;

    c.fillStyle = "#c6f24e";
    c.fillRect(x, cy - 10, 20, 3);
    c.fillStyle = "#12140f";
    c.font = '700 13px "Bebas Neue", Helvetica, Arial, sans-serif';
    c.fillText(group.category.toUpperCase(), x, cy + 8);
    cy += 24;

    for (const item of group.items) {
      c.strokeStyle = "#5c6152";
      c.lineWidth = 0.7;
      c.strokeRect(x + 0.5, cy - 7.5, 8, 8);

      c.fillStyle = "#12140f";
      c.font = "400 10px Helvetica, Arial, sans-serif";
      const amount = item.amount ?? "";
      c.font = "700 10px Helvetica, Arial, sans-serif";
      const amountW = c.measureText(amount).width;
      c.fillText(amount, x + colW - amountW, cy);
      c.font = "400 10px Helvetica, Arial, sans-serif";
      const name = wrap(c, item.name, colW - 16 - amountW - 8)[0] ?? item.name;
      c.fillText(name, x + 14, cy);

      c.strokeStyle = "#e4e7dc";
      c.beginPath();
      c.moveTo(x, cy + 5);
      c.lineTo(x + colW, cy + 5);
      c.stroke();
      cy += 16;
    }

    colY[col] = cy + 12;
  }

  y = Math.max(colY[0]!, colY[1]!);

  if (plan.prep_tips?.length) {
    ensure(40 + plan.prep_tips.length * 14);
    const c = page.ctx;
    c.fillStyle = "#12140f";
    c.font = '700 13px "Bebas Neue", Helvetica, Arial, sans-serif';
    c.fillText((lang === "lt" ? "Paruošimo patarimai" : "Prep tips").toUpperCase(), MARGIN, y);
    y += 16;
    c.font = "400 10px Helvetica, Arial, sans-serif";
    c.fillStyle = "#3c4034";
    for (const tip of plan.prep_tips) {
      for (const line of wrap(c, `• ${tip}`, PAGE_W - MARGIN * 2)) {
        ensure(14);
        page.ctx.font = "400 10px Helvetica, Arial, sans-serif";
        page.ctx.fillStyle = "#3c4034";
        page.ctx.fillText(line, MARGIN, y);
        y += 13;
      }
    }
  }

  finish();

  const doc = new jsPDF({ unit: "pt", format: "a4", compress: true });
  pages.forEach((canvas, i) => {
    if (i > 0) doc.addPage();
    doc.addImage(canvas.toDataURL("image/jpeg", 0.94), "JPEG", 0, 0, PAGE_W, PAGE_H);
  });
  doc.save(`gyms-life-${tr(lang, "rm.shopping.filename")}-${today}.pdf`);
}
