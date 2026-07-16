/**
 * Server-Sent Events (text/event-stream) — the event-wise format plane:
 * detection, a block parser feeding the event list / JSONPath filter
 * (plus the incremental splitter the live phase rides), and an
 * event-wise Pretty. Pure display over ANY snapshot (streamed or
 * saved) — capture bytes are never touched; Raw stays the wire text
 * verbatim.
 *
 * Parsing follows the wire grammar (blank-line-delimited blocks; a
 * field is `name: value` with one leading space stripped, a line
 * without a colon is a field with an empty value, `data:` lines join
 * with `\n`, a leading `:` marks a comment) but records what is ON THE
 * WIRE rather than what an EventSource would dispatch: comment-only
 * heartbeat blocks and a trailing block the capture cut before its
 * blank line still mint records — this is a debug view. Unknown field
 * names stay visible under their own key (the spec ignores them; a
 * debugger must not). JSON-bearing `data:` payloads parse losslessly —
 * int64 tokens display verbatim and duplicate keys report, exactly the
 * ndjson line-wise laws.
 */

import { parseLosslessJson, stringifyLossless } from './lossless-json';
import { contentTypeOf } from './response-format';

/** True for Server-Sent Events bodies — the event-wise view's gate.
 *  Content-Type picks the RENDERER only; the body stays TEXT and the
 *  picker law is untouched. */
export function isSseResponse(headers: ReadonlyArray<{ key: string; value: string }>): boolean {
  return contentTypeOf(headers).includes('text/event-stream');
}

/** One wire event block as a display record — only the keys the block
 *  carried are present. `data` is the joined payload: the lossless
 *  parse result when it parses as JSON, the verbatim string otherwise. */
export type SseEventRecord = Record<string, unknown>;

export interface SseParseOutcome {
  value: SseEventRecord[];
  /** Duplicate object keys reported by the JSON-bearing `data:`
   *  payloads, deduplicated across events — the body pane's notice. */
  duplicateKeys: string[];
}

/** One wire event block for the event-list surface: the display record
 *  plus the block's own wire lines (joined `\n` — line endings
 *  normalize in the join; the wire body itself is never touched). The
 *  raw text is the mini viewer's verbatim fallback and the event
 *  search's haystack. */
export interface SseEventItem {
  record: SseEventRecord;
  raw: string;
}

export interface SseParseItemsOutcome {
  items: SseEventItem[];
  duplicateKeys: string[];
}

/** Accumulated state of one event block between blank lines. */
interface SseBlock {
  event?: string;
  id?: string;
  retry?: string;
  dataParts: string[] | null;
  /** Unknown field name → values in arrival order (joined `\n`). */
  unknown: Array<[string, string[]]>;
  comments: string[];
  /** The block's wire lines verbatim, in arrival order. */
  rawLines: string[];
}

const emptyBlock = (): SseBlock => ({ dataParts: null, unknown: [], comments: [], rawLines: [] });

const blockHasContent = (block: SseBlock): boolean =>
  block.event !== undefined ||
  block.id !== undefined ||
  block.retry !== undefined ||
  block.dataParts !== null ||
  block.unknown.length > 0 ||
  block.comments.length > 0;

/** Field value: everything after the first colon, one leading space
 *  stripped (the wire grammar); comments strip the same way. */
const fieldValue = (raw: string): string => (raw.startsWith(' ') ? raw.slice(1) : raw);

function recordFromBlock(block: SseBlock, duplicateKeys: string[]): SseEventRecord {
  const entries: Array<[string, unknown]> = [];
  if (block.event !== undefined) entries.push(['event', block.event]);
  if (block.dataParts !== null) {
    const joined = block.dataParts.join('\n');
    const parsed = parseLosslessJson(joined);
    if (parsed === null) {
      entries.push(['data', joined]);
    } else {
      entries.push(['data', parsed.value]);
      for (const key of parsed.duplicateKeys) {
        if (!duplicateKeys.includes(key)) duplicateKeys.push(key);
      }
    }
  }
  if (block.id !== undefined) entries.push(['id', block.id]);
  if (block.retry !== undefined) {
    const numeric = /^\d+$/.test(block.retry) ? Number(block.retry) : null;
    entries.push(['retry', numeric !== null && Number.isSafeInteger(numeric) ? numeric : block.retry]);
  }
  for (const [name, values] of block.unknown) entries.push([name, values.join('\n')]);
  if (block.comments.length > 0) entries.push(['comment', block.comments.join('\n')]);
  // fromEntries defines own properties — a wire field named __proto__
  // cannot poison the record object.
  return Object.fromEntries(entries);
}

/** Wire line split — the SSE grammar accepts \r\n, \r, and \n; a
 *  leading BOM strips. */
function sseLines(body: string): string[] {
  return (body.charCodeAt(0) === 0xfeff ? body.slice(1) : body).split(/\r\n|\r|\n/);
}

/**
 * Parse an event-stream body into event items, one per wire block —
 * the display record plus the block's raw wire text (the event list's
 * feed). `null` when the body yields no blocks at all (nothing to
 * preview — the text views stand). One linear pass; callers memoize
 * per body.
 */
