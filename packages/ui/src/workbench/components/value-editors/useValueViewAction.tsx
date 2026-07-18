/**
 * useValueViewAction — the read-only sibling of `useValueEditAction`.
 * Takes an already-detected registry hit and hands back the view
 * affordance for it as an escalation ladder: the view icon anchors a
 * GLANCE popover (compact decoded preview) whose footer CTAs open the
 * depth the user picks — the value-view editor-tab document (when the
 * host surface registered an opener) or the shared modals in `readOnly`
 * mode (JWT viewer for tokens, the encoded-value modal — pair grid
 * included — for everything else). Nothing is ever written back;
 * detection stays with the caller so a surface that already ran the
 * registry (the panel's row introspection) never pays a second scan.
 */

import { InfoPopover, type InfoPopoverContent } from '@openheaders/ui/shared/info-popover';
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
import { ValueGlancePreview } from './ValueGlancePreview';

// Same lazy treatment as the edit hook — the modals mount nothing
// until "Open as modal" is actually chosen.
const JWTEditorModalLazy = lazy(() => import('./JWTEditorModal'));
const EncodedValueModalLazy = lazy(() => import('./EncodedValueModal'));

/** What the glance's document CTA hands to the panel's tab opener: the
 *  registry hit snapshotted at open plus the surface's own name for the
 *  value (header / cookie / param name) as the tab's label seed. */
export interface ValueViewTabTarget {
  detected: DetectedValue;
  sourceLabel?: string;
}

export interface ValueViewActionOptions {
  /** Panel-registered opener for the value-view editor-tab document.
   *  Null/absent (e.g. no provider mounted) ⇒ the glance offers only
   *  the modal escalation. */
  openAsTab?: ((target: ValueViewTabTarget) => void) | null;
  /** The surface's own name for the value — titles the glance and seeds
   *  the document tab's label. */
  sourceLabel?: string;
}

export interface ValueViewActionResult {
  /** Spread onto the view icon. Empty when there is no detected value,
   *  so the surface shows no icon. */
  viewProps: { viewTooltip: string } | Record<string, never>;
  /** Wrap the view icon — anchors the glance popover on it (click
   *  trigger). Identity when there is no detected value. */
  glance: (trigger: React.ReactElement) => React.ReactNode;
  /** Render alongside the surface (always safe — mounts nothing until
   *  the modal CTA is chosen, and `null` without a detected value). */
  viewerModal: React.ReactNode;
}

export function useValueViewAction(
  detected: DetectedValue | null,
  options?: ValueViewActionOptions,
): ValueViewActionResult {
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
    return { viewProps: {}, glance: (trigger) => trigger, viewerModal: null };
  }

  const title = t(COMPACT_VALUE_TITLE_KEYS[detected.type]);
  const viewTooltip =
    detected.type === 'jwt' ? t('shared.valueEditors.viewJwt') : t('shared.valueEditors.decodeChipView', { title });

  const openAsTab = options?.openAsTab ?? null;
  const sourceLabel = options?.sourceLabel;
  const glanceContent: InfoPopoverContent = {
    kicker: title,
    title: sourceLabel ?? t('shared.valueEditors.glance.title'),
    // The preview component runs the decode on render — the popover
    // mounts its content only while open, so rows never pay for it.
    summary: <ValueGlancePreview detected={detected} />,
    actions: [
      ...(openAsTab
        ? [
            {
              label: t('shared.valueEditors.openAsDocument'),
              primary: true,
              onClick: () => openAsTab({ detected, ...(sourceLabel !== undefined ? { sourceLabel } : {}) }),
            },
          ]
        : []),
      { label: t('shared.valueEditors.glance.openModal'), onClick: openModal },
    ],
  };

  return {
    viewProps: { viewTooltip },
    glance: (trigger) => <InfoPopover content={glanceContent}>{trigger}</InfoPopover>,
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
