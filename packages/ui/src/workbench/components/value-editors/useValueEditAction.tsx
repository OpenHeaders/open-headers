/**
 * useValueEditAction — per-field wiring for the value editors. Runs
 * the detector registry over the field's value and, on a hit, hands
 * the caller the TemplateInput rail props plus the mounted editor for
 * that value type: the modals (JWT modal, or the shared encoded-value
 * modal) by default, or the inline `CompactValueEditor` in the
 * `compact` variant for popover hosts. TemplateInput itself stays
 * presentation-only — detection and editor state live here, at the
 * caller. The decode/encode spine is the pure compact codec shared
 * with the panel's value-document tab.
 */

import type { MessageKey } from '@openheaders/i18n';
import type { DetectedValue } from '@openheaders/ui/shared/value-detection';
import type React from 'react';
import { lazy, Suspense, useCallback, useMemo, useState } from 'react';
import { useT } from '@openheaders/ui/context/LocaleContext';
import {
  COMPACT_VALUE_TITLE_KEYS,
  compactDecodedText,
  detectValueType,
  encodeDetectedValue,
  pairGridTypeOf,
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
  /** Compact variant only — escalate this value to a dedicated
   *  document tab. When set, the inline editor's footer offers
   *  "Open as document"; the caller owns closing its popover and
   *  opening the tab. */
  onOpenDocument?: () => void;
}

const EDIT_TOOLTIP_KEYS: Record<DetectedValue['type'], MessageKey> = {
  jwt: 'shared.valueEditors.editTooltip.jwt',
  'url-encoded': 'shared.valueEditors.editTooltip.urlEncoded',
  base64: 'shared.valueEditors.editTooltip.base64',
  hex: 'shared.valueEditors.editTooltip.hex',
  timestamp: 'shared.valueEditors.editTooltip.timestamp',
  json: 'shared.valueEditors.editTooltip.json',
  'json-string': 'shared.valueEditors.editTooltip.jsonString',
  'data-uri': 'shared.valueEditors.editTooltip.dataUri',
  cookie: 'shared.valueEditors.editTooltip.cookie',
  csp: 'shared.valueEditors.editTooltip.csp',
  'http-date': 'shared.valueEditors.editTooltip.httpDate',
  'query-string': 'shared.valueEditors.editTooltip.queryString',
  'cache-control': 'shared.valueEditors.editTooltip.cacheControl',
  hsts: 'shared.valueEditors.editTooltip.hsts',
  'content-disposition': 'shared.valueEditors.editTooltip.contentDisposition',
  link: 'shared.valueEditors.editTooltip.link',
  'auth-params': 'shared.valueEditors.editTooltip.authParams',
  'accept-list': 'shared.valueEditors.editTooltip.acceptList',
};

export function useValueEditAction(
  value: string | undefined,
  onChange: (next: string) => void,
  options?: ValueEditActionOptions,
): ValueEditActionResult {
  const t = useT();
  const variant = options?.variant ?? 'modal';
  const onOpenDocument = options?.onOpenDocument;
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
    (text: string): string | null => (detected ? encodeDetectedValue(detected, text) : encodeURIComponent(text)),
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

  // Single-text seed — JWTs edit payload-only here (the two-pane
  // header/payload split belongs to the modal).
  const compactDecoded = useMemo(() => (detected ? compactDecodedText(detected) : ''), [detected]);

  if (!detected) {
    return { editProps: {}, editorModal: null };
  }

  if (variant === 'compact') {
    return {
      editProps: { onValueEdit: openModal, editTooltip: t(EDIT_TOOLTIP_KEYS[detected.type]) },
      editorModal: open ? (
        <CompactValueEditor
          title={t(COMPACT_VALUE_TITLE_KEYS[detected.type])}
          decoded={compactDecoded}
          encode={encodeCurrent}
          onSave={handleEncodedSave}
          onCancel={closeModal}
          onOpenDocument={onOpenDocument}
        />
      ) : null,
    };
  }

  return {
    editProps: { onValueEdit: openModal, editTooltip: t(EDIT_TOOLTIP_KEYS[detected.type]) },
    editorModal: open ? (
      <Suspense fallback={null}>
        {detected.type === 'jwt' ? (
          <JWTEditorModalLazy open={open} token={detected.token} onSave={handleJwtSave} onCancel={closeModal} />
        ) : (
          <EncodedValueModalLazy
            open={open}
            title={t(COMPACT_VALUE_TITLE_KEYS[detected.type])}
            decoded={compactDecoded}
            encode={encodeCurrent}
            onSave={handleEncodedSave}
            onCancel={closeModal}
            gridType={pairGridTypeOf(detected.type)}
          />
        )}
      </Suspense>
    ) : null,
  };
}
