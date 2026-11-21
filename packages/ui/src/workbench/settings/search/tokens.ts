/**
 * Tokenization shared by the query parser and the field reader, so a
 * query term and the text it is matched against split the same way.
 */

/** Lowercased words of a text, split on whitespace and the separators labels and keys use. */
export function tokenize(input: string): string[] {
  return input
    .toLowerCase()
    .split(/[\s,.\-_/]+/)
    .filter((token) => token.length > 0);
}

/**
 * Tokens of the rendered and English forms of a text pair, deduplicated
 * so an English default isn't counted twice.
 */
export function bilingualTokens(rendered: string, english: string): string[] {
  if (rendered === english) return tokenize(rendered);
  return Array.from(new Set([...tokenize(rendered), ...tokenize(english)]));
}
