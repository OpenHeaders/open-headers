import type { ResponseRuleDraft, Rule } from '@openheaders/core/types';
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
import { useRulePopover } from './RulePopoverHost';

// Lazy: keeps Monaco's diff bundle out of the panel's initial chunk —
// it only loads when a two-sided override is actually inspected.
const DiffBodyView = lazy(() => import('./detail/DiffBodyView'));

interface ResponseBodyViewProps {
  row: InspectorRowWithFires;
  searchHighlight?: string;
  searchLineNumber?: number;
  /** N-th occurrence of `searchHighlight` in this body (0-based). */
  searchMatchIndex?: number;
  /** Build the captured-response draft the create popover (and its
   *  workbench handoff) seeds from. */
  buildOverrideDraft?: () => ResponseRuleDraft;
  /** Live response rule that fired on this request — flips the CTA
   *  from "Override Response" (create) to "Edit override" (quick-edit
   *  popover targeting this rule). */
  firedResponseRule?: Rule | null;
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
export function ResponseBodyView({
  row,
  searchHighlight,
  searchMatchIndex,
  buildOverrideDraft,
  firedResponseRule,
}: ResponseBodyViewProps) {
  const rulePopover = useRulePopover();
  const lc = row.lifecycle;
  const declaredMime = lifecycleMimeType(lc) ?? currentHarEntry(lc)?.response?.content?.mimeType ?? '';
  const servedState = useMemo(() => classifyBodyState(lc), [lc]);
  const fallbackBytes = lifecycleTransferredBytes(lc) ?? 0;
  const [dualMode, setDualMode] = useState<'diff' | 'split'>('diff');
  // When a response rule fired on this request, the CTA edits THAT rule
  // in place (pinned quick-editor popover — Save affects the next
  // requests) instead of scaffolding a second rule over it. Otherwise
  // the CTA opens the same popover in create mode, seeded from the
  // captured response.
  const overrideAction = firedResponseRule ? (
    <OverrideBodyButton
      label="Edit override"
      title="Edit the rule that produced this response — changes apply to future requests"
      onClick={(e) => rulePopover.open({ anchorEl: e.currentTarget, rule: firedResponseRule }, { pinned: true })}
    />
  ) : buildOverrideDraft ? (
    <OverrideBodyButton
      label="Override Response"
      title="Create a rule that serves this response as an editable mock"
      onClick={(e) =>
        rulePopover.open(
          { mode: 'create-response', anchorEl: e.currentTarget, draft: buildOverrideDraft(), requestId: lc.requestId },
          { pinned: true },
        )
      }
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
  // Show the real server response against the modified one — the original pane
  // is read-only (no Override CTA). One bottom row everywhere: in diff mode
  // DiffBodyView renders the bar (modes + hide-unchanged + CTA); in
  // full-response mode the mode buttons ride along in the modified pane's own
  // toolbar instead of adding a second row.
  const original = lc.responseOverride?.original;
  if (original) {
    const originalState = classifyResponseSnapshot(original);
    const canDiff = servedState.kind === 'text' && originalState.kind === 'text';
    const showDiff = canDiff && dualMode === 'diff';

    const modeButtons = canDiff ? (
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
    ) : null;

    if (showDiff && servedState.kind === 'text' && originalState.kind === 'text') {
      return (
        <div className="dt-body-dual">
          <Suspense fallback={<Skeleton />}>
            <DiffBodyView
              original={originalState.content}
              modified={servedState.content}
              declaredMime={snapshotMime(original) || declaredMime}
              modeButtons={modeButtons}
              overrideAction={overrideAction}
            />
          </Suspense>
        </div>
      );
    }

    return (
      <SplitBodyView
        startLabel="Modified · Open Headers"
        start={
          <BodyStateView
            state={servedState}
            declaredMime={declaredMime}
            searchHighlight={searchHighlight}
            searchMatchIndex={searchMatchIndex}
            toolbarAction={
              modeButtons ? (
                <>
                  {modeButtons}
                  {overrideAction && (
                    <>
                      <span className="dt-toolbar-divider" aria-hidden="true" />
                      {overrideAction}
                    </>
                  )}
                </>
              ) : (
                overrideAction
              )
            }
            fallbackByteCount={fallbackBytes}
          />
        }
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
  }

  return servedPane;
}
