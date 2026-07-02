import { lazy, Suspense, useMemo, useState } from 'react';
import {
  currentHarEntry,
  type InspectorRowWithFires,
  lifecycleMimeType,
  lifecycleTransferredBytes,
} from '../data/inspector-row-projection';
import { classifyBodyState, classifyResponseSnapshot, snapshotMime } from '../data/response-body-state';
import BodyStateView from './detail/BodyStateView';
import OverrideBodyButton from './detail/OverrideBodyButton';
import Skeleton from './detail/Skeleton';
import SplitBodyView from './detail/SplitBodyView';

// Lazy: keeps Monaco's diff bundle out of the panel's initial chunk —
// it only loads when a two-sided override is actually inspected.
const DiffBodyView = lazy(() => import('./detail/DiffBodyView'));

interface ResponseBodyViewProps {
  row: InspectorRowWithFires;
  searchHighlight?: string;
  searchLineNumber?: number;
  /** N-th occurrence of `searchHighlight` in this body (0-based). */
  searchMatchIndex?: number;
  /** Open the create-rule editor pre-filled to mock this response. */
  onOverrideResponse?: () => void;
}

/**
 * The Response tab. Renders the body the page received — and, when a response
 * rule modified a real (`network`-source) exchange, the real server response
 * as well (Modified | Original). The two-sided view opens as a Monaco diff by
 * default (both bodies text, unchanged rows collapsed) with a Full-response
 * toggle for the split view; non-text pairs go straight to the split. The
 * body rendering itself lives in the shared {@link BodyStateView}; this
 * component only decides single-pane vs two-sided and classifies each side.
 */
export function ResponseBodyView({ row, searchHighlight, searchMatchIndex, onOverrideResponse }: ResponseBodyViewProps) {
  const lc = row.lifecycle;
  const declaredMime = lifecycleMimeType(lc) ?? currentHarEntry(lc)?.response?.content?.mimeType ?? '';
  const servedState = useMemo(() => classifyBodyState(lc), [lc]);
  const fallbackBytes = lifecycleTransferredBytes(lc) ?? 0;
  const [dualMode, setDualMode] = useState<'diff' | 'split'>('diff');
  const overrideAction = onOverrideResponse ? (
    <OverrideBodyButton
      label="Override Response"
      title="Create a rule that serves this response as an editable mock"
      onClick={onOverrideResponse}
    />
  ) : undefined;

  const servedPane = (
    <BodyStateView
      state={servedState}
      declaredMime={declaredMime}
      searchHighlight={searchHighlight}
      searchMatchIndex={searchMatchIndex}
      toolbarAction={overrideAction}
      fallbackByteCount={fallbackBytes}
    />
  );

  // Two-sided: a network-source rule served a modified body over a real reply.
  // Show the real server response against the actual one — the original pane
  // is read-only (no Override CTA).
  const original = lc.responseOverride?.original;
  if (original) {
    const originalState = classifyResponseSnapshot(original);
    const canDiff = servedState.kind === 'text' && originalState.kind === 'text';
    const showDiff = canDiff && dualMode === 'diff';

    const splitView = (
      <SplitBodyView
        startLabel="Modified · Open Headers"
        start={servedPane}
        endLabel="Original · server"
        end={
          <BodyStateView
            state={originalState}
            declaredMime={snapshotMime(original) || declaredMime}
            fallbackByteCount={fallbackBytes}
          />
        }
      />
    );

    return (
      <div className="dt-body-dual">
        {showDiff && servedState.kind === 'text' && originalState.kind === 'text' ? (
          <Suspense fallback={<Skeleton />}>
            <DiffBodyView
              original={originalState.content}
              modified={servedState.content}
              declaredMime={snapshotMime(original) || declaredMime}
            />
          </Suspense>
        ) : (
          splitView
        )}
        {/* Bottom bar — matches the panel's other body toolbars. */}
        {canDiff && (
          <div className="dt-body-dual-bar">
            <div className="dt-response-toolbar-modes">
              <button
                type="button"
                className={`dt-response-toolbar-btn ${showDiff ? 'active' : ''}`}
                onClick={() => setDualMode('diff')}
              >
                Diff
              </button>
              <button
                type="button"
                className={`dt-response-toolbar-btn ${showDiff ? '' : 'active'}`}
                onClick={() => setDualMode('split')}
              >
                Full response
              </button>
            </div>
            {/* In full-response mode the CTA lives in the modified pane's
                own bottom toolbar; the diff view has no per-pane toolbar,
                so it surfaces here instead. */}
            {showDiff && overrideAction && (
              <>
                <span className="dt-toolbar-divider" aria-hidden="true" />
                {overrideAction}
              </>
            )}
          </div>
        )}
      </div>
    );
  }

  return servedPane;
}
