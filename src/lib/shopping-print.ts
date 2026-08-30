import type { GeneratedMealPlan } from "./meal-types";
import { tr, type Lang } from "./i18n";

const esc = (s: string) =>
  s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);

/** Opens a clean, printer-friendly shopping list in a new window and triggers print. */
export function printShoppingList(plan: GeneratedMealPlan, lang: Lang) {
  const t = {
    title: tr(lang, "rm.shopping.title"),
    targets: tr(lang, "rm.shopping.targets"),
    generated: tr(lang, "rm.shopping.generated"),
    items: tr(lang, "rm.shopping.items"),
    tips: tr(lang, "rm.shopping.tips"),
  };
  const today = new Date().toISOString().slice(0, 10);
  const totalItems = plan.shopping_list.reduce((n, g) => n + g.items.length, 0);

  const groups = plan.shopping_list
    .map(
      (g) => `<section class="group">
        <h2>${esc(g.category)}</h2>
        <ul>${g.items
          .map(
            (i) =>
              `<li><span class="box"></span><span class="name">${esc(i.name)}</span><span class="amt">${esc(
                i.amount ?? "",
              )}</span></li>`,
          )
          .join("")}</ul>
      </section>`,
    )
    .join("");

  const tips = plan.prep_tips?.length
    ? `<section class="tips"><h2>${t.tips}</h2><ul>${plan.prep_tips
        .map((x) => `<li>${esc(x)}</li>`)
        .join("")}</ul></section>`
    : "";

  const html = `<!doctype html><html lang="${lang}"><head><meta charset="utf-8">
<title>${t.title} — GYMS.LIFE</title>
<style>
  * { box-sizing: border-box; }
  body { font-family: Helvetica, Arial, sans-serif; color: #12140f; margin: 24px; }
  header { border-bottom: 3px solid #c6f24e; padding-bottom: 10px; margin-bottom: 16px; }
  h1 { font-size: 26px; letter-spacing: 2px; margin: 0 0 4px; }
  .meta { font-size: 11px; color: #5c6152; }
  .macros { background: #f3f5ee; padding: 8px 12px; font-size: 12px; margin-bottom: 18px; }
  .cols { column-count: 2; column-gap: 28px; }
  .group { break-inside: avoid; margin-bottom: 16px; }
  h2 { font-size: 13px; text-transform: uppercase; letter-spacing: 1px; margin: 0 0 6px; border-left: 4px solid #c6f24e; padding-left: 6px; }
  ul { list-style: none; padding: 0; margin: 0; }
  li { display: flex; align-items: center; gap: 8px; font-size: 12px; padding: 3px 0; border-bottom: 1px solid #e4e7dc; }
  .box { width: 9px; height: 9px; border: 1px solid #5c6152; flex: none; }
  .name { flex: 1; }
  .amt { font-weight: 700; }
  .tips { margin-top: 18px; break-inside: avoid; }
  .tips li { display: list-item; border: none; margin-left: 16px; }
  .tips ul { list-style: disc; }
  @page { margin: 14mm; }
</style></head>
<body>
  <header>
    <h1>${t.title}</h1>
    <div class="meta">${esc(plan.title)} · ${t.generated}: ${today} · ${totalItems} ${t.items}</div>
  </header>
  <div class="macros">${t.targets}: ${Math.round(plan.kcal_target)} kcal · ${Math.round(
    plan.protein_target,
  )} g P · ${Math.round(plan.carbs_target)} g C · ${Math.round(plan.fat_target)} g F</div>
  <div class="cols">${groups}</div>
  ${tips}
</body></html>`;

  const win = window.open("", "_blank", "width=900,height=1000");
  if (!win) throw new Error("popup-blocked");
  win.document.write(html);
  win.document.close();
  win.focus();
  setTimeout(() => {
    win.print();
  }, 300);
}
