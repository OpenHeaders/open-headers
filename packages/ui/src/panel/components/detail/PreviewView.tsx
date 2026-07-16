import type { ResponseRuleDraft, Rule } from '@openheaders/core/types';
import { useT } from '@openheaders/ui/context/LocaleContext';
import { useMemo, useState } from 'react';
import { currentHarEntry, type InspectorRowWithFires, lifecycleMimeType, lifecycleTransferredBytes } from '../../data/inspector-row-projection';
import { classifyBodyState, classifyResponseSnapshot, snapshotMime } from '../../data/response-body-state';
import { useRulePopover } from '../RulePopoverHost';
import { SwapSidesButton } from './DualViewControls';
import OverrideBodyButton from './OverrideBodyButton';
import { overrideLabels } from './override-labels';
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
  const t = useT();
  const labels = useMemo(() => overrideLabels(t), [t]);
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
  ) : null;

  const servedPane = <PreviewPane state={servedState} mime={mime} size={size} action={overrideButton} />;

  // Two-sided: modified leads by default, and the swap-sides control rides
  // the caption row next to the titles it flips (same as the Response tab).
  const original = lc.responseOverride?.original;
  if (original) {
    const originalMime = snapshotMime(original) || mime;
    const headerAction = <SwapSidesButton onSwap={() => setSwapped((s) => !s)} />;
    const originalPane = <PreviewPane state={classifyResponseSnapshot(original)} mime={originalMime} size={size} />;
    return swapped ? (
      <SplitBodyView
        startLabel={labels.responseOriginal}
        start={originalPane}
        endLabel={labels.responseModified}
        end={servedPane}
        headerAction={headerAction}
      />
    ) : (
      <SplitBodyView
        startLabel={labels.responseModified}
        start={servedPane}
        endLabel={labels.responseOriginal}
        end={originalPane}
        headerAction={headerAction}
      />
    );
  }

  return servedPane;
}
