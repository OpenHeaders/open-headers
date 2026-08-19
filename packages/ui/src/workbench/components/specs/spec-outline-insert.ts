/**
 * Spec outline Add affordances — pure insertion planning.
 *
 * `planSpecInsertion` computes WHERE a scaffold snippet lands and WHAT
 * text to insert, from the same `yaml.parseDocument` AST ranges the
 * outline derives from: a block collection's nodeEnd sits at the start
 * of the line after its last child (trailing newline included), so
 * appends insert there with the last child's line prefix as the
 * indentation source — `- ` sequence markers ride the prefix. Absent
 * sections are created (nested `components:` wrappers included) at the
 * document tail. The caller applies the plan to the MONACO BUFFER
 * (undoable edit; dirty derives) — never to the mirror; the verbatim
 * save law is untouched.
 *
 * YAML-only by design (S6 ratification): a `.json` root hides the
 * affordances — JSON emission lands with the import legs if demand
 * shows. Inserted names mint a uniqueness suffix so a second click
 * never creates a duplicate key. Returns null when the buffer does
 * not currently parse to a mapping (the validation strip is already
 * telling the user why), when a section exists as an empty flow
 * collection, or when a path has no free verb left.
 */

import type { Pair, YAMLMap, YAMLSeq } from 'yaml';
import { isMap, isScalar, isSeq, parseDocument } from 'yaml';

export type SpecInsertTarget =
  | { kind: 'server' }
  | { kind: 'tag' }
  | { kind: 'path' }
  | { kind: 'operation'; pathKey: string }
  | { kind: 'schema' }
  | { kind: 'securityScheme' }
  | { kind: 'securityRequirement' };

export interface SpecInsertion {
  /** Character offset the text inserts at. */
  offset: number;
  text: string;
  /** Editable token's absolute offsets after insertion — the caller
   *  selects it so the user can type the real name straight away. */
  selectionStart: number;
  selectionEnd: number;
}

const OPERATION_VERBS = ['get', 'post', 'put', 'patch', 'delete', 'head', 'options'];

function keyString(pair: Pair): string | null {
  return isScalar(pair.key) && (typeof pair.key.value === 'string' || typeof pair.key.value === 'number')
    ? String(pair.key.value)
    : null;
}

function findPair(map: YAMLMap, key: string): Pair | null {
  return map.items.find((item) => keyString(item) === key) ?? null;
}

function nodeRange(node: unknown): [number, number, number] | null {
  if (node !== null && typeof node === 'object' && 'range' in node) {
    const range = (node as { range?: [number, number, number] | null }).range;
    if (Array.isArray(range)) return range;
  }
  return null;
}

function lineStart(content: string, offset: number): number {
  return content.lastIndexOf('\n', offset - 1) + 1;
}

/** Existing keys of a map section — uniqueness source. */
function mapKeys(map: YAMLMap): Set<string> {
  const keys = new Set<string>();
  for (const item of map.items) {
    const key = keyString(item);
    if (key !== null) keys.add(key);
  }
  return keys;
}

function uniqueName(base: string, taken: Set<string>, separator: string): string {
  if (!taken.has(base)) return base;
  for (let i = 2; ; i++) {
    const candidate = `${base}${separator}${i}`;
    if (!taken.has(candidate)) return candidate;
  }
}

// ── Snippets — 2-space relative indent; TOKEN marks the selection ──

interface Snippet {
  lines: string[];
  /** The editable token — must appear exactly once across the lines. */
  token: string;
}

function serverSnippet(): Snippet {
  const token = 'https://api.openheaders.com';
  return { lines: [`url: '${token}'`, `description: 'Server description'`], token };
}

function tagSnippet(existing: Set<string>): Snippet {
  const token = uniqueName('new-tag', existing, '-');
  return { lines: [`name: '${token}'`, `description: 'Tag description'`], token };
}

function operationLines(verb: string): string[] {
  return [`${verb}:`, `  summary: 'New operation'`, '  responses:', `    '200':`, `      description: 'OK'`];
}

function pathSnippet(existing: Set<string>): Snippet {
  const token = uniqueName('/new-path', existing, '-');
  return { lines: [`${token}:`, ...operationLines('get').map((line) => `  ${line}`)], token };
}

function operationSnippet(verb: string): Snippet {
  return { lines: operationLines(verb), token: 'New operation' };
}

function schemaSnippet(existing: Set<string>): Snippet {
  const token = uniqueName('NewSchema', existing, '');
  return { lines: [`${token}:`, '  type: object'], token };
}

