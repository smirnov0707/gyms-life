from pathlib import Path
import hashlib

p = Path('scripts/test-today-browser.mjs')
raw = p.read_bytes()
assert hashlib.sha1(b'blob ' + str(len(raw)).encode() + b'\0' + raw).hexdigest() == '843ae9194abe9bce1e508988b10a12d80c2e8eb9', 'Unexpected source version'
s = raw.decode()

def replace(old, new):
    global s
    assert s.count(old) == 1, (old[:100], s.count(old))
    s = s.replace(old, new)

start = s.index('  const openVisibleDetails = async (summary) => {')
end = s.index('  const openTodayExecutionLayer = async (page) => {', start)
s = s[:start] + '''  const openDetails = async (details) => {
    // Keep the stable disclosure locator, rather than resolving a parent from a
    // :scope summary on a rerendering page. Activate the actual foreground tab.
    await details.page().bringToFront();
    await expect(details).toHaveCount(1, { timeout: 30_000 });
    await expect(details).toHaveJSProperty("tagName", "DETAILS");
    const summary = details.locator(":scope > summary");
    await expect(summary).toHaveCount(1, { timeout: 30_000 });
    await expect(summary).toBeVisible({ timeout: 30_000 });
    if ((await details.getAttribute("open")) === null) {
      await summary.focus({ timeout: 30_000 });
      await expect(summary).toBeFocused({ timeout: 30_000 });
      await expect(summary).toBeInViewport({ timeout: 30_000 });
      await summary.press("Enter", { timeout: 30_000 });
    }
    await expect(details).toHaveJSProperty("open", true, { timeout: 30_000 });
  };

  const openTodayChangesLayer = async (page) => {
    const context = page.locator(".fl-today-world > details.fl-today-context");
    await openDetails(context);
    // "What changed" is a paragraph, not a disclosure. Never click it.
    await expect(context.locator(".fl-today-changes")).toBeVisible({ timeout: 30_000 });
    return context;
  };

  const openTodayEvidenceLayer = async (page) => {
    const context = await openTodayChangesLayer(page);
    await openDetails(context.locator(":scope > div > details"));
    await expect(context.locator(".fl-data-sources")).toBeVisible({ timeout: 30_000 });
  };

  const openTwinMemory = async (page) => {
    const journal = page.locator(".twin-journal-view");
    await expect(journal).toBeVisible({ timeout: 30_000 });
    const memory = journal.locator(":scope > details").filter({
      has: page.locator(":scope > summary").filter({ hasText: /^Memory & patterns$/ }),
    });
    await openDetails(memory);
  };

  const openTwinSystemsEvidence = async (page) => {
    const systems = page.locator(".fl-twin-systems");
    await expect(systems).toBeVisible({ timeout: 30_000 });
    await openDetails(systems.locator(":scope > details"));
  };

''' + s[end:]
replace('''    // 3. Recovery projections live in Twin Systems; prediction calibration lives in Lab.''', '''    expect(systems.errors).toEqual([]);
    await systems.page.context().close();

    // 3. Recovery projections live in Twin Systems; prediction calibration lives in Lab.''')
replace('''    expect(calibrationText).not.toMatch(/confidence\\s*[:·-]?\\s*\\d+\\s*%/i);''', '''    expect(calibrationText).not.toMatch(/confidence\\s*[:·-]?\\s*\\d+\\s*%/i);
    expect(evidenceLab.errors).toEqual([]);
    await evidenceLab.page.context().close();''')
replace('''    await expect(failedRail.getByText("Not recorded yet")).toHaveCount(0);''', '''    await expect(failedRail.getByText("Not recorded yet")).toHaveCount(0);
    expect(failedSystems.errors).toEqual([]);
    await failedSystems.page.context().close();''')
replace('''    const planned = await open("?plan=ready");''', '''    const planned = await openPanel("?plan=ready");''')
replace('''    await expect(plan.getByText("Bench press", { exact: true })).toBeVisible();
    await expect(plan.getByText("4 × 6", { exact: true })).toBeVisible();''', '''    const benchRow = plan.getByRole("listitem").filter({
      has: planned.page.getByText("Bench press", { exact: true }),
    });
    await expect(benchRow).toHaveCount(1);
    await expect(benchRow.getByText("Bench press", { exact: true })).toBeVisible();
    await expect(benchRow.getByText("4 × 6", { exact: true })).toBeVisible();''')
replace('''    record("today's session is listed from the programme, with no load it does not have");''', '''    await planned.page.context().close();
    record("today's session is listed from the programme, with no load it does not have");''')
