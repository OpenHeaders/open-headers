/**
 * Words and the match rule — shared by the query parser, the field
 * reader, the scorer and the highlighter, so a query term, the text it
 * is matched against and the stretch painted on screen all agree.
 *
 * A text is cut twice. First on whitespace and the separators labels
 * and keys use, so `editor.fontSize` and `to_file` come apart. Then
 * each piece by the platform's word segmentation, which drops the
 * punctuation around a word (`(auth?)` is the word `auth`) and finds
 * the words of a script written without spaces.
 */

/** A run of characters between whitespace and the separators labels and keys use. */
const PIECE = /[^\s,.\-_/]+/g;

/** A piece with the punctuation around it dropped — the cut a host without word segmentation makes. */
const PIECE_CORE = /[\p{L}\p{N}](?:.*[\p{L}\p{N}])?/u;

const segmenter = typeof Intl.Segmenter === 'function' ? new Intl.Segmenter(undefined, { granularity: 'word' }) : null;

export interface Word {
  /** The word as written. */
  text: string;
  /** Its offset in the source text. */
  start: number;
}

function wordsOfPiece(piece: string, start: number): Word[] {
  const words: Word[] = [];
  if (segmenter) {
    for (const part of segmenter.segment(piece)) {
      if (part.isWordLike) words.push({ text: part.segment, start: start + part.index });
    }
  } else {
    const core = PIECE_CORE.exec(piece);
    if (core) words.push({ text: core[0], start: start + core.index });
  }
  // A piece with no word in it (a lone `+`) stands as itself, so a
  // query made of one still names something to match.
  return words.length > 0 ? words : [{ text: piece, start }];
}

/** The words of a text, in order, each with its place in the text. */
export function splitWords(input: string): Word[] {
  const words: Word[] = [];
  for (const piece of input.matchAll(PIECE)) words.push(...wordsOfPiece(piece[0], piece.index));
  return words;
}

/** Lowercased words of a text. */
export function tokenize(input: string): string[] {
  return splitWords(input).map((word) => word.text.toLowerCase());
}

/**
 * Tokens of the rendered and English forms of a text pair, deduplicated
 * so an English default isn't counted twice.
 */
export function bilingualTokens(rendered: string, english: string): string[] {
  if (rendered === english) return tokenize(rendered);
  return Array.from(new Set([...tokenize(rendered), ...tokenize(english)]));
}

/**
 * The match rule: a term matches a word it STARTS. A term found only
 * inside a word ("port" in "support") is a different word, not a hit.
 * Both sides are lowercased tokens.
 */
export function termMatchesToken(token: string, term: string): boolean {
  return token.startsWith(term);
}
