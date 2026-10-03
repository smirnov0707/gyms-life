import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";

/**
 * What exercise media this repository ships, and how much of it anybody can see.
 *
 * `getExerciseMedia` lowercases the slug before looking it up, so a key with an
 * uppercase letter in it cannot be matched by anything. Most of the frame map is
 * such keys — the raw `free-exercise-db` folder names, imported wholesale — and
 * the bytes behind them go out with every deploy and reach nobody.
 *
 * This is a measurement, not a cleanup: it deletes nothing and decides nothing.
 * Run it with `npm run inventory:media` before changing what ships.
 */

const MEDIA_SOURCE = path.resolve("src/lib/exercise-media.ts");
const SEED = path.resolve("supabase/seed-exercises.sql");
const TREES = ["public/assets/exercise-db", "public/assets/videos", "public/assets/exdb"];

const mb = (bytes) => `${(bytes / 1048576).toFixed(1)} MB`;
const sizeOf = (paths) =>
  paths.reduce((sum, p) => sum + (existsSync(`public${p}`) ? statSync(`public${p}`).size : 0), 0);

/** The brace-delimited body of a top-level const in the media module. */
function mapBody(name) {
  const source = readFileSync(MEDIA_SOURCE, "utf8");
  const start = source.indexOf(`const ${name}`);
  if (start < 0) throw new Error(`MEDIA_MAP_NOT_FOUND:${name}`);
  const open = source.indexOf("{", start);
  let depth = 0;
  let i = open;
  for (; i < source.length; i++) {
    if (source[i] === "{") depth++;
    else if (source[i] === "}" && --depth === 0) break;
  }
  return source.slice(open, i + 1);
}

function frameEntries() {
  return [
    ...mapBody("EXERCISE_DB_FRAMES").matchAll(/^ {2}"?([A-Za-z0-9_-]+)"?:\s*\[([\s\S]*?)\],$/gm),
  ].map((match) => ({
    key: match[1],
    paths: [...match[2].matchAll(/"(\/assets\/[^"]+)"/g)].map((p) => p[1]),
  }));
}

function videoEntries() {
  return [
    ...mapBody("VIDEO_MAP").matchAll(/^ {2}"?([A-Za-z0-9_-]+)"?:\s*"(\/assets\/[^"]+)"/gm),
  ].map((match) => ({ key: match[1], paths: [match[2]] }));
}

function catalogueSlugs() {
  return new Set(
    [...readFileSync(SEED, "utf8").matchAll(/\('([a-z0-9-]+)','/g)].map((match) => match[1]),
  );
}

function filesUnder(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    return entry.isDirectory()
      ? filesUnder(full)
      : [`/${path.relative("public", full).split(path.sep).join("/")}`];
  });
}

const catalogue = catalogueSlugs();
const frames = frameEntries();
const videos = videoEntries();
const reachable = (entry) => entry.key === entry.key.toLowerCase();

const unreachable = frames.filter((entry) => !reachable(entry));
const served = frames.filter((entry) => reachable(entry) && catalogue.has(entry.key));
const strays = frames.filter((entry) => reachable(entry) && !catalogue.has(entry.key));

const onDisk = TREES.filter(existsSync).flatMap(filesUnder);
const named = new Set([...frames, ...videos].flatMap((entry) => entry.paths));
const unnamed = onDisk.filter((file) => !named.has(file));
const absent = [...named].filter((file) => !existsSync(`public${file}`));

const report = {
  catalogue: catalogue.size,
  frames: {
    entries: frames.length,
    servedToAthletes: { entries: served.length, bytes: sizeOf(served.flatMap((e) => e.paths)) },
    // Not "unused": the lookup lowercases, so these can never be matched.
    unreachableByLookup: {
      entries: unreachable.length,
      bytes: sizeOf(unreachable.flatMap((e) => e.paths)),
    },
    lowercaseWithNoExercise: strays.length,
  },
  videos: { entries: videos.length, bytes: sizeOf(videos.flatMap((e) => e.paths)) },
  onDisk: { files: onDisk.length, bytes: sizeOf(onDisk) },
  namedButAbsent: absent,
  neverNamedByTheMap: {
    files: unnamed.length,
    bytes: sizeOf(unnamed),
    examples: unnamed.slice(0, 8),
  },
};

console.log(JSON.stringify(report, null, 2));
console.log(
  [
    "",
    `catalogue:           ${report.catalogue} exercises`,
    `reaches an athlete:  ${report.frames.servedToAthletes.entries} frame sets (${mb(report.frames.servedToAthletes.bytes)}) + ${report.videos.entries} videos (${mb(report.videos.bytes)})`,
    `cannot be reached:   ${report.frames.unreachableByLookup.entries} frame sets (${mb(report.frames.unreachableByLookup.bytes)}) — keys the lowercasing lookup can never match`,
    `shipped in total:    ${report.onDisk.files} files (${mb(report.onDisk.bytes)})`,
    `named but absent:    ${report.namedButAbsent.length}`,
    `never named:         ${report.neverNamedByTheMap.files} files (${mb(report.neverNamedByTheMap.bytes)})`,
    "",
  ].join("\n"),
);

if (report.namedButAbsent.length > 0) process.exitCode = 1;
