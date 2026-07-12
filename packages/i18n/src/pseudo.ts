/**
 * Pseudo-locale — accented, expanded English generated from the source
 * catalog at runtime. The QA workhorse: an unextracted string shows up
 * as plain English amid accented text, and the ~35% expansion plus
 * ⟦…⟧ delimiters expose truncation and string concatenation without
 * spending a cent on translation.
 *
 * `{name}` placeholders survive the transform untouched so interpolated
 * values (counts, entity names) render as real data. Function messages
 * are wrapped: their args pass through verbatim and only the returned
 * text is pseudoized.
 */

import type { Catalog, Message, MessageFn } from './types';

const ACCENTS: Readonly<Record<string, string>> = {
  a: 'á',
  b: 'ƀ',
  c: 'ç',
  d: 'ð',
  e: 'é',
  f: 'ƒ',
  g: 'ĝ',
  h: 'ĥ',
  i: 'î',
  j: 'ĵ',
  k: 'ķ',
  l: 'ĺ',
  m: 'ɱ',
  n: 'ñ',
  o: 'ö',
  p: 'þ',
  q: 'ᶐ',
  r: 'ŕ',
  s: 'š',
  t: 'ţ',
  u: 'û',
  v: 'ṽ',
  w: 'ŵ',
  x: 'ẋ',
  y: 'ý',
  z: 'ž',
  A: 'Á',
  B: 'Ɓ',
  C: 'Ç',
  D: 'Ð',
  E: 'É',
  F: 'Ƒ',
  G: 'Ĝ',
  H: 'Ĥ',
  I: 'Î',
  J: 'Ĵ',
  K: 'Ķ',
  L: 'Ĺ',
  M: 'Ṁ',
  N: 'Ñ',
  O: 'Ö',
  P: 'Þ',
  Q: 'Ǫ',
  R: 'Ŕ',
  S: 'Š',
  T: 'Ţ',
  U: 'Û',
  V: 'Ṽ',
  W: 'Ŵ',
  X: 'Ẍ',
  Y: 'Ý',
  Z: 'Ž',
};

const EXPANSION_RATIO = 0.35;
const PLACEHOLDER_SPLIT = /(\{\w+\})/;

function accent(text: string): string {
  let out = '';
  for (const ch of text) out += ACCENTS[ch] ?? ch;
  return out;
}

/** Accent + expand one template, leaving `{name}` placeholders intact. */
export function pseudoizeString(template: string): string {
  const accented = template
    .split(PLACEHOLDER_SPLIT)
    .map((part) => (PLACEHOLDER_SPLIT.test(part) ? part : accent(part)))
    .join('');
  const padLength = Math.ceil(template.length * EXPANSION_RATIO);
  const pad = '~'.repeat(padLength);
  return `⟦${accented}${pad ? ` ${pad}` : ''}⟧`;
}

function pseudoizeMessage(message: Message): Message {
  if (typeof message === 'function') {
    const wrapped: MessageFn = (args, locale) => pseudoizeString(message(args, locale));
    return wrapped;
  }
  return pseudoizeString(message);
}

/** Derive the full pseudo catalog from the source catalog. */
export function pseudoizeCatalog(source: Catalog): Catalog {
  const out: Record<string, Message> = {};
  for (const [key, message] of Object.entries(source)) {
    out[key] = pseudoizeMessage(message);
  }
  return out;
}