export function parseSseEventItems(body: string): SseParseItemsOutcome | null {
  const items: SseEventItem[] = [];
  const duplicateKeys: string[] = [];
  let block = emptyBlock();
  const flush = () => {
    if (blockHasContent(block)) {
      items.push({ record: recordFromBlock(block, duplicateKeys), raw: block.rawLines.join('\n') });
    }
    block = emptyBlock();
  };
  for (const line of sseLines(body)) {
    if (line === '') {
      flush();
      continue;
    }
    block.rawLines.push(line);
    if (line.startsWith(':')) {
      block.comments.push(fieldValue(line.slice(1)));
      continue;
    }
    const colon = line.indexOf(':');
    const name = colon === -1 ? line : line.slice(0, colon);
    const value = colon === -1 ? '' : fieldValue(line.slice(colon + 1));
    if (name === 'data') {
      if (block.dataParts === null) block.dataParts = [];
      block.dataParts.push(value);
    } else if (name === 'event') {
      block.event = value;
    } else if (name === 'id') {
      block.id = value;
    } else if (name === 'retry') {
      block.retry = value;
    } else {
      const existing = block.unknown.find(([n]) => n === name);
      if (existing) existing[1].push(value);
      else block.unknown.push([name, [value]]);
    }
  }
  // A capture cut before the block's blank line (a stopped stream)
  // still shows what arrived.
  flush();
  return items.length === 0 ? null : { items, duplicateKeys };
}

/**
 * Parse an event-stream body into display records, one per wire block —
 * the tree preview / JSONPath filter shape, derived from the item
 * parse. `null` when the body yields no blocks at all.
 */
export function parseSseEvents(body: string): SseParseOutcome | null {
  const outcome = parseSseEventItems(body);
  if (outcome === null) return null;
  return { value: outcome.items.map((item) => item.record), duplicateKeys: outcome.duplicateKeys };
}

/**
 * Split a live capture buffer at its LAST complete block boundary (the
 * end of a blank line) — the incremental feed for the live event list:
 * `complete` parses now (whole blocks only), `rest` carries into the
 * next flush. Splitting only at boundaries keeps the incremental parse
 * byte-identical to a whole-body parse of the materialized snapshot,
 * so the positional timestamp join holds. Total work over a stream's
 * life stays linear — each byte is scanned here once per flush window
 * it sits in the carry, and parsed exactly once.
 */
export function sliceCompleteSseBlocks(buffer: string): { complete: string; rest: string } {
  // Hold back a trailing '\r': the next chunk may open with '\n',
  // completing a CRLF pair that must not be split into two terminators.
  const scan = buffer.endsWith('\r') ? buffer.slice(0, -1) : buffer;
  let lineStart = 0;
  let cut = 0;
  const terminator = /\r\n|\r|\n/g;
  let match = terminator.exec(scan);
  while (match !== null) {
    // A terminator right where the line started = an empty line = a
    // block boundary; the split point is just past it.
    if (match.index === lineStart) cut = terminator.lastIndex;
    lineStart = terminator.lastIndex;
    match = terminator.exec(scan);
  }
  return { complete: buffer.slice(0, cut), rest: buffer.slice(cut) };
}

/** One block's lines as Pretty walks them — data lines keep both their
 *  original text (verbatim fallback) and their field value (the join). */
interface PrettyBlock {
  /** `null` marks a data line's position; text lines print verbatim. */
  lines: Array<string | null>;
  dataOriginals: string[];
  dataValues: string[];
}

const emptyPrettyBlock = (): PrettyBlock => ({ lines: [], dataOriginals: [], dataValues: [] });

/**
 * Event-wise Pretty: field and comment lines stay verbatim, and a
 * JSON-bearing `data:` payload re-prints as re-indented JSON with every
 * line `data: `-prefixed — still valid SSE framing that joins back to
 * the identical payload, so the pretty text round-trips to the same
 * events. Blocks separate with exactly one blank line. Display-only,
 * like the ndjson line-wise Pretty it mirrors.
 */
export function prettySseBody(body: string): string {
  const blocks: string[] = [];
  let current = emptyPrettyBlock();
  const flush = () => {
    if (current.lines.length === 0) {
      current = emptyPrettyBlock();
      return;
    }
    const parsed = current.dataValues.length > 0 ? parseLosslessJson(current.dataValues.join('\n')) : null;
    const prettyData =
      parsed === null
        ? null
        : stringifyLossless(parsed.value)
            .split('\n')
            .map((l) => `data: ${l}`);
    let dataIndex = 0;
    const out: string[] = [];
    for (const line of current.lines) {
      if (line !== null) {
        out.push(line);
      } else if (prettyData === null) {
        // Non-JSON payloads keep every data line verbatim in place.
        out.push(current.dataOriginals[dataIndex]);
        dataIndex++;
      } else if (dataIndex === 0) {
        // A re-indented JSON payload prints once, where the block's
        // first data line sat; the rest of its lines fold into it.
        out.push(...prettyData);
        dataIndex++;
      } else {
        dataIndex++;
      }
    }
    blocks.push(out.join('\n'));
    current = emptyPrettyBlock();
  };
  for (const line of sseLines(body)) {
    if (line === '') {
      flush();
      continue;
    }
    const colon = line.startsWith(':') ? -2 : line.indexOf(':');
    const name = colon >= 0 ? line.slice(0, colon) : colon === -1 ? line : null;
    if (name === 'data') {
      current.lines.push(null);
      current.dataOriginals.push(line);
      current.dataValues.push(colon >= 0 ? fieldValue(line.slice(colon + 1)) : '');
    } else {
      current.lines.push(line);
    }
  }
  flush();
  return blocks.length === 0 ? body : `${blocks.join('\n\n')}\n`;
}
