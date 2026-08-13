/**
 * RedirectQuickCreate — the redirect create-mode body of the shared
 * `QuickEditorShell`. Opened from the Headers tab's `Redirect ▾` menu —
 * the variants (Redirect URL / Replace host / Point to localhost)
 * differ only in the seeded target (`url-rule-create`). Save mints the rule AND
 * publishes it in one gesture into the workspace's first collection;
 * the footer link hands the CURRENT draft state off to the workbench
 * for full options (regex conditions, local-file target, …).
 */

import type { RedirectRuleDraft } from '@openheaders/core/types';
import { stableStringify } from '@openheaders/ui/shared/forms';
import { useT } from '@openheaders/ui/context/LocaleContext';
import { useActiveWorkspaceId } from '@openheaders/ui/shared/hooks/readers/useActiveWorkspaceId';
import { useRuleMutator } from '@openheaders/ui/shared/hooks/mutators/useRuleMutator';
import { useRules } from '@openheaders/ui/shared/hooks/readers/useRules';
import { useVariableResolver } from '@openheaders/ui/shared/hooks/variables/useVariableResolver';
import { DetectedValueInput } from '@openheaders/ui/workbench/components/value-editors';
import { useSettingValue } from '@openheaders/ui/workbench/settings/hooks';
import { App, Typography, theme } from 'antd';
import { useMemo, useRef, useState } from 'react';
import { handOffRuleDraft } from '../../data/rule-create/rule-draft-bridge';
import { generateSmartRuleName } from '../../data/rule-create/smart-rule-name';
import {
  buildRedirectRuleSeed,
  mergeQuickIntoRedirectDraft,
  type RedirectCreateVariant,
  type RedirectQuickDraft,
  seedRedirectQuickDraft,
  type UrlCreateVariant,
} from '../../data/rule-create/url-rule-create';
import { QuickConditionsRow } from './QuickConditionsRow';
import { QuickDestinationRow } from './QuickDestinationRow';
import { QuickEditorShell } from './QuickEditorShell';
import { useQuickCreateConditions } from './use-quick-create-conditions';
import { useQuickCreateDestination } from './use-quick-create-destination';
import { useQuickCreateSave } from './use-quick-create-save';

const { Text } = Typography;

export interface RedirectQuickCreateProps {
  anchorEl: HTMLElement;
  /** Captured-request draft built by the CTA (`rule-draft-bridge`). */
  draft: RedirectRuleDraft;
  /** Which CTA opened the session — names the rule per-variant. */
  variant: UrlCreateVariant;
  onClose: () => void;
  onMouseEnter?: () => void;
  onMouseLeave?: (e: React.MouseEvent) => void;
  visible?: boolean;
}

export function RedirectQuickCreate({
  anchorEl,
  draft,
  variant,
  onClose,
  onMouseEnter,
  onMouseLeave,
  visible = true,
}: RedirectQuickCreateProps) {
  const { token } = theme.useToken();
  const { message } = App.useApp();
  const t = useT();
  const workspaceId = useActiveWorkspaceId();
  const mutator = useRuleMutator({ workspaceId, surfaceId: 'devpanel', createOrigin: 'quick-editor' });
  const { rules } = useRules();
  const strategy = useSettingValue('rulesEngine.draftUrlStrategy');

  const redirectVariant: RedirectCreateVariant =
    variant === 'replace-host' || variant === 'localhost' ? variant : 'redirect';

  // Pre-filled from the capture; editable via the shell's title.
  const [name, setName] = useState(() =>
    generateSmartRuleName({ kind: redirectVariant, url: draft.url ?? '' }, rules),
  );
  const [seed] = useState<RedirectQuickDraft>(() => seedRedirectQuickDraft(draft, redirectVariant));
  const [quick, setQuick] = useState<RedirectQuickDraft>(seed);
  const quickRef = useRef(quick);
  quickRef.current = quick;
  const quickDirty = stableStringify(quick) !== stableStringify(seed);

  const cond = useQuickCreateConditions(draft, strategy);
  const isDirty = quickDirty || cond.isDirty;

  const dest = useQuickCreateDestination(draft.url);
  const collectionId = dest.collectionId;

  // A target that doesn't resolve — the seeded `{{redirect_url_<domain>}}`
  // before its variable exists, or any typed unresolved ref — gates Save:
  // a published redirect with an unresolvable template would silently
  // never fire, the worst outcome. The reference's create flow (click
  // the red token / Enter inside it) lifts the gate live.
  const resolver = useVariableResolver();
  const trimmedTarget = quick.redirectTo.trim();
  const targetResolves = useMemo(() => {
    if (!trimmedTarget) return false;
    const context = collectionId ? { collectionId } : undefined;
    return resolver.resolveTemplate(trimmedTarget, context).errors.length === 0;
  }, [resolver, trimmedTarget, collectionId]);

  const { saving, canSave, handleSave, saveLabel } = useQuickCreateSave({
    buildSeed: () => buildRedirectRuleSeed(quickRef.current, name, cond.conditionsRef.current),
    destination: dest.forSave,
    workspaceId,
    valid: targetResolves,
    mutator,
    message,
    onClose,
  });

  const openInEditor = () => {
    void handOffRuleDraft(mergeQuickIntoRedirectDraft(draft, quickRef.current))
      .then(() => onClose())
      .catch((err: Error) => message.error(err.message));
  };

  return (
    <QuickEditorShell
      anchorEl={anchorEl}
      liveRule={null}
      ruleType="redirect"
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
      <Text type="secondary" style={{ fontSize: 12, display: 'block', marginBottom: 6 }}>
        {t('workbench.editors.rule.fields.redirect.redirectsTo')}
      </Text>
      <div style={{ width: '100%', minWidth: 0 }}>
        <DetectedValueInput
          editorVariant="compact"
          size="small"
          wrap
          maxRows={4}
          resizable
          allowClear
          value={quick.redirectTo}
          onChange={(v) => setQuick({ redirectTo: v })}
          placeholder={t('panel.quickEditor.redirect.targetPlaceholder')}
          suggestionContext={{ collectionId }}
          flagUnresolved
          style={{ width: '100%' }}
        />
      </div>
      {trimmedTarget && !targetResolves ? (
        <div style={{ marginTop: 6, fontSize: 11, color: token.colorWarning, lineHeight: 1.4 }}>
          {t('panel.quickEditor.variableMissing')}
        </div>
      ) : (
        <div style={{ marginTop: 6, fontSize: 11, color: token.colorTextTertiary, lineHeight: 1.4 }}>
          {t('panel.quickEditor.redirect.hint')}
        </div>
      )}
    </QuickEditorShell>
  );
}
