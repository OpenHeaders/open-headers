import { createReport, type ImportReport, recordDrop } from '../report';
import { convertBruRequest } from './request';
import { type BruBlock, tokenizeBru } from './tokenize';
import type {
  BrunoFile,
  BrunoParsedEnvironment,
  BrunoParsedEnvironmentVariable,
  BrunoParsedFolder,
  BrunoParsedRequest,
  BrunoParseResult,
} from './types';
import { BrunoParseError } from './types';

// ── Picker helpers ─────────────────────────────────────────────────

function normalizePath(path: string): string {
  return path.replace(/\\/g, '/').replace(/^\.\//, '').replace(/^\/+/, '');
}

/**
 * Which paths inside a user-picked folder the import surface should
 * read: `.bru` files and `bruno.json`. Everything else — assets, VCS
 * internals, `node_modules`, dot-directories — is never opened.
 */
export function isBrunoImportPath(path: string): boolean {
  const segments = normalizePath(path)
    .split('/')
    .filter((s) => s.length > 0);
  if (segments.some((s) => s.startsWith('.') || s === 'node_modules')) return false;
  const fileName = segments[segments.length - 1] ?? '';
  return fileName === 'bruno.json' || fileName.toLowerCase().endsWith('.bru');
}

/**
 * A picked folder arrives with every path prefixed by the folder's own
 * name (`webkitRelativePath` / drag-entry `fullPath`). Strip that one
 * shared leading directory so paths are collection-relative. Only
 * strips when ALL paths share the segment and none would lose its file
 * name; a shared `environments` root never strips — picking the
 * environments folder itself keeps its meaning.
 */
export function stripBrunoRootPrefix<T extends { path: string }>(files: T[]): T[] {
  if (files.length === 0) return files;
  const segmented = files.map((f) => normalizePath(f.path).split('/').filter((s) => s.length > 0));
  const head = segmented[0]?.[0];
  if (!head || head === 'environments') return files;
  if (!segmented.every((s) => s.length >= 2 && s[0] === head)) return files;
  return files.map((f, i) => ({ ...f, path: (segmented[i] ?? []).slice(1).join('/') }));
}

// ── Entry points ───────────────────────────────────────────────────

/**
 * Parse a Bruno collection folder: many `.bru` file contents plus
 * their collection-relative paths → one collection. The folder picker
 * (or the Phase 4 scanner) reads the files; this parser never touches
 * the filesystem.
 *
 * Recognized layout:
 *   • `bruno.json` — collection config (name).
 *   • `collection.bru` — collection-level defaults (name via `meta`;
 *     headers/auth/vars drop with guidance).
 *   • `<dir>/folder.bru` — folder metadata (display-name override).
 *   • `environments/*.bru` — environments (`vars` block; `vars:secret`
 *     names drop — exports carry no secret values).
 *   • every other `*.bru` — one request each; folder path from the
 *     relative directories, ordered by `meta.seq`.
 */
export function parseBrunoFiles(files: BrunoFile[]): BrunoParseResult {
  if (files.length === 0) {
    throw new BrunoParseError('No files to import.');
  }
  const report = createReport('bruno', 0);

  let collectionName = '';
  const folderNames = new Map<string, string>();
  const requestFiles: Array<{ path: string; dirs: string[]; baseName: string; blocks: BruBlock[] }> = [];
  const environments: BrunoParsedEnvironment[] = [];

  for (const file of files) {
    const normalized = normalizePath(file.path);
    const segments = normalized.split('/').filter((s) => s.length > 0);
    const fileName = segments[segments.length - 1] ?? '';
    const dirs = segments.slice(0, -1);

    if (fileName === 'bruno.json') {
      collectionName = brunoJsonName(file.content, normalized, report) || collectionName;
      continue;
    }
    if (!fileName.toLowerCase().endsWith('.bru')) {
      recordDrop(report, {
        path: normalized,
        reason: 'Not a .bru file — skipped.',
        tracking: 'PERMANENT: bru shape validation',
      });
      continue;
    }
    const blocks = tokenizeBru(file.content);
    const baseName = fileName.slice(0, -'.bru'.length);

    if (fileName === 'collection.bru' && dirs.length === 0) {
      collectionName = collectionName || metaName(blocks) || '';
      reportCollectionDefaults(blocks, normalized, report);
      continue;
    }
    if (fileName === 'folder.bru') {
      const name = metaName(blocks);
      if (name) folderNames.set(dirs.join('/'), name);
      reportCollectionDefaults(blocks, normalized, report);
      continue;
    }
    if (dirs[0] === 'environments') {
      environments.push(parseEnvironmentFile(blocks, baseName, normalized, report));
      continue;
    }
    requestFiles.push({ path: normalized, dirs, baseName, blocks });
  }

  const folderPathOf = (dirs: string[]): string[] =>
    dirs.map((_, i) => folderNames.get(dirs.slice(0, i + 1).join('/')) ?? dirs[i] ?? '');

  const converted = requestFiles.map((f) => ({
    dirs: f.dirs,
    folderPath: folderPathOf(f.dirs),
    ...convertBruRequest(f.blocks, f.baseName, f.path, report),
  }));
  converted.sort((a, b) => {
    const dirCmp = a.dirs.join('/').localeCompare(b.dirs.join('/'));
    if (dirCmp !== 0) return dirCmp;
    return (a.seq ?? Number.POSITIVE_INFINITY) - (b.seq ?? Number.POSITIVE_INFINITY);
  });
  const requests: BrunoParsedRequest[] = converted.map((c) => ({ folderPath: c.folderPath, request: c.request }));

  // Every directory on the way to a request becomes a folder — parents
  // first, deduped, so the write path can create them in order.
  const folderSet = new Map<string, string[]>();
  for (const c of converted) {
    for (let depth = 1; depth <= c.folderPath.length; depth++) {
      const prefix = c.folderPath.slice(0, depth);
      folderSet.set(prefix.join('\u0000'), prefix);
    }
  }
  const folders: BrunoParsedFolder[] = [...folderSet.values()]
    .sort((a, b) => a.length - b.length || a.join('/').localeCompare(b.join('/')))
    .map((path) => ({ path }));

  report.summary = { ...report.summary, imported: requests.length + environments.length };

  return {
    collectionName: collectionName || 'Imported Collection',
    folders,
    requests,
    environments,
    report,
  };
}

/** Single-file convenience wrapper — a pasted or dropped lone `.bru` request. */
export function parseBruno(content: string): BrunoParseResult {
  return parseBrunoFiles([{ path: 'request.bru', content }]);
}

// ── Collection / folder metadata ───────────────────────────────────

function metaName(blocks: BruBlock[]): string {
  const meta = blocks.find((b) => b.name === 'meta');
  const entry = meta?.entries.find((e) => e.key === 'name' && !e.disabled);
  return entry?.value.trim() ?? '';
}

function brunoJsonName(content: string, path: string, report: ImportReport): string {
  try {
    const parsed: unknown = JSON.parse(content);
    if (typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed)) {
      const name = (parsed as Record<string, unknown>).name;
      if (typeof name === 'string') return name.trim();
    }
  } catch {
    // fall through to the drop below
  }
  recordDrop(report, {
    path,
    reason: 'bruno.json could not be read — the collection name falls back to collection.bru or the default.',
    tracking: 'PERMANENT: bru shape validation',
  });
  return '';
}

