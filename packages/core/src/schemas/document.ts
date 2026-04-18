/**
 * Document brands — nominal wrappers that enforce preserve-unknown writes.
 *
 * Motivation
 * ──────────
 * When two extension versions edit the same workspace, the older client
 * must not strip fields it doesn't understand. Round-tripping YAML through
 * a plain `Request`/`Rule`/`Collection` object would silently lose any
 * unknown keys the newer client added. The fix is to parse into a
 * {@link ParsedDocument} (which carries an opaque "raw" payload of
 * everything the parser saw), edit with a merge helper that produces a
 * {@link WriteableDocument}, and serialize only `WriteableDocument`s.
 *
 * A "reset to defaults" button produces a fresh `WriteableDocument`; a
 * normal save reads a `ParsedDocument` and merges a patch over it. Full
 * replacement of an existing document is a type error — the brand on the
 * two sides is different.
 *
 * Runtime
 * ──────
 * The brands are **phantom types** — zero runtime cost. The actual
 * preserve-unknown logic lives in the codec layer
 * (`@openheaders/core/codec/yaml`), which uses eemeli/yaml's AST to
 * retain unknown keys + comments through round-trip. The brands simply
 * prevent the codec from being called with the wrong input.
 *
 * See docs/V5_FOUNDATION_PLAN.md §Phase 0 #4.
 */

declare const PARSED_DOCUMENT_BRAND: unique symbol;
declare const WRITEABLE_DOCUMENT_BRAND: unique symbol;

/**
 * A document the codec parsed from disk (or chrome.storage). Carries the
 * structured payload plus an opaque snapshot of everything the parser
 * saw — including keys the current version doesn't recognize. Read-only
 * from the caller's perspective; pass through {@link mergePatch} to
 * produce a writeable version.
 */
export interface ParsedDocument<T> {
  readonly value: T;
  /** Opaque parser output preserving unknown keys + comments. */
  readonly raw: unknown;
  readonly [PARSED_DOCUMENT_BRAND]: true;
}

/**
 * A document the codec is allowed to serialize. Only the two factory
 * paths below can produce one:
 *   - {@link mergePatch} — take a ParsedDocument + a patch, produce a
 *     Writeable that still carries the raw payload (preserve-unknown).
 *   - {@link freshDocument} — explicit "start over" path used by reset /
 *     import / create flows; no raw payload to preserve.
 */
export interface WriteableDocument<T> {
  readonly value: T;
  /** Present when this write is a merge over a parsed document; absent for fresh writes. */
  readonly raw?: unknown;
  readonly [WRITEABLE_DOCUMENT_BRAND]: true;
}

/** Type constructor — used only by the codec when it finishes parsing. */
export function makeParsed<T>(value: T, raw: unknown): ParsedDocument<T> {
  return { value, raw, [PARSED_DOCUMENT_BRAND]: true } as ParsedDocument<T>;
}

/**
 * Produce a writeable document that preserves the parsed snapshot's
 * unknown keys. Pass a callback that mutates the in-memory value; the
 * codec will project changes onto the raw AST at serialize time.
 *
 * The callback receives a *draft* of `parsed.value` to mutate. Do not
 * replace the reference — mutate in place. (A "reset to defaults" flow
 * should use {@link freshDocument} instead; that's a different write.)
 */
export function mergePatch<T>(parsed: ParsedDocument<T>, patch: (draft: T) => void): WriteableDocument<T> {
  const draft = structuredClone(parsed.value) as T;
  patch(draft);
  return { value: draft, raw: parsed.raw, [WRITEABLE_DOCUMENT_BRAND]: true } as WriteableDocument<T>;
}

/**
 * Produce a writeable document with no prior-raw payload — equivalent to
 * "write this from scratch; any existing unknown keys on disk should be
 * discarded." Use only for explicit reset / new-file / import flows.
 */
export function freshDocument<T>(value: T): WriteableDocument<T> {
  return { value, [WRITEABLE_DOCUMENT_BRAND]: true } as WriteableDocument<T>;
}
