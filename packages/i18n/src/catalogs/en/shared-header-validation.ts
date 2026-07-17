/**
 * Header-validation family — the keyed mirror of core's `headers.ts`
 * validator and capability sentences (`validateHeaderName`,
 * `validateHeaderValue`, `getHeaderOperationCapability`). Core keeps
 * minting the English `message`/`reason`/`warning` as the
 * operational-plane fallback (SW logs, DNR compiler); UI surfaces
 * render these keys from the structured `code` + `params` via the
 * shared `headerValidationMessage` / `headerValidationWarning`
 * helpers instead. Values are byte-faithful to core's English —
 * never edit one side without the other.
 *
 * The append-allowlist sentence embeds the traffic direction as a
 * translated word, so it is keyed per direction (whole sentences —
 * no direction vocabulary composed at runtime). The quoted header
 * name rides in as the `{name}` arg; length ceilings as `{max}`.
 */

import type { Catalog } from '../../types';

export const sharedHeaderValidation = {
  'shared.headerValidation.nameEmpty': 'Header name cannot be empty',
  'shared.headerValidation.nameWhitespaceOnly': 'Header name cannot be only whitespace',
  'shared.headerValidation.nameTooLong': 'Header name is too long (max {max} characters)',
  'shared.headerValidation.nameProtected': '"{name}" is a protected header that cannot be modified by extensions',
  'shared.headerValidation.nameInvalidCharacters':
    "Header name contains invalid characters. Only letters, numbers, and -_.~!#$%&'*+^`| are allowed",
  'shared.headerValidation.nameTemplated': 'Header name uses templates — resolved value is validated at request time.',
  'shared.headerValidation.nameReferrerSpelling': 'Note: The correct spelling is "Referer" (single r)',
  'shared.headerValidation.valueEmpty': 'Header value cannot be empty',
  'shared.headerValidation.valueWhitespaceOnly': 'Header value cannot be only whitespace',
  'shared.headerValidation.valueTooLong': 'Header value is too long (max {max} characters)',
  'shared.headerValidation.valueNullBytes': 'Header value cannot contain null bytes',
  'shared.headerValidation.valueLineFolding': 'Header value cannot contain line folding (CRLF followed by space/tab)',
  'shared.headerValidation.valueLineBreaks': 'Header value cannot contain line breaks',
  'shared.headerValidation.valueControlCharacters': 'Header value contains invalid control characters',
  'shared.headerValidation.valueContentTypeFormat': 'Content-Type header has invalid format',
  'shared.headerValidation.valueNonAscii':
    'Header value contains non-ASCII characters that may cause compatibility issues',
  'shared.headerValidation.appendNotAllowlisted.request':
    'Append is only supported on standard multi-value request headers. "{name}" is not in Chrome\'s appendable allowlist — use Override instead, or switch to Merge for a script-based append.',
  'shared.headerValidation.appendNotAllowlisted.response':
    'Append is only supported on standard multi-value response headers. "{name}" is not in Chrome\'s appendable allowlist — use Override instead, or switch to Merge for a script-based append.',
} as const satisfies Catalog;
