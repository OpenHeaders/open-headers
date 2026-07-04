import type { ResponseRuleDraft, Rule } from '@openheaders/core/types';
import { useMemo, useState } from 'react';
import { currentHarEntry, type InspectorRowWithFires, lifecycleMimeType, lifecycleTransferredBytes } from '../../data/inspector-row-projection';
import { classifyBodyState, classifyResponseSnapshot, snapshotMime } from '../../data/response-body-state';
import { useRulePopover } from '../RulePopoverHost';
import DualViewControls from './DualViewControls';
import OverrideBodyButton from './OverrideBodyButton';
import { RESPONSE_MODIFIED_LABEL, RESPONSE_ORIGINAL_LABEL } from './override-labels';
import PreviewPane from './PreviewPane';
import SplitBodyView from './SplitBodyView';

interface PreviewViewProps {
  row: InspectorRowWithFires;
  /** Build the captured-response draft the create popover seeds from. */
  buildOverrideDraft?: () => ResponseRuleDraft;
  /** Live response rule that fired on this request — flips the CTA
   *  from "Override Response" (create) to "Edit override" (quick-edit
   *  popover targeting this rule). Same flip as the Response tab. */
  firedResponseRule?: Rule | null;
}

/**
 * The Preview tab — pretty-printed body the page received, and (for a
 * network-source response rule) the real server response beside it
 * (Modified | Original). The rendering lives in the shared {@link PreviewPane};
 * this component decides single-pane vs split and classifies each side.
 */
export default function PreviewView({ row, buildOverrideDraft, firedResponseRule }: PreviewViewProps) {
  const rulePopover = useRulePopover();
  const lc = row.lifecycle;
  const [swapped, setSwapped] = useState(false);
  const har = currentHarEntry(lc);
  const mime = lifecycleMimeType(lc) ?? har?.response?.content?.mimeType ?? '';
  const size = lifecycleTransferredBytes(lc) ?? har?.response?.content?.size ?? 0;
  const servedState = useMemo(() => classifyBodyState(lc), [lc]);
  // The override CTA is a rule scaffold, not a mirror of the captured response
  // — it shows in every state (even no-body ones). Same dispatch as the
  // Response tab: a fired response rule gets edited in place, otherwise the
  // create popover opens seeded from the capture.
  const overrideButton = firedResponseRule ? (
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
  ) : null;

  const servedPane = <PreviewPane state={servedState} mime={mime} size={size} action={overrideButton} />;

  // Two-sided: modified leads by default, and the swap-sides control rides
  // the rightmost pane's bottom bar (same corner as the Response tab).
  const original = lc.responseOverride?.original;
  if (original) {
    const originalMime = snapshotMime(original) || mime;
    const controls = <DualViewControls onSwapSides={() => setSwapped((s) => !s)} />;
    const modifiedPane = (rightmost: boolean) => (
      <PreviewPane
        state={servedState}
        mime={mime}
        size={size}
        action={overrideButton}
        trailing={rightmost ? controls : undefined}
      />
    );
    const originalPane = (rightmost: boolean) => (
      <PreviewPane
        state={classifyResponseSnapshot(original)}
        mime={originalMime}
        size={size}
        trailing={rightmost ? controls : undefined}
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
