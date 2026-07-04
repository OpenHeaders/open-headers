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
import DualViewControls, { type DualMode } from './detail/DualViewControls';
import OverrideBodyButton from './detail/OverrideBodyButton';
import { RESPONSE_MODIFIED_LABEL, RESPONSE_ORIGINAL_LABEL } from './detail/override-labels';
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
  const [dualMode, setDualMode] = useState<DualMode>('diff');
  const [swapped, setSwapped] = useState(false);
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
  // is read-only (no Override CTA). One bottom row everywhere, with the mode
  // buttons + swap-sides control pinned to the view's far right in both modes:
  // DiffBodyView's bar right-aligns them, and the split view carries them in
  // whichever pane sits rightmost. The diff defaults to the standard
  // original-left convention; the split leads with the modified body; the
  // swap control flips either.
  const original = lc.responseOverride?.original;
  if (original) {
    const originalState = classifyResponseSnapshot(original);
    const canDiff = servedState.kind === 'text' && originalState.kind === 'text';
    const showDiff = canDiff && dualMode === 'diff';

    const controls = (
      <DualViewControls
        mode={canDiff ? dualMode : undefined}
        onModeChange={canDiff ? setDualMode : undefined}
        splitModeLabel="Full response"
        onSwapSides={() => setSwapped((s) => !s)}
      />
    );

    if (showDiff && servedState.kind === 'text' && originalState.kind === 'text') {
      const sides = swapped
        ? {
            original: servedState.content,
            modified: originalState.content,
            originalLabel: RESPONSE_MODIFIED_LABEL,
            modifiedLabel: RESPONSE_ORIGINAL_LABEL,
          }
        : {
            original: originalState.content,
            modified: servedState.content,
            originalLabel: RESPONSE_ORIGINAL_LABEL,
            modifiedLabel: RESPONSE_MODIFIED_LABEL,
          };
      return (
        <div className="dt-body-dual">
          <Suspense fallback={<Skeleton />}>
            <DiffBodyView
              original={sides.original}
              modified={sides.modified}
              originalLabel={sides.originalLabel}
              modifiedLabel={sides.modifiedLabel}
              declaredMime={snapshotMime(original) || declaredMime}
              controls={controls}
              overrideAction={overrideAction}
            />
          </Suspense>
        </div>
      );
    }

    const modifiedPane = (rightmost: boolean) => (
      <BodyStateView
        state={servedState}
        declaredMime={declaredMime}
        searchHighlight={searchHighlight}
        searchMatchIndex={searchMatchIndex}
        toolbarAction={overrideAction}
        toolbarTrailing={rightmost ? controls : undefined}
        fallbackByteCount={fallbackBytes}
      />
    );
    const originalPane = (rightmost: boolean) => (
      <BodyStateView
        state={originalState}
        declaredMime={snapshotMime(original) || declaredMime}
        toolbarTrailing={rightmost ? controls : undefined}
        fallbackByteCount={fallbackBytes}
      />
    );

    return swapped ? (
      <SplitBodyView
        startLabel={RESPONSE_ORIGINAL_LABEL}
        start={originalPane(false)}
        endLabel={RESPONSE_MODIFIED_LABEL}
        end={modifiedPane(true)}
      />
    ) : (
      <SplitBodyView
        startLabel={RESPONSE_MODIFIED_LABEL}
        start={modifiedPane(false)}
        endLabel={RESPONSE_ORIGINAL_LABEL}
        end={originalPane(true)}
      />
    );
  }

  return servedPane;
}
