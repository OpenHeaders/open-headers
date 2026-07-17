/**
 * headerValidationMessage / headerValidationWarning — keyed mirror of
 * core's `headers.ts` validator sentences
 * (`@openheaders/core/utils`). Core keeps minting the English
 * `message`/`reason`/`warning` for the operational plane (SW logs,
 * DNR compiler); UI surfaces render through these helpers so the
 * sentences translate. The mapping consumes only the structured
 * `code` + `params` — never the English text. A result without a
 * code (capability sentences composed elsewhere, pre-structured
 * issues) falls back to its raw message.
 */

import type { HeaderValidationCode, HeaderValidationParams } from '@openheaders/core/utils';
import type { MessageKey } from '@openheaders/i18n';
import type { Translate } from '@openheaders/ui/context/LocaleContext';

/** The append-allowlist sentence embeds a translated direction word,
 *  so it is keyed per direction and resolved from `params.direction`
 *  instead of this table. */
const HEADER_VALIDATION_KEY: Record<Exclude<HeaderValidationCode, 'append-not-allowlisted'>, MessageKey> = {
  'name-empty': 'shared.headerValidation.nameEmpty',
  'name-whitespace-only': 'shared.headerValidation.nameWhitespaceOnly',
  'name-too-long': 'shared.headerValidation.nameTooLong',
  'name-protected': 'shared.headerValidation.nameProtected',
  'name-invalid-characters': 'shared.headerValidation.nameInvalidCharacters',
  'name-templated': 'shared.headerValidation.nameTemplated',
  'name-referrer-spelling': 'shared.headerValidation.nameReferrerSpelling',
  'value-empty': 'shared.headerValidation.valueEmpty',
  'value-whitespace-only': 'shared.headerValidation.valueWhitespaceOnly',
  'value-too-long': 'shared.headerValidation.valueTooLong',
  'value-null-bytes': 'shared.headerValidation.valueNullBytes',
  'value-line-folding': 'shared.headerValidation.valueLineFolding',
  'value-line-breaks': 'shared.headerValidation.valueLineBreaks',
  'value-control-characters': 'shared.headerValidation.valueControlCharacters',
  'value-content-type-format': 'shared.headerValidation.valueContentTypeFormat',
  'value-non-ascii': 'shared.headerValidation.valueNonAscii',
};

function resolveCode(t: Translate, code: HeaderValidationCode, params?: HeaderValidationParams): string {
  if (code === 'append-not-allowlisted') {
    const key: MessageKey =
      params?.direction === 'response'
        ? 'shared.headerValidation.appendNotAllowlisted.response'
        : 'shared.headerValidation.appendNotAllowlisted.request';
    return t(key, { name: params?.name ?? '' });
  }
  const args: Record<string, string | number> = {};
  if (params?.name !== undefined) args.name = params.name;
  if (params?.max !== undefined) args.max = params.max;
  return t(HEADER_VALIDATION_KEY[code], args);
}

/** Any shape core's header plane hands to the UI: validations carry
 *  `message`, capabilities carry `reason` — both carry `code`/`params`
 *  when the sentence originates in `headers.ts`. */
interface HeaderValidationLike {
  code?: HeaderValidationCode;
  params?: HeaderValidationParams;
  message?: string;
  reason?: string;
}

export function headerValidationMessage(t: Translate, v: HeaderValidationLike): string {
  if (v.code) return resolveCode(t, v.code, v.params);
  return v.message ?? v.reason ?? '';
}

interface HeaderWarningLike {
  warningCode?: HeaderValidationCode;
  params?: HeaderValidationParams;
  warning?: string;
}

export function headerValidationWarning(t: Translate, v: HeaderWarningLike): string {
  if (v.warningCode) return resolveCode(t, v.warningCode, v.params);
  return v.warning ?? '';
}
