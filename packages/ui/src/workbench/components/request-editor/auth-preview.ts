/**
 * Auth → header / query-param preview.
 *
 * Mirrors how the request executor's auth step contributes to the
 * outgoing request (an `Authorization` header for Basic / Bearer /
 * OAuth 2.0, the user-named header or query param for an API key) so
 * the Headers / Params tabs can surface a read-only "this will be added
 * when the request is sent" row — the same affordance the
 * browser-managed auto-headers use.
 *
 * Values are descriptive placeholders, never the resolved secret: a
 * base64 Basic credential or a bearer token would leak on screen-share,
 * and any `{{ref}}` only resolves at send time anyway. The preview's job
 * is to advertise the header's presence + scheme, not to render the
 * credential.
 */

import type { AuthConfig } from '@openheaders/core/types';
import type { Translate } from '@openheaders/ui/context/LocaleContext';

export interface AuthPreviewEntry {
  key: string;
  value: string;
  hint: string;
}

export interface AuthPreviewContributions {
  headers: AuthPreviewEntry[];
  params: AuthPreviewEntry[];
}

const EMPTY: AuthPreviewContributions = { headers: [], params: [] };

export function previewAuthContributions(auth: AuthConfig, t: Translate): AuthPreviewContributions {
  switch (auth.type) {
    case 'none':
    case 'inherit':
      return EMPTY;
    case 'basic':
      return {
        headers: [
          {
            key: 'Authorization',
            value: t('workbench.editors.request.authPreview.basicValue'),
            hint: t('workbench.editors.request.authPreview.basicHint'),
          },
        ],
        params: [],
      };
    case 'bearer':
      return {
        headers: [
          {
            key: 'Authorization',
            value: t('workbench.editors.request.authPreview.bearerValue'),
            hint: t('workbench.editors.request.authPreview.bearerHint'),
          },
        ],
        params: [],
      };
    case 'api-key': {
      const key = auth.key.trim();
      if (!key) return EMPTY;
      const inQuery = auth.in === 'query';
      const entry: AuthPreviewEntry = {
        key,
        value: t('workbench.editors.request.authPreview.apiKeyValue'),
        hint: inQuery
          ? t('workbench.editors.request.authPreview.apiKeyQueryHint')
          : t('workbench.editors.request.authPreview.apiKeyHeaderHint'),
      };
      return inQuery ? { headers: [], params: [entry] } : { headers: [entry], params: [] };
    }
    case 'oauth2': {
      const inQuery = auth.sendAs === 'query';
      const entry: AuthPreviewEntry = inQuery
        ? {
            key: 'access_token',
            value: t('workbench.editors.request.authPreview.accessTokenValue'),
            hint: t('workbench.editors.request.authPreview.oauth2QueryHint'),
          }
        : {
            key: 'Authorization',
            value: t('workbench.editors.request.authPreview.bearerAccessTokenValue'),
            hint: t('workbench.editors.request.authPreview.oauth2HeaderHint'),
          };
      return inQuery ? { headers: [], params: [entry] } : { headers: [entry], params: [] };
    }
  }
}
