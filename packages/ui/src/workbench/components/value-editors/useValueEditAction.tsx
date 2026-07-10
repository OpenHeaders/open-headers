/**
 * useValueEditAction — per-field wiring for the value editors. Runs
 * the detector registry over the field's value and, on a hit, hands
 * the caller the TemplateInput rail props plus the mounted editor for
 * that value type: the modals (JWT modal, or the shared encoded-value
 * modal) by default, or the inline `CompactValueEditor` in the
 * `compact` variant for popover hosts. TemplateInput itself stays
 * presentation-only — detection and editor state live here, at the
 * caller.
 */

import type React from 'react';
import { lazy, Suspense, useCallback, useMemo, useState } from 'react';
import {
  decodeJWT,
  detectValueType,
  encodeAcceptList,
  encodeAuthParams,
  encodeBase64,
  encodeCacheControl,
  encodeContentDisposition,
  encodeCookieList,
  encodeCspList,
  encodeDataUri,
  encodeHex,
  encodeHsts,
  encodeHttpDate,
  encodeJsonString,
  encodeJsonValue,
  encodeJWT,
  encodeLinkHeader,
  encodeQueryString,
  encodeTimestamp,
  formatJSON,
  validateJSON,
} from '@openheaders/ui/shared/value-detection';
import { CompactValueEditor } from './CompactValueEditor';

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

export interface ValueEditActionOptions {
  /** `modal` (default) mounts the full editor modals (JWT / encoded
   *  value, Monaco-backed). `compact` mounts the inline
   *  `CompactValueEditor` instead — for hosts that live inside a
   *  popover where a portal modal can't (the panel's rule
   *  quick-editor). JWTs edit payload-only in compact; header and
   *  signature carry over unchanged. */
  variant?: 'modal' | 'compact';
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

// The compact variant edits JWTs payload-only, so it titles them too.
const COMPACT_TITLES = { ...MODAL_TITLES, jwt: 'JWT payload' } as const;

export function useValueEditAction(
  value: string | undefined,
  onChange: (next: string) => void,
  options?: ValueEditActionOptions,
): ValueEditActionResult {
  const variant = options?.variant ?? 'modal';
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
        case 'jwt': {
          // Compact variant only — the modal variant routes JWTs to the
          // dedicated JWT editor instead. Payload-only edit: header and
          // signature carry over verbatim, unsigned (same write-back
          // the modal does).
          try {
            const payload = validateJSON(text);
            if (payload === null || typeof payload !== 'object' || Array.isArray(payload)) return null;
            const { header, signature } = decodeJWT(detected.token);
            return `${detected.prefix}${encodeJWT(header, payload, signature)}`;
          } catch {
            return null;
          }
        }
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

  // Compact seed text — JWTs edit payload-only there (the two-pane
  // header/payload split belongs to the modal).
  const compactDecoded = useMemo(() => {
    if (!detected) return '';
    if (detected.type === 'jwt') return formatJSON(decodeJWT(detected.token).payload);
    return detected.type === 'timestamp' || detected.type === 'http-date' ? detected.iso : detected.decoded;
  }, [detected]);

  if (!detected) {
    return { editProps: {}, editorModal: null };
  }

  if (variant === 'compact') {
    return {
      editProps: { onValueEdit: openModal, editTooltip: EDIT_TOOLTIPS[detected.type] },
      editorModal: open ? (
        <CompactValueEditor
          title={COMPACT_TITLES[detected.type]}
          decoded={compactDecoded}
          encode={encodeCurrent}
          onSave={handleEncodedSave}
          onCancel={closeModal}
        />
      ) : null,
    };
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
