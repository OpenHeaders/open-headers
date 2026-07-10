/**
 * useValueEditAction — per-field wiring for the value editors. Runs
 * the detector registry over the field's value and, on a hit, hands
 * the caller the TemplateInput rail props plus the mounted editor
 * modal for that value type (JWT modal, or the shared encoded-value
 * modal for base64 / URL-encoding). TemplateInput itself stays
 * presentation-only — detection and modal state live here, at the
 * caller.
 */

import type React from 'react';
import { lazy, Suspense, useCallback, useMemo, useState } from 'react';
import { detectValueType } from './detect';
import {
  encodeBase64,
  encodeCookieList,
  encodeCspList,
  encodeDataUri,
  encodeHex,
  encodeJsonString,
  encodeJsonValue,
  encodeTimestamp,
} from './encodings';
import {
  encodeAcceptList,
  encodeAuthParams,
  encodeCacheControl,
  encodeContentDisposition,
  encodeHsts,
  encodeHttpDate,
  encodeLinkHeader,
  encodeQueryString,
} from './header-values';

// Lazy so the modals (Monaco via the shared CodeEditor) stay out of
// every TemplateInput caller's bundle; they load on first edit-icon
// click — same treatment as the panel's Monaco-backed surfaces.
const JWTEditorModalLazy = lazy(() => import('./JWTEditorModal'));
const EncodedValueModalLazy = lazy(() => import('./EncodedValueModal'));

export interface ValueEditActionResult {
  /** Spread onto the TemplateInput. Empty when no detector matched,
   *  so the rail shows no edit icon. */
  editProps: { onValueEdit: () => void; editTooltip: string } | Record<string, never>;
  /** Render alongside the field (always safe — mounts nothing until
   *  the icon is clicked, and `null` when no detector matched). */
  editorModal: React.ReactNode;
}

const EDIT_TOOLTIPS = {
  jwt: 'Edit as JWT',
  'url-encoded': 'Edit URL-encoded value',
  base64: 'Edit Base64 value',
  hex: 'Edit hex-encoded value',
  timestamp: 'Edit timestamp',
  json: 'Edit as JSON',
  'json-string': 'Edit quoted string',
  'data-uri': 'Edit data URI content',
  cookie: 'Edit cookie pairs',
  csp: 'Edit CSP directives',
  'http-date': 'Edit HTTP date',
  'query-string': 'Edit query pairs',
  'cache-control': 'Edit cache directives',
  hsts: 'Edit HSTS directives',
  'content-disposition': 'Edit disposition parameters',
  link: 'Edit links',
  'auth-params': 'Edit auth parameters',
  'accept-list': 'Edit accept list',
} as const;

const MODAL_TITLES = {
  'url-encoded': 'URL-encoded value',
  base64: 'Base64 value',
  hex: 'Hex-encoded value',
  timestamp: 'Unix timestamp',
  json: 'JSON value',
  'json-string': 'Quoted string',
  'data-uri': 'Data URI',
  cookie: 'Cookie value',
  csp: 'Content Security Policy',
  'http-date': 'HTTP date',
  'query-string': 'Query string',
  'cache-control': 'Cache-Control',
  hsts: 'Strict-Transport-Security',
  'content-disposition': 'Content-Disposition',
  link: 'Link header',
  'auth-params': 'Authorization parameters',
  'accept-list': 'Accept list',
} as const;

export function useValueEditAction(value: string | undefined, onChange: (next: string) => void): ValueEditActionResult {
  const [open, setOpen] = useState(false);
  const detected = useMemo(() => detectValueType(value), [value]);

  const openModal = useCallback(() => setOpen(true), []);
  const closeModal = useCallback(() => setOpen(false), []);

  const handleJwtSave = useCallback(
    (nextToken: string) => {
      // Restore whatever preceded the token (e.g. `Bearer `).
      const prefix = detected?.type === 'jwt' ? detected.prefix : '';
      onChange(`${prefix}${nextToken}`);
      setOpen(false);
    },
    [onChange, detected],
  );

  // Preview AND save go through this, so what the preview shows is
  // exactly what lands in the field — prefix included. Null means the
  // edited text can't encode (e.g. an unparsable date); the modal
  // disables Save on it.
  const encodeCurrent = useCallback(
    (text: string): string | null => {
      switch (detected?.type) {
        case 'base64':
          return `${detected.prefix}${encodeBase64(text, detected)}`;
        case 'hex':
          return encodeHex(text, detected);
        case 'timestamp':
          return encodeTimestamp(text, detected);
        case 'json':
          return encodeJsonValue(text, detected);
        case 'json-string':
          return encodeJsonString(text);
        case 'data-uri':
          return encodeDataUri(text, detected);
        case 'cookie':
          return encodeCookieList(text);
        case 'csp':
          return encodeCspList(text);
        case 'http-date':
          return encodeHttpDate(text);
        case 'query-string':
          return encodeQueryString(text);
        case 'cache-control':
          return encodeCacheControl(text);
        case 'hsts':
          return encodeHsts(text);
        case 'content-disposition':
          return encodeContentDisposition(text);
        case 'link':
          return encodeLinkHeader(text);
        case 'auth-params':
          return encodeAuthParams(text, detected);
        case 'accept-list':
          return encodeAcceptList(text);
        default:
          return encodeURIComponent(text);
      }
    },
    [detected],
  );

  const handleEncodedSave = useCallback(
    (decodedText: string) => {
      const next = encodeCurrent(decodedText);
      if (next === null) return;
      onChange(next);
      setOpen(false);
    },
    [onChange, encodeCurrent],
  );

  if (!detected) {
    return { editProps: {}, editorModal: null };
  }

  return {
    editProps: { onValueEdit: openModal, editTooltip: EDIT_TOOLTIPS[detected.type] },
    editorModal: open ? (
      <Suspense fallback={null}>
        {detected.type === 'jwt' ? (
          <JWTEditorModalLazy open={open} token={detected.token} onSave={handleJwtSave} onCancel={closeModal} />
        ) : (
          <EncodedValueModalLazy
            open={open}
            title={MODAL_TITLES[detected.type]}
            decoded={detected.type === 'timestamp' || detected.type === 'http-date' ? detected.iso : detected.decoded}
            encode={encodeCurrent}
            onSave={handleEncodedSave}
            onCancel={closeModal}
          />
        )}
      </Suspense>
    ) : null,
  };
}
