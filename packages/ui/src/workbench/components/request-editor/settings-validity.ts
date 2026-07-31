/**
 * Save-gate validity for the Settings tab's free-text knobs — the same
 * predicates the tab's inline error rows render against, folded into
 * one pure check the save path consults. A draft carrying a value the
 * schema would reject must never reach the wire: Save refuses and the
 * editor stays dirty, so the invalid experiment remains an unsaved
 * draft instead of silently persisting (or silently dropping).
 */

import {
  isValidProxyUrl,
  isValidUnixSocketPath,
  RESOLVE_TO_ADDRESS_PATTERN,
  TLS_CIPHER_SUITES_PATTERN,
} from '@openheaders/core/schemas';
import type { MessageKey } from '@openheaders/i18n';
import type { Draft } from './draft';

export type InvalidRequestSetting = 'resolveToAddress' | 'tlsCipherSuites' | 'proxyUrl' | 'unixSocketPath';

/** Row-label key per invalid setting — the save-refusal toast names
 *  the field with the same label its Settings row carries. */
export const INVALID_SETTING_LABEL_KEY: Record<InvalidRequestSetting, MessageKey> = {
  resolveToAddress: 'workbench.editors.request.settings.resolveToAddress',
  tlsCipherSuites: 'workbench.editors.request.settings.tlsCipherSuites',
  proxyUrl: 'workbench.editors.request.settings.proxyUrl',
  unixSocketPath: 'workbench.editors.request.settings.unixSocket',
};

/** First settings field whose current draft value the schema would
 *  reject — `null` when every set field is well-formed. Mirrors the
 *  SettingsTab error rows: Custom-URL proxy mode with no URL counts
 *  as invalid (the row flags the missing URL in place). */
export function firstInvalidRequestSetting(
  draft: Pick<Draft, 'resolveToAddress' | 'tlsCipherSuites' | 'proxyMode' | 'proxyUrl' | 'unixSocketPath'>,
): InvalidRequestSetting | null {
  if (draft.resolveToAddress !== undefined && !RESOLVE_TO_ADDRESS_PATTERN.test(draft.resolveToAddress)) {
    return 'resolveToAddress';
  }
  if (draft.tlsCipherSuites !== undefined && !TLS_CIPHER_SUITES_PATTERN.test(draft.tlsCipherSuites)) {
    return 'tlsCipherSuites';
  }
  if (draft.proxyMode === 'url' && draft.proxyUrl === undefined) return 'proxyUrl';
  if (draft.proxyUrl !== undefined && !isValidProxyUrl(draft.proxyUrl)) return 'proxyUrl';
  if (draft.unixSocketPath !== undefined && !isValidUnixSocketPath(draft.unixSocketPath)) return 'unixSocketPath';
  return null;
}
