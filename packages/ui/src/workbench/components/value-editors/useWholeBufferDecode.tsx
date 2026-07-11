/**
 * useWholeBufferDecode — the whole-buffer sibling of `useMonacoJwtEdit`.
 * Runs the detector registry over a viewer's ENTIRE buffer and, on a
 * hit, hands back an always-visible "Decode" chip plus the shared
 * encoded-value modal for that value type: a read-only viewer where
 * nothing can be written, or an editor whose Save re-encodes through
 * the compact codec and writes the whole buffer back via `onApply`.
 * Two types never claim a buffer here: JWTs (the in-buffer underline
 * plane already routes a whole-buffer token to the JWT modal) and JSON
 * values (the viewer already renders JSON). In-buffer scanning stays
 * JWT-only by design — this hook is whole-buffer detection only.
 */

import {
  COMPACT_VALUE_TITLES,
  compactDecodedText,
  detectValueType,
  encodeDetectedValue,
  pairGridTypeOf,
} from '@openheaders/ui/shared/value-detection';
import type React from 'react';
import { lazy, Suspense, useCallback, useMemo, useState } from 'react';

// Same lazy treatment as `useValueEditAction` — the modal mounts
// nothing until the chip is actually clicked.
const EncodedValueModalLazy = lazy(() => import('./EncodedValueModal'));

export interface WholeBufferDecodeOptions {
  /** The viewer's full buffer text. */
  value: string;
  /** Viewer wiring for read-only buffers: the modal opens read-only
   *  with no write-back. Editable hosts pass false plus `onApply`. */
  readOnly?: boolean;
  /** Write the re-encoded buffer back into the draft (editable hosts).
   *  Absent ⇒ the modal is a viewer regardless of `readOnly`. */
  onApply?: (encoded: string) => void;
  /** Hosts whose value semantics own detection themselves opt out. */
  enabled?: boolean;
}

export interface WholeBufferDecodeResult {
  /** The corner "Decode" chip — null when the buffer isn't one
   *  detected encoded value. Hosts position it. */
  decodeChip: React.ReactNode;
  /** Render alongside the viewer — mounts nothing until the chip is
   *  clicked. */
  decodeModal: React.ReactNode;
}

export function useWholeBufferDecode({
  value,
  readOnly = false,
  onApply,
  enabled = true,
}: WholeBufferDecodeOptions): WholeBufferDecodeResult {
  const [open, setOpen] = useState(false);

  const detected = useMemo(() => {
    if (!enabled) return null;
    const hit = detectValueType(value);
    if (hit === null || hit.type === 'jwt' || hit.type === 'json') return null;
    return hit;
  }, [enabled, value]);

  const viewerOnly = readOnly || !onApply;

  const encodeCurrent = useCallback(
    (text: string): string | null => (detected ? encodeDetectedValue(detected, text) : null),
    [detected],
  );

  const handleSave = useCallback(
    (decodedText: string) => {
      const next = encodeCurrent(decodedText);
      if (next === null) return;
      onApply?.(next);
      setOpen(false);
    },
    [encodeCurrent, onApply],
  );

  const closeModal = useCallback(() => setOpen(false), []);

  if (!detected) {
    return { decodeChip: null, decodeModal: null };
  }

  return {
    decodeChip: (
      <button
        type="button"
        className="dt-codeviewer-decode"
        title={`${viewerOnly ? 'View decoded' : 'Decode and edit'} — ${COMPACT_VALUE_TITLES[detected.type]}`}
        onClick={() => setOpen(true)}
      >
        Decode
      </button>
    ),
    decodeModal: open ? (
      <Suspense fallback={null}>
        <EncodedValueModalLazy
          open
          title={COMPACT_VALUE_TITLES[detected.type]}
          decoded={compactDecodedText(detected)}
          encode={encodeCurrent}
          onSave={viewerOnly ? undefined : handleSave}
          onCancel={closeModal}
          gridType={pairGridTypeOf(detected.type)}
          readOnly={viewerOnly}
        />
      </Suspense>
    ) : null,
  };
}
