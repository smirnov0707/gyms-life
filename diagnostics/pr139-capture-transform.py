from pathlib import Path
import hashlib
import re

p = Path('scripts/test-today-browser.mjs')
raw = p.read_bytes()
assert hashlib.sha1(b'blob ' + str(len(raw)).encode() + b'\0' + raw).hexdigest() == '568125dd7fdfc129974873f487109cb147fd717e', 'Unexpected Today source version; refusing patch'
s = raw.decode()

def replace(old, new):
    global s
    assert s.count(old) == 1, (old[:100], s.count(old))
    s = s.replace(old, new)

replace('''      const captureScreenshot = async (options) => {
        try {
          await shown.page.screenshot({ ...options, timeout: 60_000 });
        } catch (error) {
          if (error?.name !== "TimeoutError") throw error;
          await shown.page.waitForTimeout(1_000);
          await shown.page.screenshot({ ...options, timeout: 60_000 });
        }
      };''', '''      const captureScreenshot = (options) => captureEvidence(shown.page, options);''')
replace('''    try {
      await first.page.screenshot({
        path: path.join(artifacts, "today-desktop.png"),
        fullPage: true,
        timeout: 60_000,
      });
    } catch (error) {
      if (error?.name !== "TimeoutError") throw error;
      await first.page.waitForTimeout(1_000);
      await first.page.screenshot({
        path: path.join(artifacts, "today-desktop.png"),
        fullPage: true,
        timeout: 60_000,
      });
    }''', '''    await captureEvidence(first.page, {
      path: path.join(artifacts, "today-desktop.png"),
      fullPage: true,
    });''')
s, count = re.subn(r'await ([A-Za-z_]\w*\.page)\.screenshot\(', r'await captureEvidence(\1, ', s)
assert count == 25, f'Unexpected number of capture sites: {count}'
helper = '''  // Evidence capture is not a functional retry. Every assertion still runs
  // once before reaching this helper. Only the capture of an already checked
  // page may retry, once, and a second timeout remains a release failure.
  const captureEvidence = async (page, options) => {
    const capture = { ...options, animations: "disabled", timeout: 60_000 };
    for (let attempt = 1; attempt <= 2; attempt++) {
      // A previously inspected context may no longer be the foreground tab.
      // Disable CSS motion only while photographing; no elements are hidden,
      // no viewport/fullPage settings change, and live interaction tests remain.
      await page.bringToFront();
      try {
        return await page.screenshot(capture);
      } catch (error) {
        if (error?.name !== "TimeoutError" || attempt === 2) throw error;
        console.warn(
          "BROWSER_EVIDENCE_RETRY " + JSON.stringify({ path: options.path, attempt }),
        );
      }
    }
  };

'''
replace('  const openPanel = async (query = "", options = {}) => {', helper + '  const openPanel = async (query = "", options = {}) => {')
assert s.count('.screenshot(') == 1, 'All Today evidence captures must use the common helper'
Path('test-results/capture-validation').mkdir(parents=True, exist_ok=True)
Path('test-results/capture-validation/before.mjs').write_bytes(raw)
p.write_text(s)
print('Patched capture sites:', count + 2)
