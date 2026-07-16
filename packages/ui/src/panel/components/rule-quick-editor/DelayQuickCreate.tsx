/**
 * DelayQuickCreate — the delay create-mode body of the shared
 * `QuickEditorShell`. Opened from the Headers tab's "Delay request"
 * CTA. Save mints the rule AND publishes it in one gesture into the
 * workspace's first collection; the footer link hands the CURRENT
 * draft state off to the workbench for full options.
 */

import type { DelayRuleDraft } from '@openheaders/core/types';
import { useT } from '@openheaders/ui/context/LocaleContext';
import { stableStringify } from '@openheaders/ui/shared/forms';
import { useActiveWorkspaceId } from '@openheaders/ui/shared/hooks/readers/useActiveWorkspaceId';
import { useRuleMutator } from '@openheaders/ui/shared/hooks/mutators/useRuleMutator';
import { useRules } from '@openheaders/ui/shared/hooks/readers/useRules';
import { useSettingValue } from '@openheaders/ui/workbench/settings/hooks';
import { App, InputNumber, Typography, theme } from 'antd';
import { useRef, useState } from 'react';
import { handOffRuleDraft } from '../../data/rule-create/rule-draft-bridge';
import { generateSmartRuleName } from '../../data/rule-create/smart-rule-name';
import {
  buildDelayRuleSeed,
  type DelayQuickDraft,
  mergeQuickIntoDelayDraft,
  seedDelayQuickDraft,
} from '../../data/rule-create/url-rule-create';
import { QuickConditionsRow } from './QuickConditionsRow';
import { QuickDestinationRow } from './QuickDestinationRow';
import { QuickEditorShell } from './QuickEditorShell';
import { useQuickCreateConditions } from './use-quick-create-conditions';
import { useQuickCreateDestination } from './use-quick-create-destination';
import { useQuickCreateSave } from './use-quick-create-save';

const { Text } = Typography;

export interface DelayQuickCreateProps {
  anchorEl: HTMLElement;
  /** Captured-request draft built by the CTA (`rule-draft-bridge`). */
  draft: DelayRuleDraft;
  onClose: () => void;
  onMouseEnter?: () => void;
  onMouseLeave?: (e: React.MouseEvent) => void;
  visible?: boolean;
}

export function DelayQuickCreate({
  anchorEl,
  draft,
  onClose,
  onMouseEnter,
  onMouseLeave,
  visible = true,
}: DelayQuickCreateProps) {
  const { token } = theme.useToken();
  const { message } = App.useApp();
  const t = useT();
  const workspaceId = useActiveWorkspaceId();
  const mutator = useRuleMutator({ workspaceId, surfaceId: 'devpanel' });
  const { rules } = useRules();
  const strategy = useSettingValue('rulesEngine.draftUrlStrategy');

  // Pre-filled from the capture; editable via the shell's title.
  const [name, setName] = useState(() => generateSmartRuleName({ kind: 'delay', url: draft.url ?? '' }, rules));
  const [seed] = useState<DelayQuickDraft>(() => seedDelayQuickDraft(draft));
  const [quick, setQuick] = useState<DelayQuickDraft>(seed);
  const quickRef = useRef(quick);
  quickRef.current = quick;
  const quickDirty = stableStringify(quick) !== stableStringify(seed);

  const cond = useQuickCreateConditions(draft, strategy);
  const isDirty = quickDirty || cond.isDirty;

  const dest = useQuickCreateDestination(draft.url);

  const delayMs = quick.delayMs;
  const { saving, canSave, handleSave, saveLabel } = useQuickCreateSave({
    // The gate guarantees delayMs is set when Save is reachable; the
    // fallback only satisfies the narrower builder signature.
    buildSeed: () => buildDelayRuleSeed(quickRef.current.delayMs ?? 1000, name, cond.conditionsRef.current),
    destination: dest.forSave,
    workspaceId,
    // min 1: a 0ms delay makes the rule a no-op (the compiler skips
    // `delayMs === 0`), so it would save but never fire.
    valid: delayMs != null && delayMs >= 1,
    mutator,
    message,
    onClose,
  });

  const openInEditor = () => {
    void handOffRuleDraft(mergeQuickIntoDelayDraft(draft, quickRef.current))
      .then(() => onClose())
      .catch((err: Error) => message.error(err.message));
  };

  return (
    <QuickEditorShell
      anchorEl={anchorEl}
      liveRule={null}
      ruleType="delay"
      ruleName={name}
      onRuleNameChange={setName}
      liveRuleUid={null}
      isDirty={isDirty}
      destination={<QuickDestinationRow api={dest} />}
      conditions={<QuickConditionsRow value={cond.conditions} onChange={cond.setConditions} />}
      onOpenInEditor={openInEditor}
      canOpenInEditor
      save={{ saving, canSave, saveLabel, onSave: () => void handleSave() }}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      visible={visible}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <Text type="secondary" style={{ fontSize: 12, whiteSpace: 'nowrap' }}>
          {t('workbench.editors.rule.fields.delay.label')}
        </Text>
        <InputNumber
          size="small"
          min={1}
          max={30000}
          step={100}
          addonAfter="ms"
          style={{ width: 160 }}
          placeholder="1000"
          value={quick.delayMs}
          onChange={(v) => setQuick({ delayMs: v })}
        />
        <Text type="secondary" style={{ fontSize: 11 }}>
          {t('workbench.editors.rule.fields.delay.maxNote')}
        </Text>
      </div>
      <div style={{ marginTop: 6, fontSize: 11, color: token.colorTextTertiary, lineHeight: 1.4 }}>
        {t('panel.quickEditor.delay.hint')}
      </div>
    </QuickEditorShell>
  );
}
