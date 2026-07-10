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
      if (detected?.type === 'base64') return `${detected.prefix}${encodeBase64(text, detected)}`;
      if (detected?.type === 'hex') return encodeHex(text, detected);
      if (detected?.type === 'timestamp') return encodeTimestamp(text, detected);
      if (detected?.type === 'json') return encodeJsonValue(text, detected);
      if (detected?.type === 'json-string') return encodeJsonString(text);
      if (detected?.type === 'data-uri') return encodeDataUri(text, detected);
      if (detected?.type === 'cookie') return encodeCookieList(text);
      if (detected?.type === 'csp') return encodeCspList(text);
      return encodeURIComponent(text);
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
            decoded={detected.type === 'timestamp' ? detected.iso : detected.decoded}
            encode={encodeCurrent}
            onSave={handleEncodedSave}
            onCancel={closeModal}
          />
        )}
      </Suspense>
    ) : null,
  };
}
