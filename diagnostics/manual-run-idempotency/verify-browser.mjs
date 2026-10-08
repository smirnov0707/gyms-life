import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { chromium, webkit, expect } from './node_modules/@playwright/test/index.mjs';
import { verifyEnduranceRunLog } from './scripts/test-core-endurance-log.mjs';

const out = path.resolve('test-results/manual-save');
await mkdir(out, { recursive: true });
const child = spawn(process.execPath, ['scripts/test-core-browser.mjs', '--serve-only'], {
  stdio: ['ignore', 'pipe', 'pipe'], env: { ...process.env, CORE_BROWSER_PORT: '4184' },
});
let serverLog = '';
child.stdout.on('data', b => { serverLog += b.toString(); });
child.stderr.on('data', b => { serverLog += b.toString(); });
const outcomes = [];
try {
  await new Promise((resolve, reject) => {
    const timer = setTimeout(() => { cleanup(); reject(new Error('Fixture start timed out')); }, 45000);
    const onData = () => { if (serverLog.includes('Core synthetic fixture:')) { cleanup(); resolve(); } };
    const onExit = code => { cleanup(); reject(new Error(`Fixture exited: ${code}`)); };
    const cleanup = () => { clearTimeout(timer); child.stdout.off('data', onData); child.off('exit', onExit); };
    child.stdout.on('data', onData); child.once('exit', onExit); child.once('error', reject); onData();
  });
  for (const [engine, type] of [['chromium', chromium], ['webkit', webkit]]) {
    const artifacts = path.join(out, engine);
    await mkdir(artifacts, { recursive: true });
    const results = [], errors = [];
    let browser, failure = null;
    try {
      browser = await type.launch();
      const open = async (query, viewport = { width: 390, height: 844 }) => {
        const context = await browser.newContext({ viewport, locale: 'en-GB', timezoneId: 'Europe/Vilnius' });
        const page = await context.newPage();
        page.on('pageerror', error => errors.push(String(error)));
        await page.goto(`http://127.0.0.1:4184/index.html?${query}`);
        await expect(page.getByTestId('synthetic-watermark')).toBeVisible({ timeout: 30000 });
        return { page, context };
      };
      await verifyEnduranceRunLog({ open, artifacts, record: name => {
        results.push({ name, status: 'passed' }); console.log(`PASS ${engine}: ${name}`);
      } });
      assert.equal(results.length, 14, 'All existing and new run-log groups must execute');
      assert.deepEqual(errors, [], 'Uncaught page errors are failures');
    } catch (error) {
      failure = error instanceof Error ? error.stack : String(error);
      console.error(`${engine}: ${failure}`);
      if (browser) {
        let n = 0;
        for (const context of browser.contexts()) for (const page of context.pages()) {
          await writeFile(path.join(artifacts, `failure-${n}.txt`), await page.locator('body').innerText({ timeout: 5000 }).catch(() => 'Body unavailable'));
          await page.screenshot({ path: path.join(artifacts, `failure-${n++}.png`), fullPage: true, timeout: 10000 }).catch(() => {});
        }
      }
    } finally {
      await browser?.close();
      const row = { engine, status: failure ? 'failed' : 'passed', scope: 'Real QuickRunLog with synthetic service responses, not live account or database acceptance', results, errors, failure };
      outcomes.push(row);
      await writeFile(path.join(artifacts, 'results.json'), JSON.stringify(row, null, 2));
    }
  }
  assert.equal(outcomes.length, 2);
  assert.ok(outcomes.every(row => row.status === 'passed'), 'Both browser engines must pass');
} finally {
  child.kill('SIGTERM');
  await writeFile(path.join(out, 'fixture.log'), serverLog);
  await writeFile(path.join(out, 'browser-summary.json'), JSON.stringify(outcomes, null, 2));
}