replace('''    expect(health.errors).toEqual([]);''', '''    expect(health.errors).toEqual([]);
    await health.page.context().close();''')
replace('''    await expect(
      lab.page.locator(".fl-lab-roster-tiles").getByText("Unknown", { exact: true }),
    ).toHaveCount(10);''', '''    const failedDomains = lab.page.locator(".fl-lab-domains");
    const failedRoster = failedDomains.locator(".fl-lab-roster-tiles");
    await expect(failedRoster).toBeHidden();
    await openDetails(failedDomains);
    await expect(failedRoster).toBeVisible();
    await expect(failedRoster.getByText("Unknown", { exact: true })).toHaveCount(10);
    const failedExperiments = lab.page.locator(".fl-lab-experiments");
    await expect(
      failedExperiments.getByText("Experiment history is unavailable.", { exact: true }),
    ).toBeHidden();
    await openDetails(failedExperiments);''')
replace('''    expect(first.errors).toEqual([]);
    expect(failed.errors).toEqual([]);
    expect(failedSystems.errors).toEqual([]);
    await failedSystems.page.context().close();''', '''    expect(first.errors).toEqual([]);
    expect(failed.errors).toEqual([]);''')
replace('''    await ltSystems.page.context().close();
    await systems.page.context().close();
    await evidenceLab.page.context().close();''', '''    expect(ltSystems.errors).toEqual([]);
    await ltSystems.page.context().close();''')
replace('''    expect(lt.errors).toEqual([]);''', '''    expect(lt.errors).toEqual([]);
    await lt.page.context().close();''')
replace('''    record("the sources row reports what arrived, and tells silence from an outage");''', '''    expect(first.errors).toEqual([]);
    expect(failed.errors).toEqual([]);
    await first.page.context().close();
    await failed.page.context().close();
    record("the sources row reports what arrived, and tells silence from an outage");''')
replace('''    await expect(twin.page.getByRole("region", { name: "Body composition" })).toBeVisible({
      timeout: 30000,
    });''', '''    const initialComposition = twin.page.getByRole("region", { name: "Body composition" });
    await expect(initialComposition).toBeHidden();
    await openDetails(
      twin.page.locator(".fl-twin-body > details").filter({
        has: twin.page.locator(":scope > summary").filter({ hasText: /^Muscles$/ }),
      }),
    );
    await expect(initialComposition).toBeVisible({ timeout: 30000 });''')
for variable, prefix in [('twin', 'memorySummary'), ('baselineMemory', 'baselineSummary'), ('changedMemory', 'changedSummary'), ('uncertaintyTwin', 'uncertaintySummary')]:
    old = f'''    const {prefix} = {variable}.page
      .locator("details > summary")
      .filter({{ hasText: "Changes, memory & milestones" }});
    await expect({prefix}).toBeVisible({{ timeout: 30000 }});
    await {prefix}.click();'''
    replace(old, f'''    await openTwinMemory({variable}.page);''')
for variable in ['noNight', 'staged', 'onlyDeep', 'durationOnly', 'noSamples', 'ahead', 'noTwin']:
    pos = s.index(f'    const {variable} = await openPanel(')
    end = s.index(';\n', pos) + 2
    s = s[:end] + f'    await openTwinSystemsEvidence({variable}.page);\n' + s[end:]
replace('''      const unknown = await openPanel(query);
      const outlook = unknown.page.getByRole("region", { name: "When it comes back" });''', '''      const unknown = await openPanel(query);
      if (query.includes("screen=twin")) await openTwinSystemsEvidence(unknown.page);
      const outlook = unknown.page.getByRole("region", { name: "When it comes back" });''')
s = s.replace('.page.close()', '.page.context().close()')
replace('''  await writeFile(path.join(artifacts, "results.json"), JSON.stringify(results, null, 2));
} finally {''', '''  await writeFile(path.join(artifacts, "results.json"), JSON.stringify(results, null, 2));
} catch (error) {
  await writeFile(path.join(artifacts, "results.json"), JSON.stringify(results, null, 2));
  await writeFile(
    path.join(artifacts, "failure.json"),
    JSON.stringify(
      {
        status: "failed",
        error: error instanceof Error ? error.stack : String(error),
        openPages: browser?.contexts().flatMap((context) => context.pages().map((page) => page.url())),
        passedChecks: results.length,
      },
      null,
      2,
    ),
  );
  throw error;
} finally {''')
p.write_text(s)
print('Applied explicit, source-version-checked changes to', p)
