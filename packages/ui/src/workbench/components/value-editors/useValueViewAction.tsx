/**
 * useValueViewAction — the read-only sibling of `useValueEditAction`.
 * Takes an already-detected registry hit and hands back the view
 * affordance for it: an icon's tooltip/aria text plus the shared
 * modals mounted in `readOnly` mode (JWT viewer for tokens, the
 * encoded-value modal — pair grid included — for everything else).
 * Nothing is ever written back; detection stays with the caller so a
 * surface that already ran the registry (the panel's row
 * introspection) never pays a second scan.
 */

import type { DetectedValue } from '@openheaders/ui/shared/value-detection';
import type React from 'react';
import { lazy, Suspense, useCallback, useState } from 'react';
import { useT } from '@openheaders/ui/context/LocaleContext';
import {
  COMPACT_VALUE_TITLE_KEYS,
  compactDecodedText,
  encodeDetectedValue,
  pairGridTypeOf,
} from '@openheaders/ui/shared/value-detection';

// Same lazy treatment as the edit hook — the modals mount nothing
// until the view icon is actually clicked.
const JWTEditorModalLazy = lazy(() => import('./JWTEditorModal'));
const EncodedValueModalLazy = lazy(() => import('./EncodedValueModal'));

export interface ValueViewActionResult {
  /** Spread onto the view icon. Empty when there is no detected value,
   *  so the surface shows no icon. */
  viewProps: { onValueView: () => void; viewTooltip: string } | Record<string, never>;
  /** Render alongside the surface (always safe — mounts nothing until
   *  the icon is clicked, and `null` without a detected value). */
  viewerModal: React.ReactNode;
}

export function useValueViewAction(detected: DetectedValue | null): ValueViewActionResult {
  const t = useT();
  const [open, setOpen] = useState(false);

  const openModal = useCallback(() => setOpen(true), []);
  const closeModal = useCallback(() => setOpen(false), []);

  // Viewer-only: the encode feeds the modal's read-only preview pane so
  // the shown round-trip is the registry's real one; Save never exists.
  const encodeCurrent = useCallback(
    (text: string): string | null => (detected ? encodeDetectedValue(detected, text) : null),
    [detected],
  );

  if (!detected) {
    return { viewProps: {}, viewerModal: null };
  }

  const title = t(COMPACT_VALUE_TITLE_KEYS[detected.type]);
  const viewTooltip =
    detected.type === 'jwt' ? t('shared.valueEditors.viewJwt') : t('shared.valueEditors.decodeChipView', { title });

  return {
    viewProps: { onValueView: openModal, viewTooltip },
    viewerModal: open ? (
      <Suspense fallback={null}>
        {detected.type === 'jwt' ? (
          <JWTEditorModalLazy open token={detected.token} onCancel={closeModal} readOnly />
        ) : (
          <EncodedValueModalLazy
            open
            title={title}
            decoded={compactDecodedText(detected)}
            encode={encodeCurrent}
            onCancel={closeModal}
            gridType={pairGridTypeOf(detected.type)}
            readOnly
          />
        )}
      </Suspense>
    ) : null,
  };
}
