import { createReport } from '../report';
import { finalize } from './finalize';
import { consumeToken } from './flags';
import type { ParserState } from './state';
import { tokenize } from './tokenizer';
import { CurlParseError, type CurlParseResult } from './types';

// ── Entry point ─────────────────────────────────────────────────────

export function parseCurl(input: string): CurlParseResult {
  const report = createReport('curl');
  const tokens = tokenize(input);
  if (tokens.length === 0) {
    throw new CurlParseError('empty input — nothing to parse');
  }

  // Accept either a bare curl command or a raw command string. Shell
  // pastes often wrap the command in a trailing newline / whitespace.
  let cursor = 0;
  if (tokens[0] === 'curl' || tokens[0]?.startsWith('curl')) {
    // "curl" literal, or something like "curl.exe" — just skip one token.
    cursor = 1;
  }

  const state: ParserState = {
    method: null,
    url: null,
    headers: [],
    dataParts: [],
    dataKind: null,
    auth: null,
    multipartParts: [],
  };

  while (cursor < tokens.length) {
    const token = tokens[cursor];
    cursor = consumeToken(token, tokens, cursor, state, report);
  }

  return { request: finalize(state, report), report };
}
