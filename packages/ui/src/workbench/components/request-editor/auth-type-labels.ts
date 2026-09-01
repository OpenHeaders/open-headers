/**
 * Every auth type with its display key — a leaf module (no component
 * imports) so the select builders, the type menu, and the info
 * popovers all read one list without a runtime cycle through the
 * form modules.
 */

import type { AuthConfig } from '@openheaders/core/types';
import type { MessageKey } from '@openheaders/i18n';

export type AuthKind = AuthConfig['type'];

export interface AuthTypeOption {
  value: AuthKind;
  labelKey: MessageKey;
}

/** The HTTP select's own list; the session tabs pick their subsets. */
export const AUTH_TYPE_OPTIONS: AuthTypeOption[] = [
  { value: 'inherit', labelKey: 'workbench.editors.request.auth.type.inherit' },
  { value: 'none', labelKey: 'workbench.editors.request.auth.type.none' },
  { value: 'basic', labelKey: 'workbench.editors.request.auth.type.basic' },
  { value: 'bearer', labelKey: 'workbench.editors.request.auth.type.bearer' },
  { value: 'api-key', labelKey: 'workbench.editors.request.auth.type.apiKey' },
  { value: 'oauth2', labelKey: 'workbench.editors.request.auth.type.oauth2' },
  { value: 'aws-sigv4', labelKey: 'workbench.editors.request.auth.type.awsSigV4' },
  { value: 'edgegrid', labelKey: 'workbench.editors.request.auth.type.edgeGrid' },
  { value: 'asap', labelKey: 'workbench.editors.request.auth.type.asap' },
  { value: 'digest', labelKey: 'workbench.editors.request.auth.type.digest' },
  { value: 'oauth1', labelKey: 'workbench.editors.request.auth.type.oauth1' },
  { value: 'hawk', labelKey: 'workbench.editors.request.auth.type.hawk' },
  { value: 'jwt', labelKey: 'workbench.editors.request.auth.type.jwtBearer' },
];

export function authTypeLabelKey(type: AuthKind): MessageKey {
  return AUTH_TYPE_OPTIONS.find((o) => o.value === type)?.labelKey ?? 'workbench.editors.request.auth.type.none';
}
