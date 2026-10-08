import { spawn } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
import { setTimeout as delay } from 'node:timers/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import { chromium, webkit, expect } from '@playwright/test';
import { verifyRunSubmissionRecovery } from './test-core-run-submission.mjs';
import { verifyEnduranceRunLog } from './test-core-endurance-log.mjs';

const out = path.resolve('test-results/manual-save');
await mkdir(out, { recursive: true });
const server = spawn(process.execPath, ['scripts/test-core-browser.mjs', '--serve-only'], {
 stdio: ['ignore', 'pipe', 'pipe'], env: process.env,
});
let serverLog = '';
for (const stream of [server.stdout, server.stderr]) stream.on('data', value => { serverLog += value; });
const report = { scope: 'Real QuickRunLog, native IndexedDB and controlled synthetic services; not live SQL/RLS or account acceptance', engines: [] };
let browser;
try {
 let ready = false;
 for (let attempt = 0; attempt < 100; attempt++) {
  if (server.exitCode !== null) throw new Error(`Fixture exited: ${serverLog}`);
  try { const r = await fetch('http://127.0.0.1:4184/index.html'); if (r.ok) { ready = true; break; } } catch {}
  await delay(300);
 }
 assert.ok(ready, 'Fixture did not start');
 for (const [name, engine] of [['chromium', chromium], ['webkit', webkit]]) {
  const artifacts = path.join(out, name);
  await mkdir(artifacts, { recursive: true });
  const result = { engine: name, checks: [], errors: [], status: 'running' };
  report.engines.push(result);
  browser = await engine.launch();
  const open = async (query, viewport = { width: 1280, height: 900 }) => {
   const context = await browser.newContext({ viewport, locale: 'en-GB', timezoneId: 'Europe/Vilnius' });
   const page = await context.newPage();
   page.on('pageerror', error => result.errors.push(String(error)));
   await page.goto(`http://127.0.0.1:4184/index.html?${query}`);
   await expect(page.getByTestId('synthetic-watermark')).toBeVisible({ timeout: 30000 });
   return { page, context };
  };
  const record = message => { result.checks.push(message); console.log(`PASS ${name}: ${message}`); };
  await verifyRunSubmissionRecovery({ open, record, artifacts });
  await verifyEnduranceRunLog({ open, record, artifacts });
  assert.equal(result.checks.length, 17);
  assert.deepEqual(result.errors, []);
  result.status = 'passed';
  await browser.close();
  browser = null;
 }
} catch (error) {
 report.error = error instanceof Error ? error.stack : String(error);
 if (browser) {
  let i = 0;
  for (const context of browser.contexts()) for (const page of context.pages()) {
   await writeFile(path.join(out, `failure-${i++}.txt`), await page.locator('body').innerText().catch(() => 'page unavailable'));
  }
 }
 throw error;
} finally {
 await browser?.close();
 server.kill('SIGTERM');
 await writeFile(path.join(out, 'focused.json'), JSON.stringify(report, null, 2));
 await writeFile(path.join(out, 'fixture.log'), serverLog);
}
