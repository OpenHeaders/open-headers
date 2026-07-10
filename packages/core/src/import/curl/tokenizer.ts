// ── Tokenizer ───────────────────────────────────────────────────────
//
// Purpose-built for curl command lines pasted from DevTools / docs:
// POSIX sh quoting rules (single-quotes literal, double-quotes with
// backslash escapes), `$'...'` ANSI-C quoting treated as `'...'`,
// backslash-newline line continuation. Keep this narrow — we don't
// support shell variable expansion, command substitution, or
// anything else that would require a real parser.

const WHITESPACE = /\s/;

export function tokenize(input: string): string[] {
  // Collapse line continuations first so the main scanner doesn't
  // have to track them. curl pastes break across lines with `\` at
  // EOL (sh), a backtick (PowerShell), or `^` (cmd.exe).
  const normalized = input
    .replace(/\\\r?\n/g, ' ')
    .replace(/`\r?\n/g, ' ')
    .replace(/\^\r?\n/g, ' ')
    .replace(/\r\n/g, '\n');
  const tokens: string[] = [];
  let i = 0;
  while (i < normalized.length) {
    const ch = normalized[i];
    if (WHITESPACE.test(ch)) {
      i += 1;
      continue;
    }
    const [token, next] = readToken(normalized, i);
    tokens.push(token);
    i = next;
  }
  return tokens;
}

function readToken(src: string, start: number): [string, number] {
  let i = start;
  let out = '';
  while (i < src.length) {
    const ch = src[i];
    if (WHITESPACE.test(ch)) break;
    if (ch === '\\' && i + 1 < src.length) {
      // Backslash escape outside quotes — take next char literally.
      out += src[i + 1];
      i += 2;
      continue;
    }
    if (ch === '$' && src[i + 1] === "'") {
      // $'...' ANSI-C quoting — treat the inside as a literal (no
      // ANSI escapes). Sufficient for common curl pastes.
      const [inside, after] = readSingleQuoted(src, i + 2);
      out += inside;
      i = after;
      continue;
    }
    if (ch === "'") {
      const [inside, after] = readSingleQuoted(src, i + 1);
      out += inside;
      i = after;
      continue;
    }
    if (ch === '"') {
      const [inside, after] = readDoubleQuoted(src, i + 1);
      out += inside;
      i = after;
      continue;
    }
    out += ch;
    i += 1;
  }
  return [out, i];
}

function readSingleQuoted(src: string, start: number): [string, number] {
  let i = start;
  let out = '';
  while (i < src.length) {
    const ch = src[i];
    if (ch === "'") return [out, i + 1];
    out += ch;
    i += 1;
  }
  // Unterminated quote: accept what we have rather than throwing —
  // shell pastes sometimes arrive truncated.
  return [out, i];
}

function readDoubleQuoted(src: string, start: number): [string, number] {
  let i = start;
  let out = '';
  while (i < src.length) {
    const ch = src[i];
    if (ch === '"') return [out, i + 1];
    if (ch === '\\' && i + 1 < src.length) {
      const next = src[i + 1];
      // Only a handful of shell-standard escapes are honored inside
      // double quotes; everything else preserves the backslash.
      if (next === '"' || next === '\\' || next === '$' || next === '`') {
        out += next;
        i += 2;
        continue;
      }
      if (next === 'n') {
        out += '\n';
        i += 2;
        continue;
      }
      if (next === 't') {
        out += '\t';
        i += 2;
        continue;
      }
      out += ch;
      i += 1;
      continue;
    }
    out += ch;
    i += 1;
  }
  return [out, i];
}
