/**
 * Shared text-matching core for the panel's filter inputs. Every
 * filter surface (Network, Console, Storage, Headers, Cookies,
 * Initiator, Streams, Call Stack, …) offers the same three toggles —
 * Match Case (Aa), Whole Word (ab), Regex (.*) — and routes its
 * free-text matching through here so the toggles mean the same thing
 * everywhere.
 *
 * Grammar surfaces keep their own token parsers (property keys like
 * `name:` / `is:` / `larger-than:` are per-surface); only the text
 * comparison itself is shared. In regex mode the whole input is one
 * pattern — property tokens are not parsed.
 */

export interface TextMatchConfig {
  matchCase: boolean;
  wholeWord: boolean;
  regexMode: boolean;
}

export const DEFAULT_TEXT_MATCH_CONFIG: TextMatchConfig = {
  matchCase: false,
  wholeWord: false,
  regexMode: false,
};

function escapeForRegex(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export type TextMatcher = (haystack: string) => boolean;

/**
 * Precompiled needle matcher — build once per parsed token, call per
 * row. Whole-word mode compiles its boundary regex here, at parse
 * time, so the per-row hot path never constructs a RegExp.
 */
export function buildNeedleMatcher(needle: string, config: TextMatchConfig): TextMatcher {
  if (config.wholeWord) {
    const re = new RegExp(`\\b${escapeForRegex(needle)}\\b`, config.matchCase ? '' : 'i');
    return (haystack) => re.test(haystack);
  }
  if (config.matchCase) {
    return (haystack) => haystack.includes(needle);
  }
  const lowered = needle.toLowerCase();
  return (haystack) => haystack.toLowerCase().includes(lowered);
}

/** One-off substring match honoring Match Case + Whole Word. Prefer
 *  `buildNeedleMatcher` anywhere the same needle tests many rows. */
export function textMatches(haystack: string, needle: string, config: TextMatchConfig): boolean {
  return buildNeedleMatcher(needle, config)(haystack);
}

export interface CompiledRegexQuery {
  /** Null when the pattern failed to parse. */
  pattern: RegExp | null;
  error: boolean;
}

/** Compile the whole input as one regex (regex-mode semantics). */
export function compileRegexQuery(input: string, config: TextMatchConfig): CompiledRegexQuery {
  try {
    return { pattern: new RegExp(input, config.matchCase ? '' : 'i'), error: false };
  } catch {
    return { pattern: null, error: true };
  }
}

/**
 * One-stop predicate for plain-text filter surfaces (Console, Storage,
 * Call Stack, header lists). The empty input matches everything; a
 * broken regex also matches everything — the input turns red via
 * `error` instead of silently hiding every row.
 */
export interface TextPredicate {
  test: (haystack: string) => boolean;
  error: boolean;
  empty: boolean;
}

const MATCH_ALL: TextPredicate = { test: () => true, error: false, empty: true };

export function buildTextPredicate(input: string, config: TextMatchConfig): TextPredicate {
  const needle = input.trim();
  if (!needle) return MATCH_ALL;

  if (config.regexMode) {
    const { pattern, error } = compileRegexQuery(needle, config);
    if (!pattern) return { test: () => true, error, empty: false };
    return { test: (haystack) => pattern.test(haystack), error: false, empty: false };
  }

  return { test: buildNeedleMatcher(needle, config), error: false, empty: false };
}
