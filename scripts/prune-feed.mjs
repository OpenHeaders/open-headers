/**
 * Plans the retention sweep of the update feed bucket: which
 * `dl/<tag>/` prefixes and which apt/rpm repository objects can go,
 * and the redirect expression that sends the pruned tags' download
 * links to the GitHub release page that keeps every byte for good.
 *
 * Retention is by reference, never by age alone. A tag stays while
 * any live pointer names it — `versions/<channel>.json` (every app's
 * `tag`) and the electron-updater `desktop/<channel>/*.yml` files
 * (their absolute `dl/<tag>/` URLs) — or while its newest object is
 * younger than the grace window, so a release that nothing points at
 * yet (a lane still running, a tag cut and abandoned) is never swept
 * from under its own run. The current stable in a quiet quarter is
 * therefore safe: the manifest names it until the next one lands.
 *
 * The apt pool and rpm Packages directories hold bucket-internal
 * copies of the debs and rpms the newest-only indexes name; copies
 * for older tags stay behind every release, so the sweep keeps
 * exactly what the signed indexes list (`Packages` → `Filename:`,
 * `repomd.xml` → its repodata, the primary index → its rpms) and
 * nothing else. A channel whose index is missing from the pointers
 * is left whole — an absent index is never read as "nothing kept".
 *
 * Deletes are planned only inside `dl/<tag>/`, `apt/<channel>/pool/`,
 * `rpm/<channel>/Packages/` and `rpm/<channel>/repodata/`; every
 * other key is out of scope by construction. The redirect skips
 * `.blockmap` files on purpose: the desktop app fetches an old
 * blockmap only when its local copy is gone, and a 404 there means a
 * full download from the feed — the app's own requests never leave
 * the first-party domain.
 *
 * Inputs are local files the workflow fetches with the AWS CLI: the
 * bucket listing (`aws s3api list-objects-v2` JSON) and a directory
 * mirroring the pointer keys. Output is `plan.json` plus
 * `delete-NNN.json` batches in the DeleteObjects request shape.
 *
 * Usage: node scripts/prune-feed.mjs --listing <objects.json> --pointers <dir> --out <dir>
 *          [--grace-days=60] [--now=<iso>] [--keep=<tag>]... [--release-repo=<owner/name>]
 */

import { existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import * as path from 'node:path';
import { gunzipSync } from 'node:zlib';

const DAY_MS = 24 * 60 * 60 * 1000;
const DELETE_BATCH = 1000;

function fail(message) {
  console.error(`prune-feed: ${message}`);
  process.exit(1);
}

function parseArgs(argv) {
  const options = { graceDays: 60, keep: [], releaseRepo: 'OpenHeaders/open-headers', now: new Date() };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    const eq = arg.indexOf('=');
    const flag = eq === -1 ? arg : arg.slice(0, eq);
    const value = eq === -1 ? argv[(i += 1)] : arg.slice(eq + 1);
    if (value === undefined) fail(`${flag} expects a value`);
    switch (flag) {
      case '--listing':
        options.listing = value;
        break;
      case '--pointers':
        options.pointers = value;
        break;
      case '--out':
        options.out = value;
        break;
      case '--grace-days': {
        const days = Number(value);
        if (!Number.isInteger(days) || days < 0) fail(`--grace-days expects a non-negative integer, got '${value}'`);
        options.graceDays = days;
        break;
      }
      case '--now': {
        const now = new Date(value);
        if (Number.isNaN(now.getTime())) fail(`--now expects an ISO date, got '${value}'`);
        options.now = now;
        break;
      }
      case '--keep':
        options.keep.push(value);
        break;
      case '--release-repo':
        options.releaseRepo = value;
        break;
      default:
        fail(`unknown option '${flag}'`);
    }
  }
  if (!options.listing || !options.pointers || !options.out) {
    fail('usage: prune-feed.mjs --listing <objects.json> --pointers <dir> --out <dir> [--grace-days=N] [--keep=<tag>]...');
  }
  return options;
}

function readListing(file) {
  let parsed;
  try {
    parsed = JSON.parse(readFileSync(file, 'utf8'));
  } catch (error) {
    fail(`cannot read the bucket listing ${file}: ${error.message}`);
  }
  const contents = parsed.Contents ?? [];
  if (!Array.isArray(contents)) fail(`${file}: 'Contents' is not a list`);
  return contents.map((entry) => {
    if (typeof entry.Key !== 'string' || typeof entry.Size !== 'number') fail(`${file}: malformed listing entry`);
    const modified = new Date(entry.LastModified);
    if (Number.isNaN(modified.getTime())) fail(`${file}: ${entry.Key} has no LastModified`);
    return { key: entry.Key, size: entry.Size, modified };
  });
}

function walk(dir) {
  if (!existsSync(dir)) return [];
  const files = [];
  for (const name of readdirSync(dir)) {
    const full = path.join(dir, name);
    if (statSync(full).isDirectory()) files.push(...walk(full));
    else files.push(full);
  }
  return files;
}

