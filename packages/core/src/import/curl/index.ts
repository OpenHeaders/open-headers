/**
 * curl import — parse a `curl` command-line string into a Request
 * + an ImportReport describing drops / transforms.
 *
 * Scope (v1, ARCHITECTURE.md §23):
 *   • Method: `-X` / `--request`; POST inferred when `-d`/`--data*`
 *     is present without an explicit method.
 *   • URL: first non-flag positional arg, or `--url`. Query-string is
 *     extracted into `params`.
 *   • Headers: `-H` / `--header` (repeatable).
 *   • Body: `-d` / `--data` / `--data-raw` / `--data-binary` /
 *     `--data-urlencode` / `--data-ascii` (first wins; repeated
 *     entries join with `&`). Content-Type header governs body.type
 *     (json / text).
 *   • Basic auth: `-u user:pass`. Bearer via
 *     `Authorization: Bearer <x>` header is promoted to `auth.type`.
 *   • Noop / tolerated: `--compressed`, `-i`, `--include`, `-v`,
 *     `--verbose`, `-s`, `--silent`, `-L`, `--location`.
 *
 * Dropped (with report entry):
 *   • `--form` / `-F` (multipart) — tracked; v2 once file-blob
 *     storage lands (§6).
 *   • `--cookie` / `-b`, `--cookie-jar` / `-c` — cookie policy is
 *     per-workspace (§14), not per-request.
 *   • `--output` / `-o`, `--upload-file` / `-T`, `--cert`, `--key`,
 *     `-E` — out of scope for an extension-context fetch.
 *   • `--insecure` / `-k` — the browser does not expose a TLS bypass.
 *
 * The tokenizer is POSIX-sh aware: single quotes preserve everything
 * literally; double quotes allow backslash escapes; `$'...'` (bash
 * ANSI-C) is collapsed to `'...'` literal semantics; bare backslash
 * at end-of-line joins lines (common in multi-line curl pastes).
 */

export { parseCurl } from './parse';
export { tokenize } from './tokenizer';
export { CurlParseError, type CurlParseResult, type CurlRequest, type ImportedRequestSettings } from './types';