/**
 * `collection.bru` / `folder.bru` can carry default headers, auth,
 * vars, and scripts that apply to every request underneath. Our model
 * has no collection-level request defaults — they drop with guidance
 * rather than silently vanishing.
 */
function reportCollectionDefaults(blocks: BruBlock[], path: string, report: ImportReport): void {
  for (const block of blocks) {
    if (block.name === 'meta') continue;
    const head = block.name.split(':')[0] ?? block.name;
    const scriptShaped = head === 'script' || head === 'tests' || head === 'vars' || head === 'assert';
    recordDrop(report, {
      path: `${path}.${block.name}`,
      reason: scriptShaped
        ? `Collection-level \`${block.name}\` not imported — scripts and runtime vars need the offscreen-document sandbox (§19).`
        : `Collection-level \`${block.name}\` not imported — set it on the requests (or as a header rule) after import.`,
      tracking: scriptShaped ? '#todo-scripts' : '#todo-collection-defaults',
    });
  }
}

// ── Environments ───────────────────────────────────────────────────

function parseEnvironmentFile(
  blocks: BruBlock[],
  name: string,
  path: string,
  report: ImportReport,
): BrunoParsedEnvironment {
  const variables: BrunoParsedEnvironmentVariable[] = [];
  const vars = blocks.find((b) => b.name === 'vars');
  for (const e of vars?.entries ?? []) {
    if (!e.key) continue;
    if (e.disabled) {
      recordDrop(report, {
        path: `${path}.vars.${e.key}`,
        reason: `Variable "${e.key}" is disabled in the source — not imported.`,
        tracking: 'PERMANENT: disabled-variable policy',
      });
      continue;
    }
    variables.push({ name: e.key, value: e.value, type: 'default' });
  }
  const secret = blocks.find((b) => b.name === 'vars:secret');
  if (secret && secret.items.length > 0) {
    recordDrop(report, {
      path: `${path}.vars:secret`,
      reason: `${secret.items.length} secret variable${secret.items.length === 1 ? '' : 's'} (${secret.items.join(', ')}) not imported — Bruno keeps secret values out of the collection files, so there is nothing to carry over. Re-enter them after import.`,
      tracking: 'PERMANENT: secrets never in files',
    });
  }
  return { name, variables };
}
