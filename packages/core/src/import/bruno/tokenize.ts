// ── Bru block tokenizer ────────────────────────────────────────────
//
// A `.bru` file is a flat sequence of named blocks:
//
//   name {              dictionary block — `key: value` lines,
//     key: value          `~key: value` marks a disabled row
//     ~off: value
//   }
//
//   body:json {         raw-text block — content kept verbatim
//     { "a": 1 }          (dedented); closes at the first `}` line
//   }                     at column 0
//
//   vars:secret [       list block — one bare item per line
//     token
//   ]
//
// The tokenizer is deliberately tolerant: unknown block names still
// tokenize (callers decide whether to drop them with a report entry),
// and a raw-text block that never closes swallows the rest of the
// file rather than throwing — the parser is report-driven, not
// validation-driven.

export interface BruEntry {
  key: string;
  value: string;
  disabled: boolean;
}

export interface BruBlock {
  /** Full block name verbatim, e.g. `body:json`, `auth:bearer`, `get`. */
  name: string;
  kind: 'dict' | 'text' | 'list';
  /** Dictionary rows (dict blocks only). */
  entries: BruEntry[];
  /** Bare items (list blocks only). */
  items: string[];
  /** Dedented raw content (text blocks only). */
  text: string;
  /** Dict-block lines that weren't `key: value` shaped — for aggregate report entries. */
  stray: string[];
}

/**
 * Block names whose braces wrap raw text (bodies, scripts, docs) —
 * everything else parses as a dictionary. Matching is by prefix for
 * the qualified families (`body:graphql:vars`, `script:pre-request`).
 */
const TEXT_BLOCK_PREFIXES = ['body', 'script', 'tests', 'docs'];

function isTextBlock(name: string): boolean {
  // Dictionary-shaped members of the body family.
  if (name === 'body:form-urlencoded' || name === 'body:multipart-form' || name === 'body:file') return false;
  const head = name.split(':')[0] ?? name;
  return TEXT_BLOCK_PREFIXES.includes(head);
}

const BLOCK_OPEN = /^([\w.:-]+)\s*(\{|\[)\s*$/;
const DICT_LINE = /^(~?)([^:]+):\s?(.*)$/;

export function tokenizeBru(content: string): BruBlock[] {
  const lines = content.split(/\r?\n/);
  const blocks: BruBlock[] = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i] ?? '';
    const open = BLOCK_OPEN.exec(line.trim());
    if (!open || line.trim() !== line.trimStart()) {
      // Not a block opener (or indented — block headers sit at column
      // 0 in emitted files; indented matches would be body content).
      i++;
      continue;
    }
    const name = open[1] ?? '';
    if (open[2] === '[') {
      const { items, next } = readList(lines, i + 1);
      blocks.push({ name, kind: 'list', entries: [], items, text: '', stray: [] });
      i = next;
      continue;
    }
    if (isTextBlock(name)) {
      const { text, next } = readText(lines, i + 1);
      blocks.push({ name, kind: 'text', entries: [], items: [], text, stray: [] });
      i = next;
      continue;
    }
    const { entries, stray, next } = readDict(lines, i + 1);
    blocks.push({ name, kind: 'dict', entries, items: [], text: '', stray });
    i = next;
  }
  return blocks;
}

function readList(lines: string[], start: number): { items: string[]; next: number } {
  const items: string[] = [];
  for (let i = start; i < lines.length; i++) {
    const trimmed = (lines[i] ?? '').trim();
    if (trimmed === ']') return { items, next: i + 1 };
    if (trimmed.length === 0) continue;
    items.push(trimmed.replace(/,$/, ''));
  }
  return { items, next: lines.length };
}

function readDict(lines: string[], start: number): { entries: BruEntry[]; stray: string[]; next: number } {
  const entries: BruEntry[] = [];
  const stray: string[] = [];
  for (let i = start; i < lines.length; i++) {
    const trimmed = (lines[i] ?? '').trim();
    if (trimmed === '}') return { entries, stray, next: i + 1 };
    if (trimmed.length === 0) continue;
    const m = DICT_LINE.exec(trimmed);
    if (!m) {
      stray.push(trimmed);
      continue;
    }
    entries.push({ key: (m[2] ?? '').trim(), value: m[3] ?? '', disabled: m[1] === '~' });
  }
  return { entries, stray, next: lines.length };
}

/**
 * Raw text runs until the closing `}` at column 0 — emitted files
 * indent the content, so an inner `}` (a JSON body's last brace, a
 * script's closing block) never sits unindented.
 */
function readText(lines: string[], start: number): { text: string; next: number } {
  const collected: string[] = [];
  let next = lines.length;
  for (let i = start; i < lines.length; i++) {
    const line = lines[i] ?? '';
    if (/^\}\s*$/.test(line)) {
      next = i + 1;
      break;
    }
    collected.push(line);
  }
  return { text: dedent(collected), next };
}

function dedent(lines: string[]): string {
  let minIndent = Number.POSITIVE_INFINITY;
  for (const line of lines) {
    if (line.trim().length === 0) continue;
    const indent = line.length - line.trimStart().length;
    if (indent < minIndent) minIndent = indent;
  }
  if (!Number.isFinite(minIndent) || minIndent === 0) return lines.join('\n').trim();
  return lines
    .map((l) => l.slice(minIndent))
    .join('\n')
    .trim();
}
