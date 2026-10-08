import { spawn } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
import { createWriteStream } from 'node:fs';
import path from 'node:path';
import { chromium, webkit, expect } from '@playwright/test';
import { verifyEnduranceRunLog } from './test-core-endurance-log.mjs';

const root = process.cwd();
const out = path.join(root, 'test-results/endurance-reliability');
await mkdir(out, { recursive: true });
const origin = 'http://127.0.0.1:4184';
const serverLog = createWriteStream(path.join(out, 'fixture.log'));
const server = spawn(process.execPath, ['scripts/test-core-browser.mjs', '--serve-only'], {
  env: { ...process.env, CORE_BROWSER_PORT: '4184' }, stdio: ['ignore', 'pipe', 'pipe'],
});
server.stdout.pipe(serverLog, { end: false });
server.stderr.pipe(serverLog, { end: false });
let browser;
const report = { scope: 'Real QuickRunLog against labeled synthetic services; no live user or SQL writes', engines: [] };
try {
  const deadline = Date.now() + 60000;
  let ready = false;
  while (Date.now() < deadline) {
    if (server.exitCode !== null) throw new Error('Fixture server exited');
    try {
      const response = await fetch(origin + '/index.html', { signal: AbortSignal.timeout(1000) });
      if (response.ok) { await response.arrayBuffer(); ready = true; break; }
    } catch { /* Poll server readiness only, never retry a functional scenario. */ }
    await new Promise(resolve => setTimeout(resolve, 200));
  }
  if (!ready) throw new Error('Fixture failed to start within 60 seconds');
  for (const [engine, type] of [['chromium', chromium], ['webkit', webkit]]) {
    browser = await type.launch();
    const artifacts = path.join(out, engine);
    await mkdir(artifacts, { recursive: true });
    const errors = [];
    const result = { engine, status: 'running', checks: [], errors };
    report.engines.push(result);
    const open = async (query, viewport = { width: 390, height: 844 }) => {
      const context = await browser.newContext({ viewport, locale: 'en-GB', timezoneId: 'Europe/Vilnius' });
      const page = await context.newPage();
      page.on('pageerror', error => errors.push(String(error)));
      await page.goto(`${origin}/index.html?${query}`);
      await expect(page.getByTestId('synthetic-watermark')).toBeVisible({ timeout: 30000 });
      return { page, context };
    };
    await verifyEnduranceRunLog({ open, artifacts, record: name => {
      result.checks.push({ name, status: 'passed' });
      console.log(`PASS ${engine}: ${name}`);
    } });
    expect(result.checks).toHaveLength(8);
    expect(errors).toEqual([]);
    expect(browser.contexts()).toHaveLength(0);
    result.status = 'passed';
    await browser.close();
    browser = undefined;
    await writeFile(path.join(out, 'focused.json'), JSON.stringify(report, null, 2));
  }
  console.log('PASS 8 real-component regression groups in each pinned browser');
} catch (error) {
  report.error = String(error.stack ?? error);
  if (browser) {
    report.pages = [];
    for (const context of browser.contexts()) for (const page of context.pages()) {
      try { report.pages.push({ url: page.url(), text: (await page.locator('body').innerText()).slice(0,14000), state: await page.evaluate(() => window.__enduranceLog ?? null) }); } catch { /* Preserve original failure. */ }
    }
  }
  await writeFile(path.join(out, 'focused.json'), JSON.stringify(report, null, 2));
  throw error;
} finally {
  await browser?.close();
  server.kill('SIGTERM');
  serverLog.end();
}