function securitySchemeSnippet(existing: Set<string>): Snippet {
  const token = uniqueName('NewSecurityScheme', existing, '');
  return { lines: [`${token}:`, '  type: apiKey', '  in: header', `  name: 'X-Api-Key'`], token };
}

function securityRequirementSnippet(root: YAMLMap): Snippet {
  // Reference the first declared scheme so the inserted requirement is
  // immediately valid; the placeholder name otherwise.
  const components = findPair(root, 'components');
  const schemes = components && isMap(components.value) ? findPair(components.value, 'securitySchemes') : null;
  const declared = schemes && isMap(schemes.value) ? [...mapKeys(schemes.value)] : [];
  const token = declared[0] ?? 'NewSecurityScheme';
  return { lines: [`${token}: []`], token };
}

// ── Insertion spots ────────────────────────────────────────────────

interface Spot {
  insertAt: number;
  /** First inserted line's full prefix (spaces, `- ` for seq entries). */
  firstPrefix: string;
  /** Continuation lines' indentation (spaces of firstPrefix's width). */
  restIndent: string;
  /** Wrapper lines to emit before the snippet (absent section keys). */
  wrapperLines: string[];
}

/** Append spot inside an existing block collection with ≥1 item. */
function appendSpot(content: string, collection: YAMLMap | YAMLSeq): Spot | null {
  const items = collection.items as unknown[];
  const last = items[items.length - 1];
  // Map items are Pairs (no range) — anchor on the key; seq items are
  // nodes with their own range.
  const lastPair = last as Pair;
  const anchor = isSeq(collection) ? nodeRange(last) : (nodeRange(lastPair.key) ?? nodeRange(lastPair.value));
  const end = nodeRange(collection);
  if (!anchor || !end) return null;
  const start = lineStart(content, anchor[0]);
  const firstPrefix = content.slice(start, anchor[0]);
  return {
    insertAt: end[2],
    firstPrefix,
    restIndent: ' '.repeat(firstPrefix.length),
    wrapperLines: [],
  };
}

/** Spot right after a key whose value is empty (plain `paths:`). */
function afterKeySpot(content: string, pair: Pair, seqEntry: boolean): Spot | null {
  const keyRange = nodeRange(pair.key);
  if (!keyRange) return null;
  const keyColumn = keyRange[0] - lineStart(content, keyRange[0]);
  const newline = content.indexOf('\n', keyRange[1]);
  const insertAt = newline === -1 ? content.length : newline + 1;
  const indent = ' '.repeat(keyColumn + 2);
  return {
    insertAt,
    // Scaffold convention: the `- ` marker sits at the child indent,
    // entry content two deeper.
    firstPrefix: seqEntry ? `${indent}- ` : indent,
    restIndent: seqEntry ? `${indent}  ` : indent,
    wrapperLines: [],
  };
}

/**
 * Resolve the spot for a section key-path from the root, creating the
 * missing tail levels as wrapper lines. `seqEntry` marks the leaf
 * collection as a sequence (`- ` entries).
 */
function sectionSpot(content: string, root: YAMLMap, keyPath: string[], seqEntry: boolean): Spot | null {
  let map = root;
  for (let depth = 0; depth < keyPath.length; depth++) {
    const pair = findPair(map, keyPath[depth]);
    const isLeaf = depth === keyPath.length - 1;
    if (pair) {
      const value = pair.value;
      if (isLeaf) {
        if ((isSeq(value) || isMap(value)) && value.items.length > 0) {
          if (value.flow) return null;
          return appendSpot(content, value);
        }
        if ((isSeq(value) || isMap(value)) && value.flow) return null;
        if (value !== null && !isScalar(value)) return null;
        if (isScalar(value) && value.value !== null) return null;
        return afterKeySpot(content, pair, seqEntry);
      }
      if (isMap(value)) {
        map = value;
        continue;
      }
      if (value === null || (isScalar(value) && value.value === null)) {
        // Existing empty wrapper (`components:`) — create the rest
        // of the path under it.
        const spot = afterKeySpot(content, pair, false);
        if (!spot) return null;
        return wrapRemainder(spot, keyPath.slice(depth + 1), seqEntry);
      }
      return null;
    }
    // Key absent from this level: create the remainder. At the root,
    // that means appending a new top-level section at the document
    // tail; deeper, appending inside the resolved map.
    if (map === root) {
      const insertAt = content.length;
      const spot: Spot = { insertAt, firstPrefix: '', restIndent: '', wrapperLines: [] };
      return wrapRemainder(spot, keyPath.slice(depth), seqEntry, true);
    }
    const container = appendSpot(content, map);
    if (!container) return null;
    return wrapRemainder(container, keyPath.slice(depth), seqEntry);
  }
  return null;
}

