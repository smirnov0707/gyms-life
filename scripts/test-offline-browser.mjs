import { createServer } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { chromium, webkit, expect } from "@playwright/test";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
const root = process.cwd(),
  fixture = (name) => path.join(root, "tests/offline-browser", name),
  output = path.join(root, "test-results/offline-browser");
const A = "11111111-1111-4111-8111-111111111111",
  B = "22222222-2222-4222-8222-222222222222",
  SA = "33333333-3333-4333-8333-333333333333",
  SB = "66666666-6666-4666-8666-666666666666";
const cases = new Map();
let sequence = 0;
const getCase = (id) => {
  if (!cases.has(id))
    cases.set(id, { sets: new Map(), calls: [], delay: 0, fail: false, ackMode: "normal" });
  return cases.get(id);
};
const server = await createServer({
  configFile: false,
  root: fixture(""),
  publicDir: path.join(root, "public"),
  plugins: [
    {
      name: "synthetic-offline-server",
      configureServer(vite) {
        vite.middlewares.use(async (req, res, next) => {
          const url = new URL(req.url ?? "/", "http://127.0.0.1");
          if (!url.pathname.startsWith("/__offline_fixture/")) return next();
          try {
            let body = "";
            for await (const chunk of req) {
              body += chunk;
              if (body.length > 100_000) throw new Error("Fixture body too large");
            }
            const data = JSON.parse(body || "{}"),
              test = getCase(url.searchParams.get("case")),
              action = url.pathname.split("/").at(-1),
              owner = req.headers["x-synthetic-owner"];
            let result;
            if (action === "control") {
              for (const key of ["delay", "fail", "ackMode"])
                if (data[key] !== undefined) test[key] = data[key];
              result = { ok: true };
            } else if (action === "stats")
              result = { sets: [...test.sets.values()], calls: test.calls };
            else {
              if (![A, B].includes(owner) || data.ownerId !== owner) {
                res.statusCode = 403;
                result = { error: "synthetic owner mismatch" };
              } else if (action === "verify") {
                if (test.fail) {
                  res.statusCode = 503;
                  result = { error: "synthetic outage" };
                } else
                  result = {
                    ownerId: owner,
                    sessionIds: data.sessionIds.filter((id) => id === (owner === A ? SA : SB)),
                  };
              } else if (action === "sync") {
                test.calls.push({ owner, clientId: data.clientId });
                if (test.delay) await new Promise((r) => setTimeout(r, test.delay));
                if (test.fail) {
                  res.statusCode = 503;
                  result = { error: "synthetic outage" };
                } else if (data.data.sessionId !== (owner === A ? SA : SB)) {
                  result = {
                    status: "retained",
                    ownerId: owner,
                    clientId: data.clientId,
                    reason: "session_unavailable",
                  };
                } else {
                  const slot = [
                    owner,
                    data.data.sessionId,
                    data.data.exerciseSlug,
                    data.data.setNumber,
                  ].join("|");
                  const previous = test.sets.get(slot);
                  const saved = previous ?? {
                    owner,
                    serverSetId: crypto.randomUUID(),
                    data: data.data,
                  };
                  if (!previous) test.sets.set(slot, saved);
                  const same = [
                    "sessionId",
                    "exerciseSlug",
                    "setNumber",
                    "reps",
                    "weightKg",
                    "rpe",
                    "done",
                    "performedAt",
                  ].every((key) => saved.data[key] === data.data[key]);
                  result = same
                    ? {
                        status: "acknowledged",
                        ownerId: owner,
                        clientId: data.clientId,
                        serverSetId: saved.serverSetId,
                        data: saved.data,
                      }
                    : {
                        status: "retained",
                        ownerId: owner,
                        clientId: data.clientId,
                        reason: "conflict",
                      };
                  if (test.ackMode === "empty") result = { ok: true };
                  if (test.ackMode === "wrong-owner")
                    result = { ...result, ownerId: owner === A ? B : A };
                }
              } else throw new Error("Unexpected synthetic operation");
            }
            res.setHeader("content-type", "application/json");
            res.end(JSON.stringify(result));
          } catch {
            res.statusCode = 500;
            res.end('{"error":"synthetic server error"}');
          }
        });
      },
    },
    react(),
    tailwindcss(),
  ],
  resolve: {
    alias: [
      { find: "@/integrations/supabase/client", replacement: fixture("client.ts") },
      { find: "@/lib/offline-sync.functions", replacement: fixture("functions.ts") },
      {
        find: /^@tanstack\/react-start(?:\/.*)?$/,
        replacement: path.join(root, "tests/today-browser/start-stub.ts"),
      },
      { find: "@", replacement: path.join(root, "src") },
    ],
    dedupe: ["react", "react-dom"],
  },
  optimizeDeps: {
    noDiscovery: true,
    include: [
      "react",
      "react-dom/client",
      "react/jsx-runtime",
      "@tanstack/react-query",
      "zod",
      "sonner",
      "lucide-react",
    ],
  },
  server: { host: "127.0.0.1", port: 0, strictPort: true, fs: { allow: [root] } },
});
await mkdir(output, { recursive: true });
let browser;
const results = [],
  errors = [];