/** Every `tag` string anywhere in a versions manifest. */
function manifestTags(value, into) {
  if (Array.isArray(value)) {
    for (const item of value) manifestTags(item, into);
  } else if (value && typeof value === 'object') {
    for (const [key, item] of Object.entries(value)) {
      if (key === 'tag' && typeof item === 'string' && item !== '') into.add(item);
      else manifestTags(item, into);
    }
  }
}

function referencedTags(pointersDir) {
  const tags = new Set();
  for (const file of walk(path.join(pointersDir, 'versions'))) {
    if (!file.endsWith('.json')) continue;
    try {
      manifestTags(JSON.parse(readFileSync(file, 'utf8')), tags);
    } catch (error) {
      fail(`cannot parse ${file}: ${error.message}`);
    }
  }
  for (const file of walk(path.join(pointersDir, 'desktop'))) {
    if (!file.endsWith('.yml')) continue;
    for (const match of readFileSync(file, 'utf8').matchAll(/\/dl\/([^/\s"']+)\//g)) tags.add(match[1]);
  }
  return tags;
}

function planDownloads(objects, keptTags, graceMs, now) {
  const prefixes = new Map();
  for (const object of objects) {
    const match = object.key.match(/^dl\/([^/]+)\//);
    if (!match) continue;
    const entry = prefixes.get(match[1]) ?? { tag: match[1], objects: 0, bytes: 0, newest: new Date(0) };
    entry.objects += 1;
    entry.bytes += object.size;
    if (object.modified > entry.newest) entry.newest = object.modified;
    prefixes.set(match[1], entry);
  }
  const kept = [];
  const dropped = [];
  for (const entry of [...prefixes.values()].sort((a, b) => a.tag.localeCompare(b.tag))) {
    const referenced = keptTags.has(entry.tag);
    const inGrace = now.getTime() - entry.newest.getTime() < graceMs;
    if (referenced || inGrace) {
      kept.push({ ...entry, reason: referenced ? 'referenced' : 'grace' });
    } else {
      dropped.push(entry);
    }
  }
  return { kept, dropped };
}

/** apt: a channel's pool keeps exactly the debs its Packages indexes name. */
function planApt(objects, pointersDir, warnings) {
  const indexedByChannel = new Map();
  for (const file of walk(path.join(pointersDir, 'apt'))) {
    const relative = path.relative(path.join(pointersDir, 'apt'), file).split(path.sep);
    if (relative[1] !== 'dists' || path.basename(file) !== 'Packages') continue;
    const channel = relative[0];
    const kept = indexedByChannel.get(channel) ?? new Set();
    for (const match of readFileSync(file, 'utf8').matchAll(/^Filename:\s*(\S+)\s*$/gm)) {
      kept.add(`apt/${channel}/${match[1]}`);
    }
    indexedByChannel.set(channel, kept);
  }
  const dropped = [];
  for (const object of objects) {
    const match = object.key.match(/^apt\/([^/]+)\/pool\//);
    if (!match) continue;
    const kept = indexedByChannel.get(match[1]);
    if (!kept) {
      warnings.add(`apt/${match[1]}: no Packages index among the pointers — its pool is left untouched`);
      continue;
    }
    if (!kept.has(object.key)) dropped.push(object);
  }
  return dropped;
}

/** rpm: a channel keeps the repodata `repomd.xml` names and the rpms its primary index lists. */
function planRpm(objects, pointersDir, warnings) {
  const keptByChannel = new Map();
  const rpmDir = path.join(pointersDir, 'rpm');
  for (const file of walk(rpmDir)) {
    if (path.basename(file) !== 'repomd.xml') continue;
    const channel = path.relative(rpmDir, file).split(path.sep)[0];
    const kept = new Set([`rpm/${channel}/repodata/repomd.xml`, `rpm/${channel}/repodata/repomd.xml.asc`]);
    const repomd = readFileSync(file, 'utf8');
    let primary;
    for (const match of repomd.matchAll(/<data type="([^"]+)">[\s\S]*?<location href="([^"]+)"/g)) {
      kept.add(`rpm/${channel}/${match[2]}`);
      if (match[1] === 'primary') primary = match[2];
    }
    if (!primary) fail(`rpm/${channel}: repomd.xml names no primary index`);
    const primaryFile = path.join(rpmDir, channel, primary);
    if (!existsSync(primaryFile)) fail(`rpm/${channel}: ${primary} is not among the pointers — refusing to plan its Packages`);
    let primaryXml;
    try {
      primaryXml = gunzipSync(readFileSync(primaryFile)).toString('utf8');
    } catch (error) {
      fail(`rpm/${channel}: cannot read ${primary}: ${error.message}`);
    }
    for (const match of primaryXml.matchAll(/<location href="([^"]+)"/g)) kept.add(`rpm/${channel}/${match[1]}`);
    keptByChannel.set(channel, kept);
  }
  const dropped = [];
  for (const object of objects) {
    const match = object.key.match(/^rpm\/([^/]+)\/(Packages|repodata)\//);
    if (!match) continue;
    const kept = keptByChannel.get(match[1]);
    if (!kept) {
      warnings.add(`rpm/${match[1]}: no repomd.xml among the pointers — its objects are left untouched`);
      continue;
    }
    if (!kept.has(object.key)) dropped.push(object);
  }
  return dropped;
}

/**
 * The zone Redirect Rule: a `dl/` path outside the kept tags goes to
 * the same asset on the GitHub release page, blockmaps excepted.
 */
function redirectRule(keptTags, releaseRepo) {
  const exclusions = [...keptTags]
    .sort()
    .map((tag) => `not starts_with(http.request.uri.path, "/dl/${tag}/")`);
  const expression = ['starts_with(http.request.uri.path, "/dl/")', 'not ends_with(http.request.uri.path, ".blockmap")', ...exclusions].join(
    ' and ',
  );
  const target = `https://github.com/${releaseRepo}/releases/download/`;
  const targetExpression = `wildcard_replace(http.request.uri.path, "/dl/*", "${target}\${1}")`;
  return { expression, targetExpression, statusCode: 302 };
}

function formatBytes(bytes) {
  return `${(bytes / 1e9).toFixed(2)} GB`;
}

const options = parseArgs(process.argv.slice(2));
const objects = readListing(options.listing);
const warnings = new Set();

const keptTags = referencedTags(options.pointers);
if (keptTags.size === 0) fail(`no release tag is referenced under ${options.pointers} — refusing to plan against empty pointers`);
for (const tag of options.keep) keptTags.add(tag);

const downloads = planDownloads(objects, keptTags, options.graceDays * DAY_MS, options.now);
for (const tag of keptTags) {
  if (!downloads.kept.some((entry) => entry.tag === tag)) warnings.add(`${tag} is referenced but has no dl/${tag}/ objects`);
}
const aptDropped = planApt(objects, options.pointers, warnings);
const rpmDropped = planRpm(objects, options.pointers, warnings);

const deleteKeys = [
  ...downloads.dropped.flatMap((entry) =>
    objects.filter((object) => object.key.startsWith(`dl/${entry.tag}/`)).map((object) => object.key),
  ),
  ...aptDropped.map((object) => object.key),
  ...rpmDropped.map((object) => object.key),
];
const freedBytes =
  downloads.dropped.reduce((sum, entry) => sum + entry.bytes, 0) +
  [...aptDropped, ...rpmDropped].reduce((sum, object) => sum + object.size, 0);
const redirect = redirectRule(
  downloads.kept.map((entry) => entry.tag),
  options.releaseRepo,
);

const plan = {
  now: options.now.toISOString(),
  graceDays: options.graceDays,
  bucketObjects: objects.length,
  bucketBytes: objects.reduce((sum, object) => sum + object.size, 0),
  keptTags: downloads.kept.map((entry) => ({ tag: entry.tag, reason: entry.reason, objects: entry.objects, bytes: entry.bytes })),
  droppedTags: downloads.dropped.map((entry) => ({ tag: entry.tag, objects: entry.objects, bytes: entry.bytes, newest: entry.newest.toISOString() })),
  droppedRepositoryObjects: [...aptDropped, ...rpmDropped].map((object) => object.key),
  deleteKeys,
  freedBytes,
  redirect,
  warnings: [...warnings],
};

mkdirSync(options.out, { recursive: true });
writeFileSync(path.join(options.out, 'plan.json'), `${JSON.stringify(plan, null, 2)}\n`);
for (let i = 0; i < deleteKeys.length; i += DELETE_BATCH) {
  const batch = { Objects: deleteKeys.slice(i, i + DELETE_BATCH).map((Key) => ({ Key })), Quiet: true };
  const name = `delete-${String(i / DELETE_BATCH).padStart(3, '0')}.json`;
  writeFileSync(path.join(options.out, name), `${JSON.stringify(batch)}\n`);
}

console.log(`bucket: ${objects.length} objects, ${formatBytes(plan.bucketBytes)}`);
console.log(`kept tags (${downloads.kept.length}):`);
for (const entry of downloads.kept) {
  console.log(`  ${entry.tag}  ${entry.reason}  ${entry.objects} objects  ${formatBytes(entry.bytes)}`);
}
console.log(`dropped tags (${downloads.dropped.length}):`);
for (const entry of downloads.dropped) {
  console.log(`  ${entry.tag}  newest ${entry.newest.toISOString().slice(0, 10)}  ${entry.objects} objects  ${formatBytes(entry.bytes)}`);
}
console.log(`dropped repository objects (${aptDropped.length + rpmDropped.length}):`);
for (const object of [...aptDropped, ...rpmDropped]) console.log(`  ${object.key}`);
console.log(`to delete: ${deleteKeys.length} objects, ${formatBytes(freedBytes)}`);
console.log(`redirect: ${redirect.expression}`);
console.log(`       -> ${redirect.targetExpression}`);
for (const warning of warnings) console.log(`::warning::${warning}`);
