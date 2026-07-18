/**
 * ValueViewDocumentTab — one detected value opened as a read-only
 * snapshot document: the eye glance's tab escalation. Decodes from the
 * hit captured at open (never the source row — honest snapshot; the
 * toolbar says so), renders the shared decoded vocabulary — JWTs as
 * header + payload JSON panes, pair-shaped kinds as the read-only pair
 * grid, everything else through the Monaco viewer — with the encoded
 * value in a bounded strip underneath. No draft, no dirty, no Save;
 * dock-split capable for free as a real editor tab.
 */

import { useT } from '@openheaders/ui/context/LocaleContext';
import {
  COMPACT_VALUE_TITLE_KEYS,
  compactDecodedText,
  decodeJWT,
  encodeDetectedValue,
  formatJSON,
  pairGridTypeOf,
} from '@openheaders/ui/shared/value-detection';
import { PairGridEditor } from '@openheaders/ui/workbench/components/value-editors/PairGridEditor';
import { lazy, Suspense, useMemo } from 'react';
import type { ValueViewInspectorTab } from '../../data/inspector-tab';
import Skeleton from '../detail/Skeleton';

// Lazy like every other Monaco consumer — a static import here would
// pull Monaco back into the panel's initial chunk.
const CodeViewer = lazy(() => import('../detail/CodeViewer'));

interface ValueViewDocumentTabProps {
  tab: ValueViewInspectorTab;
}

// The pair grid requires a change handler; the snapshot document is
// read-only end to end, so edits can never fire.
const noop = (): void => {};

export function ValueViewDocumentTab({ tab }: ValueViewDocumentTabProps) {
  const t = useT();
  const detected = tab.detected;
  const typeTitle = t(COMPACT_VALUE_TITLE_KEYS[detected.type]);

  const decoded = useMemo(() => compactDecodedText(detected), [detected]);
  // JWTs show the verbatim snapshot token; other kinds the registry's
  // canonical re-encode of the decoded text — the same round-trip the
  // modal preview shows.
  const encoded = useMemo(
    () => (detected.type === 'jwt' ? `${detected.prefix}${detected.token}` : encodeDetectedValue(detected, decoded)),
    [detected, decoded],
  );
  const jwt = useMemo(() => {
    if (detected.type !== 'jwt') return null;
    try {
      const parts = decodeJWT(detected.token);
      return { header: formatJSON(parts.header), payload: formatJSON(parts.payload) };
    } catch {
      return null;
    }
  }, [detected]);
  const gridType = pairGridTypeOf(detected.type);
  const language = detected.type === 'json' ? ('json' as const) : ('plaintext' as const);

  return (
    <div className="dt-storagedoc dt-valueview">
      <div className="dt-storagedoc-toolbar">
        <span className="dt-storagedoc-crumb" title={`${tab.label} · ${typeTitle}`}>
          <span className="dt-storagedoc-crumb-key">{tab.label}</span>
          <span className="dt-storage-meta"> · {typeTitle}</span>
        </span>
        <span className="dt-storagedoc-toolbar-spacer" />
        <span className="dt-storage-meta" title={t('panel.valueView.snapshotTitle')}>
          {t('panel.valueView.snapshotNote')}
        </span>
      </div>
      {jwt !== null ? (
        <>
          <div className="dt-valueview-pane-label">{t('shared.valueEditors.jwt.header')}</div>
          <div className="dt-storagedoc-source dt-valueview-pane--header">
            <Suspense fallback={<Skeleton />}>
              <CodeViewer value={jwt.header} language="json" readOnly decodeAffordance={false} />
            </Suspense>
          </div>
          <div className="dt-valueview-pane-label">{t('shared.valueEditors.jwt.payload')}</div>
          <div className="dt-storagedoc-source">
            <Suspense fallback={<Skeleton />}>
              {/* jwtDetection stays ON: a claim can itself carry a token
                  (id_token, actor tokens) — nested decode, one level per
                  open. */}
              <CodeViewer value={jwt.payload} language="json" readOnly decodeAffordance={false} />
            </Suspense>
          </div>
        </>
      ) : gridType !== null ? (
        <div
          className="dt-storagedoc-source dt-scrollbar"
          style={{ overflowY: 'auto', overscrollBehavior: 'none', padding: 12 }}
        >
          <PairGridEditor gridType={gridType} value={decoded} onChange={noop} readOnly />
        </div>
      ) : (
        <div className="dt-storagedoc-source">
          <Suspense fallback={<Skeleton />}>
            {/* Whole-buffer decode stays off (this document IS a detected
                value's decoded text) but the JWT plane stays on — the
                decoded text can CONTAIN a token (an auth claim in a
                base64 JSON body), and the underline is the nested-decode
                path. */}
            <CodeViewer value={decoded} language={language} readOnly decodeAffordance={false} />
          </Suspense>
        </div>
      )}
      {encoded !== null && (
        <div className="dt-valuedoc-preview" aria-label={t('panel.valueView.encodedValue')}>
          <span className="dt-valuedoc-preview-label">{t('panel.valueView.encodedValue')}</span>
          <div className="dt-valuedoc-preview-body dt-scrollbar">{encoded}</div>
        </div>
      )}
    </div>
  );
}
