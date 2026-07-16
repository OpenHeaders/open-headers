import type { ResponseRuleDraft, Rule } from '@openheaders/core/types';
import { useT } from '@openheaders/ui/context/LocaleContext';
import { lazy, Suspense, useMemo, useState } from 'react';
import {
  currentHarEntry,
  type InspectorRowWithFires,
  lifecycleMimeType,
  lifecycleTransferredBytes,
} from '../data/inspector-row-projection';
import { classifyBodyState, classifyResponseSnapshot, snapshotMime } from '../data/response-body-state';
import BodyStateView from './detail/BodyStateView';
import { type DualMode, DualModeButtons, SwapSidesButton } from './detail/DualViewControls';
import OverrideBodyButton from './detail/OverrideBodyButton';
import { overrideLabels } from './detail/override-labels';
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
  const t = useT();
  const labels = useMemo(() => overrideLabels(t), [t]);
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
      label={t('panel.inspector.overrideCta.editOverride')}
      title={t('panel.inspector.overrideCta.editOverrideTitle')}
      onClick={(e) => rulePopover.open({ anchorEl: e.currentTarget, rule: firedResponseRule }, { pinned: true })}
    />
  ) : buildOverrideDraft ? (
    <OverrideBodyButton
      label={t('panel.inspector.overrideCta.overrideResponse')}
      title={t('panel.inspector.overrideCta.overrideResponseTitle')}
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
  // buttons pinned to the view's far right (DiffBodyView's bar right-aligns
  // them; the split carries them in whichever pane sits rightmost) and the
  // swap-sides control riding the caption row, next to the titles it flips.
  // The diff defaults to the standard original-left convention; the split
  // leads with the modified body; the swap control flips either.
  const original = lc.responseOverride?.original;
  if (original) {
    const originalState = classifyResponseSnapshot(original);
    const canDiff = servedState.kind === 'text' && originalState.kind === 'text';
    const showDiff = canDiff && dualMode === 'diff';

    const onSwapSides = () => setSwapped((s) => !s);
    const modeButtons = canDiff ? (
      <DualModeButtons
        mode={dualMode}
        onModeChange={setDualMode}
        splitModeLabel={t('panel.inspector.dualView.fullResponse')}
      />
    ) : undefined;

    if (showDiff && servedState.kind === 'text' && originalState.kind === 'text') {
      const sides = swapped
        ? {
            original: servedState.content,
            modified: originalState.content,
            originalLabel: labels.responseModified,
            modifiedLabel: labels.responseOriginal,
          }
        : {
            original: originalState.content,
            modified: servedState.content,
            originalLabel: labels.responseOriginal,
            modifiedLabel: labels.responseModified,
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
              controls={modeButtons}
              onSwapSides={onSwapSides}
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
        toolbarTrailing={rightmost ? modeButtons : undefined}
        fallbackByteCount={fallbackBytes}
      />
    );
    const originalPane = (rightmost: boolean) => (
      <BodyStateView
        state={originalState}
        declaredMime={snapshotMime(original) || declaredMime}
        toolbarTrailing={rightmost ? modeButtons : undefined}
        fallbackByteCount={fallbackBytes}
      />
    );

    return swapped ? (
      <SplitBodyView
        startLabel={labels.responseOriginal}
        start={originalPane(false)}
        endLabel={labels.responseModified}
        end={modifiedPane(true)}
        headerAction={<SwapSidesButton onSwap={onSwapSides} />}
      />
    ) : (
      <SplitBodyView
        startLabel={labels.responseModified}
        start={modifiedPane(false)}
        endLabel={labels.responseOriginal}
        end={originalPane(true)}
        headerAction={<SwapSidesButton onSwap={onSwapSides} />}
      />
    );
  }

  return servedPane;
}
