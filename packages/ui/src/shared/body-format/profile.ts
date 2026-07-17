/**
 * detectBodyProfile — the serialization profile of a captured body.
 *
 * The profile is what "match the wire format" means at save time: a
 * minified origin keeps minified overrides, an already-indented origin
 * keeps its own indent unit (spaces of any width, or tabs), and a
 * trailing newline survives the round-trip. Derived from the raw text
 * on demand — nothing persists it, so no draft or rule schema change.
 */

import { tokenizeJsonish } from './tokenize';

export type BodyProfile =
  | { kind: 'minified'; trailingNewline: boolean }
  | { kind: 'indented'; indent: string; trailingNewline: boolean }
  | { kind: 'unknown' };

export const UNKNOWN_BODY_PROFILE: BodyProfile = { kind: 'unknown' };

/** One depth level's worth of leading whitespace — uniform runs of a
 *  single whitespace char only (mixed tab/space indentation reads as
 *  no reliable unit). */
function uniformIndentUnit(lineIndent: string): string | null {
  if (lineIndent.length === 0) return null;
  const first = lineIndent[0];
  if (first !== ' ' && first !== '\t') return null;
  for (let i = 1; i < lineIndent.length; i++) {
    if (lineIndent[i] !== first) return null;
  }
  return lineIndent;
}

export function detectBodyProfile(text: string): BodyProfile {
  const tokens = tokenizeJsonish(text);
  if (!tokens) return UNKNOWN_BODY_PROFILE;

  const trailingNewline = text.endsWith('\n');
  let depth = 0;
  let sawNewline = false;
  let indent: string | null = null;

  for (let i = 1; i < tokens.length; i++) {
    const prev = tokens[i - 1];
    const tok = tokens[i];
    if (prev.kind === 'punct') {
      if (prev.text === '{' || prev.text === '[') depth++;
      else if (prev.text === '}' || prev.text === ']') depth--;
    }
    if (indent !== null) continue;
    const gap = text.slice(prev.end, tok.start);
    const lastNewline = gap.lastIndexOf('\n');
    if (lastNewline === -1) continue;
    sawNewline = true;
    // The whitespace after the gap's last newline is the next token's
    // line indentation; a closer sits one level shallower than the
    // container's entries. Depth 1 lines carry exactly one unit.
    const isCloser = tok.kind === 'punct' && (tok.text === '}' || tok.text === ']');
    const lineDepth = isCloser ? depth - 1 : depth;
    if (lineDepth !== 1) continue;
    const unit = uniformIndentUnit(gap.slice(lastNewline + 1));
    if (unit !== null) indent = unit;
  }

  if (!sawNewline) return { kind: 'minified', trailingNewline };
  if (indent !== null) return { kind: 'indented', indent, trailingNewline };
  return UNKNOWN_BODY_PROFILE;
}