const record = (name) => {
  results.push({ name, status: "passed" });
  console.log("PASS", name);
};
try {
  await server.listen();
  const origin = `http://127.0.0.1:${server.httpServer.address().port}`;
  const engine = process.env.CORE_BROWSER_ENGINE ?? "chromium";
  if (!["chromium", "webkit"].includes(engine)) throw new Error("Unknown browser");
  browser = await (engine === "webkit" ? webkit : chromium).launch(
    engine === "chromium" && process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH
      ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH }
      : {},
  );
  const open = async ({ pages = 1, width = 1100, lang = "en" } = {}) => {
    const context = await browser.newContext({
        viewport: { width, height: 850 },
        timezoneId: "Europe/Vilnius",
      }),
      id = String(++sequence),
      views = [];
    await context.route("**/*", (route) => {
      const url = new URL(route.request().url());
      if (url.origin === origin || ["data:", "blob:"].includes(url.protocol))
        return route.continue();
      errors.push("unexpected external host: " + url.hostname);
      return route.abort();
    });
    for (let index = 0; index < pages; index++) {
      const page = await context.newPage();
      page.on("pageerror", (error) => errors.push(String(error)));
      await page.goto(`${origin}/index.html?case=${id}&lang=${lang}`);
      await expect(page.getByTestId("identity")).toHaveText(A);
      views.push(page);
    }
    return { context, page: views[0], pages: views };
  };

  {
    const { page, context } = await open();
    await page.evaluate(() => window.__offline.add(1));
    await page.reload();
    await expect(page.getByTestId("identity")).toHaveText(A);
    expect((await page.evaluate(() => window.__offline.list())).items).toHaveLength(1);
    await page.evaluate(() => window.__offline.switchOwner(null));
    await expect(page.getByTestId("identity")).toHaveText("signed-out");
    expect(await page.evaluate(() => window.__offline.rawRows())).toHaveLength(1);
    await page.evaluate((B) => window.__offline.switchOwner(B), B);
    await expect(page.getByTestId("identity")).toHaveText(B);
    expect((await page.evaluate(() => window.__offline.list())).items).toHaveLength(0);
    await page.evaluate(() => window.__offline.add(2));
    await page.evaluate((A) => window.__offline.switchOwner(A), A);
    await expect(page.getByTestId("identity")).toHaveText(A);
    const queue = await page.evaluate(() => window.__offline.list());
    expect(queue.items).toHaveLength(1);
    expect(queue.items[0].data.setNumber).toBe(1);
    expect(await page.evaluate(() => window.__offline.rawRows())).toHaveLength(2);
    await context.close();
    record(
      "A → sign out → B → A and reload retain distinct owner queues without moving or deleting either account's set",
    );
  }
  {
    const { page, context } = await open();
    await context.setOffline(true);
    await page.evaluate(() => window.__offline.add(1));
    expect((await page.evaluate(() => window.__offline.list())).items).toHaveLength(1);
    const response = await page.evaluate(() => window.__offline.flush());
    expect(response.synced).toBe(0);
    expect(response.remaining).toBe(1);
    await context.setOffline(false);
    expect((await page.evaluate(() => window.__offline.stats())).calls).toHaveLength(0);
    await page.reload();
    await expect(page.getByTestId("identity")).toHaveText(A);
    expect((await page.evaluate(() => window.__offline.list())).items).toHaveLength(1);
    await context.close();
    record(
      "actual browser-offline IndexedDB write commits without network, survives reload and makes no hidden server call",
    );
  }
  {
    const { pages, context } = await open({ pages: 2 });
    await Promise.all(
      pages.map((page, index) =>
        page.evaluate(
          async (index) =>
            Promise.all(
              Array.from({ length: 20 }, (_, i) => window.__offline.add(index * 20 + i + 1)),
            ),
          index,
        ),
      ),
    );
    expect((await pages[0].evaluate(() => window.__offline.list())).items).toHaveLength(40);
    await Promise.all(pages.map((page) => page.evaluate(() => window.__offline.flush())));
    const stats = await pages[0].evaluate(() => window.__offline.stats());
    expect(stats.sets).toHaveLength(40);
    expect(stats.calls).toHaveLength(40);
    expect((await pages[1].evaluate(() => window.__offline.list())).items).toHaveLength(0);
    await context.close();
    record(
      "two real tabs append 40 sets with no lost-array overwrite and one cross-tab coordinated delivery per set",
    );
  }
  {
    const { pages, context } = await open({ pages: 2 });
    const result = await Promise.all(
      pages.map((page, index) =>
        page.evaluate(async (index) => {
          const outcomes = await Promise.allSettled(
            Array.from({ length: index ? 101 : 100 }, (_, i) =>
              window.__offline.add(index * 100 + i + 1),
            ),
          );
          return outcomes.map((r) => r.status);
        }, index),
      ),
    );
    expect(result.flat().filter((s) => s === "fulfilled")).toHaveLength(200);
    expect(result.flat().filter((s) => s === "rejected")).toHaveLength(1);
    expect((await pages[0].evaluate(() => window.__offline.list())).items).toHaveLength(200);
    await context.close();
    record(
      "the per-owner capacity limit remains exact under concurrent writes from two tabs, retaining all 200 accepted sets",
    );
  }
  {
    const { pages, context } = await open({ pages: 2 });
    await pages[0].evaluate(async () => {
      for (let n = 1; n <= 4; n++) await window.__offline.add(n);
    });
    for (const page of pages)
      await page.evaluate(() =>
        Object.defineProperty(navigator, "locks", { configurable: true, get: () => undefined }),
      );
    await Promise.all(pages.map((page) => page.evaluate(() => window.__offline.flush())));
    expect((await pages[0].evaluate(() => window.__offline.stats())).sets).toHaveLength(4);
    expect((await pages[1].evaluate(() => window.__offline.list())).items).toHaveLength(0);
    await context.close();
    record(
      "without Web Locks, transactional acknowledgements plus idempotent server replies still avoid duplicated or lost stored sets",
    );
  }
  {
    const { pages, context } = await open({ pages: 2 });
    await Promise.all([
      pages[0].evaluate(() => window.__offline.add(1, 20)),
      pages[1].evaluate(() => window.__offline.add(1, 25)),
    ]);
    expect((await pages[0].evaluate(() => window.__offline.list())).items).toHaveLength(2);
    const result = await pages[0].evaluate(() => window.__offline.flush());
    expect(result.synced).toBe(1);
    expect(result.remaining).toBe(1);
    const queue = await pages[0].evaluate(() => window.__offline.list()),
      stats = await pages[0].evaluate(() => window.__offline.stats());
    expect(queue.items[0].lastFailure).toBe("conflict");
    expect(queue.items[0].data.weightKg).not.toBe(stats.sets[0].data.weightKg);
    expect(stats.sets).toHaveLength(1);
    await pages[0].evaluate(() => window.__offline.showStatus(true));
    await expect(pages[0].getByText("Some records need review", { exact: false })).toBeVisible();
    await pages[0].screenshot({
      path: path.join(output, "conflicting-own-set.png"),
      fullPage: true,
    });
    await context.close();
    record(
      "conflicting same-set values from different tabs are both preserved until exact server confirmation; disagreement is visible, never overwritten",
    );
  }
  for (const mode of ["empty", "wrong-owner"]) {
    const { page, context } = await open();
    await page.evaluate(() => window.__offline.add(1));
    await page.evaluate((mode) => window.__offline.control({ ackMode: mode }), mode);
    expect((await page.evaluate(() => window.__offline.flush())).synced).toBe(0);
    expect((await page.evaluate(() => window.__offline.list())).items).toHaveLength(1);
    await page.evaluate(() => window.__offline.control({ ackMode: "normal" }));
    expect((await page.evaluate(() => window.__offline.flush())).synced).toBe(1);
    expect((await page.evaluate(() => window.__offline.stats())).sets).toHaveLength(1);
    await context.close();
    record(
      `${mode} acknowledgement keeps the pending record; a verified retry removes it without a duplicate server set`,
    );
  }
  for (const backBeforeReply of [false, true]) {
    const { page, context } = await open();
    await page.evaluate(async () => {
      await window.__offline.add(1);
      await window.__offline.add(2);
      await window.__offline.control({ delay: 500 });
      window.__inFlight = window.__offline.flush();
    });
    await expect
      .poll(() => page.evaluate(async () => (await window.__offline.stats()).calls.length))
      .toBe(1);
    await page.evaluate((B) => window.__offline.switchOwner(B), B);
    await expect(page.getByTestId("identity")).toHaveText(B);
    if (backBeforeReply) {
      await page.evaluate((A) => window.__offline.switchOwner(A), A);
      await expect(page.getByTestId("identity")).toHaveText(A);
    }
    const cancelled = await page.evaluate(() => window.__inFlight);
    expect(cancelled.cancelled).toBe(true);
    expect(await page.evaluate(() => window.__offline.rawRows())).toHaveLength(2);
    expect((await page.evaluate(() => window.__offline.stats())).calls).toHaveLength(1);
    if (!backBeforeReply) {
      expect((await page.evaluate(() => window.__offline.list())).items).toHaveLength(0);
      await page.evaluate((A) => window.__offline.switchOwner(A), A);
      await expect(page.getByTestId("identity")).toHaveText(A);
    }
    await page.evaluate(() => window.__offline.control({ delay: 0 }));
    expect((await page.evaluate(() => window.__offline.flush())).synced).toBe(2);
    expect((await page.evaluate(() => window.__offline.stats())).sets).toHaveLength(2);
    await context.close();
    record(
      `in-flight A sync stops on identity change${backBeforeReply ? " even when A returns before the reply" : ""}; no next request or premature queue removal occurs`,
    );
  }
  {
    const { page, context } = await open();
    const legacy = JSON.stringify([
      {
        id: "old-A",
        type: "workout_set",
        timestamp: Date.parse("2026-09-09T14:00:00Z"),
        data: {
          sessionId: SA,
          exerciseSlug: "squat",
          exerciseName: "PRIVATE EARLIER A",
          setNumber: 1,
          reps: 8,
          weightKg: 20,
          rpe: null,
          done: true,
        },
      },
      {
        id: "old-B",
        type: "workout_set",
        timestamp: Date.parse("2026-09-09T14:00:00Z"),
        data: {
          sessionId: SB,
          exerciseSlug: "squat",
          exerciseName: "PRIVATE EARLIER B",
          setNumber: 1,
          reps: 8,
          weightKg: 30,
          rpe: null,
          done: true,
        },
      },
      { broken: "retained source" },
    ]);
    await page.evaluate(
      (text) => window.__offline.legacy(text, "unreadable backup must stay"),
      legacy,
    );
    await page.evaluate(() => window.__offline.showStatus(true));
    await expect(page.getByText("Verify earlier device records", { exact: true })).toBeVisible();
    await expect(page.getByText(/PRIVATE EARLIER/)).toHaveCount(0);
    const recovered = await page.evaluate(() => window.__offline.recover());
    expect(recovered.recovered).toBe(1);
    expect(recovered.unverified).toBe(1);
    expect((await page.evaluate(() => window.__offline.list())).items[0].data.exerciseName).toBe(
      "PRIVATE EARLIER A",
    );
    expect(await page.evaluate(() => window.__offline.legacyRaw())).toEqual([
      legacy,
      "unreadable backup must stay",
    ]);
    await page.evaluate(() => window.__offline.flush());
    expect((await page.evaluate(() => window.__offline.recover())).recovered).toBe(0);
    await page.evaluate((B) => window.__offline.switchOwner(B), B);
    await expect(page.getByTestId("identity")).toHaveText(B);
    expect((await page.evaluate(() => window.__offline.recover())).recovered).toBe(1);
    expect((await page.evaluate(() => window.__offline.list())).items[0].data.exerciseName).toBe(
      "PRIVATE EARLIER B",
    );
    expect(await page.evaluate(() => window.__offline.legacyRaw())).toEqual([
      legacy,
      "unreadable backup must stay",
    ]);
    await expect(page.getByText("PRIVATE EARLIER A", { exact: false })).toHaveCount(0);
    await page.screenshot({ path: path.join(output, "legacy-owner-check.png"), fullPage: true });
    await context.close();
    record(
      "mixed A/B legacy rows and malformed bytes remain unchanged; each account recovers only server-verified sessions and acknowledged rows are not reimported",
    );
  }
  {
    const { page, context } = await open();
    await page.evaluate(() => window.__offline.add(1));
    const before = JSON.stringify(await page.evaluate(() => window.__offline.rawRows()));
    await page.evaluate(() => {
      window.__oldTransaction = IDBDatabase.prototype.transaction;
      IDBDatabase.prototype.transaction = function (names, mode, options) {
        if (mode === "readwrite") throw new DOMException("Synthetic quota", "QuotaExceededError");
        return window.__oldTransaction.call(this, names, mode, options);
      };
    });
    expect(
      await page.evaluate(() =>
        window.__offline.add(2).then(
          () => "unexpected",
          (error) => error.message,
        ),
      ),
    ).toMatch(/^OFFLINE_STORAGE/);
    expect(JSON.stringify(await page.evaluate(() => window.__offline.rawRows()))).toBe(before);
    await page.evaluate(() => {
      IDBDatabase.prototype.transaction = window.__oldTransaction;
    });
    expect((await page.evaluate(() => window.__offline.list())).items).toHaveLength(1);
    await context.close();
    record(
      "a refused local transaction leaves the earlier pending records byte-equivalent and never acknowledges the rejected set",
    );
  }
  {
    const { page, context } = await open();
    await page.evaluate(() => window.__offline.list());
    const legacy = JSON.stringify([
      {
        id: "legacy-abort",
        type: "workout_set",
        timestamp: Date.parse("2026-09-09T14:00:00Z"),
        data: {
          sessionId: SA,
          exerciseSlug: "squat",
          exerciseName: "Synthetic old row",
          setNumber: 1,
          reps: 8,
          weightKg: 20,
          rpe: null,
          done: true,
        },
      },
    ]);
    await page.evaluate((text) => window.__offline.legacy(text), legacy);
    await page.evaluate(() => {
      window.__oldAdd = IDBObjectStore.prototype.add;
      IDBObjectStore.prototype.add = function (...args) {
        const result = window.__oldAdd.apply(this, args);
        if (this.name === "pending") {
          const tx = this.transaction;
          queueMicrotask(() => {
            try {
              tx.abort();
            } catch {}
          });
        }
        return result;
      };
    });
    expect(
      await page.evaluate(() =>
        window.__offline.recover().then(
          () => "unexpected",
          (error) => error.message,
        ),
      ),
    ).toBe("OFFLINE_STORAGE_REJECTED");
    expect(await page.evaluate(() => window.__offline.rawRows())).toHaveLength(0);
    expect((await page.evaluate(() => window.__offline.legacyRaw()))[0]).toBe(legacy);
    await page.evaluate(() => {
      IDBObjectStore.prototype.add = window.__oldAdd;
    });
    expect((await page.evaluate(() => window.__offline.recover())).recovered).toBe(1);
    expect((await page.evaluate(() => window.__offline.list())).items).toHaveLength(1);
    await context.close();
    record(
      "aborted legacy import rolls back both the queued item and its receipt; the unchanged original recovers successfully on retry",
    );
  }
  {
    const { page, context } = await open();
    await page.evaluate(() => window.__offline.add(1));
    await page.evaluate(
      (A) =>
        new Promise((resolve, reject) => {
          const open = indexedDB.open("gyms_life_offline_v3", 1);
          open.onsuccess = () => {
            const db = open.result,
              tx = db.transaction("pending", "readwrite");
            tx.objectStore("pending").put({
              id: "corrupt-owned",
              ownerId: A,
              version: 3,
              broken: true,
            });
            tx.oncomplete = () => {
              db.close();
              resolve();
            };
            tx.onabort = () => reject(tx.error);
          };
        }),
      A,
    );
    expect((await page.evaluate(() => window.__offline.list())).invalidCount).toBe(1);
    await page.evaluate(() => window.__offline.flush());
    const rows = await page.evaluate(() => window.__offline.rawRows());
    expect(rows).toHaveLength(1);
    expect(rows[0].id).toBe("corrupt-owned");
    await page.evaluate(() => window.__offline.showStatus(true));
    await expect(page.getByRole("alert")).toContainText("Nothing was deleted");
    await context.close();
    record(
      "a corrupt owned row is retained and reported unavailable while independently confirmed valid rows may synchronize",
    );
  }
  for (const lang of ["lt", "en"]) {
    const { page, context } = await open({ lang, width: 320 });
    await page.evaluate(() => {
      window.__offline.legacy("unreadable synthetic source");
      window.__offline.showStatus(true);
    });
    await expect(
      page.getByRole("button", {
        name: lang === "lt" ? "Patikrinti ankstesnius įrašus" : "Verify earlier device records",
        exact: true,
      }),
    ).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
      320,
    );
    await page.screenshot({ path: path.join(output, `offline-${lang}-320.png`), fullPage: true });
    await context.close();
    record(
      `${lang} account-check/error panel fits 320px without exposing unreadable legacy contents`,
    );
  }
  {
    const { page, context } = await open();
    const outcome = await page.evaluate(async (B) => {
      const write = window.__offline.add(1);
      window.__offline.switchOwner(B);
      return write.then(
        () => "saved",
        (error) => error.message,
      );
    }, B);
    expect(outcome).toBe("OFFLINE_IDENTITY_CHANGED");
    await expect(page.getByTestId("identity")).toHaveText(B);
    expect(await page.evaluate(() => window.__offline.rawRows())).toHaveLength(0);
    await context.close();
    record(
      "a local write whose identity changes before its transaction runs cannot be saved under either wrong account",
    );
  }
  {
    const { pages, context } = await open({ pages: 2 });
    const replies = await Promise.all(
      pages.map((page) => page.evaluate(() => window.__offline.add(1))),
    );
    expect(replies[0].id).toBe(replies[1].id);
    expect((await pages[0].evaluate(() => window.__offline.list())).items).toHaveLength(1);
    await context.close();
    record(
      "two tabs submitting an identical local set share one durable item rather than racing duplicate array entries",
    );
  }
  {
    const { pages, context } = await open({ pages: 2 });
    await context.setOffline(true);
    await pages[0].evaluate(() => window.__offline.showStatus(true));
    await pages[1].evaluate(() => window.__offline.add(1));
    await expect(pages[0].getByText("Sets not sent yet: 1", { exact: true })).toBeVisible();
    await pages[1].evaluate((B) => window.__offline.switchOwner(B), B);
    await expect(pages[0].getByTestId("identity")).toHaveText(B);
    await expect(pages[0].getByText("Sets not sent yet: 1", { exact: true })).toHaveCount(0);
    expect((await pages[0].evaluate(() => window.__offline.list())).items).toHaveLength(0);
    await pages[1].evaluate(() => window.__offline.add(2));
    await expect(pages[0].getByText("Sets not sent yet: 1", { exact: true })).toBeVisible();
    await context.setOffline(false);
    await expect
      .poll(() => pages[0].evaluate(async () => (await window.__offline.list()).items.length))
      .toBe(0);
    const stats = await pages[0].evaluate(() => window.__offline.stats());
    expect(stats.sets).toHaveLength(1);
    expect(stats.sets[0].owner).toBe(B);
    const raw = await pages[0].evaluate(() => window.__offline.rawRows());
    expect(raw).toHaveLength(1);
    expect(raw[0].ownerId).toBe(A);
    await context.close();
    record(
      "BroadcastChannel changes and cross-tab sign-in refresh only the active account's banner and background sync; the prior account remains untouched",
    );
  }
  {
    const { page, context } = await open();
    await page.evaluate(() => {
      Object.defineProperty(window, "BroadcastChannel", {
        configurable: true,
        value: class RefusedChannel {
          constructor() {
            throw new DOMException("Synthetic blocked notification", "SecurityError");
          }
        },
      });
    });
    const saved = await page.evaluate(() => window.__offline.add(1));
    expect(saved.ownerId).toBe(A);
    expect((await page.evaluate(() => window.__offline.list())).items).toHaveLength(1);
    await page.evaluate(() => window.__offline.showStatus(true));
    await expect
      .poll(() => page.evaluate(async () => (await window.__offline.list()).items.length))
      .toBe(0);
    expect((await page.evaluate(() => window.__offline.stats())).sets).toHaveLength(1);
    await context.close();
    record(
      "denied BroadcastChannel support cannot turn a committed write into a hanging or failed save",
    );
  }
  expect(errors).toEqual([]);
} finally {
  await writeFile(
    path.join(output, "results.json"),
    JSON.stringify(
      {
        scope:
          "Real IndexedDB transactions, two browser tabs and actual AuthProvider; entirely synthetic accounts and HTTP endpoints; no production writes",
        results,
        errors,
      },
      null,
      2,
    ) + "\n",
  );
  await browser?.close();
  await server.close();
}
