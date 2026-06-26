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

export function previewAuthContributions(auth: AuthConfig): AuthPreviewContributions {
  switch (auth.type) {
    case 'none':
    case 'inherit':
      return EMPTY;
    case 'basic':
      return {
        headers: [
          {
            key: 'Authorization',
            value: 'Basic <credentials>',
            hint: 'Generated from the Authorization tab (Basic Auth). Username and password are base64-encoded into this header when the request is sent.',
          },
        ],
        params: [],
      };
    case 'bearer':
      return {
        headers: [
          {
            key: 'Authorization',
            value: 'Bearer <token>',
            hint: 'Generated from the Authorization tab (Bearer Token). The token is added to this header when the request is sent.',
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
        value: '<value>',
        hint: `Generated from the Authorization tab (API Key). The value is added to this ${
          inQuery ? 'query param' : 'header'
        } when the request is sent.`,
      };
      return inQuery ? { headers: [], params: [entry] } : { headers: [entry], params: [] };
    }
    case 'oauth2': {
      const inQuery = auth.sendAs === 'query';
      const entry: AuthPreviewEntry = inQuery
        ? {
            key: 'access_token',
            value: '<access token>',
            hint: 'Generated from the Authorization tab (OAuth 2.0). The access token is appended to the request URL when the request is sent.',
          }
        : {
            key: 'Authorization',
            value: 'Bearer <access token>',
            hint: 'Generated from the Authorization tab (OAuth 2.0). The access token is added to this header when the request is sent.',
          };
      return inQuery ? { headers: [], params: [entry] } : { headers: [entry], params: [] };
    }
  }
}