/** Emit wrapper key lines for the missing tail of a key-path, stepping
 *  the indentation down to where the snippet's entries land. */
function wrapRemainder(spot: Spot, missing: string[], seqEntry: boolean, atRoot = false): Spot {
  const wrapperLines = [...spot.wrapperLines];
  let indent = atRoot ? '' : spot.firstPrefix;
  for (const key of missing) {
    wrapperLines.push(`${indent}${key}:`);
    indent = `${indent}  `;
  }
  return {
    insertAt: spot.insertAt,
    firstPrefix: seqEntry ? `${indent}- ` : indent,
    restIndent: seqEntry ? `${indent}  ` : indent,
    wrapperLines,
  };
}

// ── Entry point ────────────────────────────────────────────────────

const SECTION_OF: Record<Exclude<SpecInsertTarget['kind'], 'operation'>, { path: string[]; seq: boolean }> = {
  server: { path: ['servers'], seq: true },
  tag: { path: ['tags'], seq: true },
  path: { path: ['paths'], seq: false },
  schema: { path: ['components', 'schemas'], seq: false },
  securityScheme: { path: ['components', 'securitySchemes'], seq: false },
  securityRequirement: { path: ['security'], seq: true },
};

function existingLeafKeys(root: YAMLMap, keyPath: string[]): Set<string> {
  let map: YAMLMap | null = root;
  for (const key of keyPath) {
    if (!map) return new Set();
    const pair: Pair | null = findPair(map, key);
    map = pair && isMap(pair.value) ? pair.value : null;
  }
  return map ? mapKeys(map) : new Set();
}

function existingTagNames(root: YAMLMap): Set<string> {
  const names = new Set<string>();
  const tags = findPair(root, 'tags');
  if (tags && isSeq(tags.value)) {
    for (const item of tags.value.items) {
      if (!isMap(item)) continue;
      const name = findPair(item, 'name');
      if (name && isScalar(name.value) && typeof name.value.value === 'string') names.add(name.value.value);
    }
  }
  return names;
}

function snippetFor(target: SpecInsertTarget, root: YAMLMap): Snippet | null {
  switch (target.kind) {
    case 'server':
      return serverSnippet();
    case 'tag':
      return tagSnippet(existingTagNames(root));
    case 'path':
      return pathSnippet(existingLeafKeys(root, ['paths']));
    case 'schema':
      return schemaSnippet(existingLeafKeys(root, ['components', 'schemas']));
    case 'securityScheme':
      return securitySchemeSnippet(existingLeafKeys(root, ['components', 'securitySchemes']));
    case 'securityRequirement':
      return securityRequirementSnippet(root);
    case 'operation': {
      const paths = findPair(root, 'paths');
      const pathPair = paths && isMap(paths.value) ? findPair(paths.value, target.pathKey) : null;
      if (!pathPair) return null;
      const taken = isMap(pathPair.value) ? mapKeys(pathPair.value) : new Set<string>();
      const verb = OPERATION_VERBS.find((candidate) => !taken.has(candidate));
      return verb === undefined ? null : operationSnippet(verb);
    }
  }
}

function spotFor(content: string, root: YAMLMap, target: SpecInsertTarget): Spot | null {
  if (target.kind === 'operation') {
    return sectionSpot(content, root, ['paths', target.pathKey], false);
  }
  const section = SECTION_OF[target.kind];
  return sectionSpot(content, root, section.path, section.seq);
}

export function planSpecInsertion(content: string, target: SpecInsertTarget): SpecInsertion | null {
  const doc = parseDocument(content);
  if (doc.errors.length > 0 || !isMap(doc.contents)) return null;
  const root = doc.contents;

  const snippet = snippetFor(target, root);
  const spot = spotFor(content, root, target);
  if (!snippet || !spot) return null;

  const body = snippet.lines.map((line, i) => (i === 0 ? `${spot.firstPrefix}${line}` : `${spot.restIndent}${line}`));
  let text = `${[...spot.wrapperLines, ...body].join('\n')}\n`;
  // Splicing mid-document always lands at a line start (nodeEnd /
  // after-key-newline); only a tail append can meet a missing final
  // newline.
  if (spot.insertAt > 0 && content[spot.insertAt - 1] !== '\n') text = `\n${text}`;

  const tokenIndex = text.indexOf(snippet.token);
  return {
    offset: spot.insertAt,
    text,
    selectionStart: spot.insertAt + tokenIndex,
    selectionEnd: spot.insertAt + tokenIndex + snippet.token.length,
  };
}
