/**
 * RedirectQuickCreate — the redirect create-mode body of the shared
 * `QuickEditorShell`. Opened from the Headers tab's Redirect URL /
 * Replace host / Replace URL part CTAs — the three variants differ only
 * in the seeded target (`rule-draft-bridge`). Save mints the rule AND
 * publishes it in one gesture into the workspace's first collection;
 * the footer link hands the CURRENT draft state off to the workbench
 * for full options (regex conditions, local-file target, …).
 */

import type { RedirectRuleDraft } from '@openheaders/core/types';
import { stableStringify } from '@openheaders/ui/shared/forms';
import { useActiveWorkspaceId } from '@openheaders/ui/shared/hooks/useActiveWorkspaceId';
import { useRuleMutator } from '@openheaders/ui/shared/hooks/useRuleMutator';
import { useRules } from '@openheaders/ui/shared/hooks/useRules';
import { TemplateInput } from '@openheaders/ui/workbench/components/template-input';
import { useSettingValue } from '@openheaders/ui/workbench/settings/hooks';
import { App, Typography, theme } from 'antd';
import { useRef, useState } from 'react';
import { handOffRuleDraft } from '../../data/rule-draft-bridge';
import { generateSmartRuleName } from '../../data/smart-rule-name';
import {
  buildRedirectRuleSeed,
  mergeQuickIntoRedirectDraft,
  type RedirectQuickDraft,
  seedRedirectQuickDraft,
  type UrlCreateVariant,
} from '../../data/url-rule-create';
import { QuickEditorShell } from './QuickEditorShell';
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
  const workspaceId = useActiveWorkspaceId();
  const mutator = useRuleMutator({ workspaceId, surfaceId: 'devpanel' });
  const { rules, localCollections } = useRules();
  const strategy = useSettingValue('rulesEngine.draftUrlStrategy');

  // Pre-filled from the capture; editable via the shell's title.
  const [name, setName] = useState(() =>
    generateSmartRuleName(
      {
        kind: variant === 'replace-host' || variant === 'replace-url-part' ? variant : 'redirect',
        url: draft.url ?? '',
      },
      rules,
    ),
  );
  const [seed] = useState<RedirectQuickDraft>(() => seedRedirectQuickDraft(draft));
  const [quick, setQuick] = useState<RedirectQuickDraft>(seed);
  const quickRef = useRef(quick);
  quickRef.current = quick;
  const isDirty = stableStringify(quick) !== stableStringify(seed);

  // Context-less create falls back to the first collection — the same
  // fallback `useTabOpeners.openCreateTab` applies in the workbench.
  const destinationCollection = localCollections[0] ?? null;
  const parentPath = destinationCollection?.path ?? null;
  const collectionId = destinationCollection?.uid;

  const { saving, canSave, handleSave, saveLabel } = useQuickCreateSave({
    buildSeed: () => buildRedirectRuleSeed(draft, quickRef.current, name, strategy),
    parentPath,
    workspaceId,
    valid: quick.redirectTo.trim().length > 0,
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
      onOpenInEditor={openInEditor}
      canOpenInEditor
      save={{ saving, canSave, saveLabel, onSave: () => void handleSave() }}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      visible={visible}
    >
      <Text type="secondary" style={{ fontSize: 12, display: 'block', marginBottom: 6 }}>
        Redirects to
      </Text>
      <div style={{ width: '100%', minWidth: 0 }}>
        <TemplateInput
          size="small"
          multiline
          value={quick.redirectTo}
          onChange={(v) => setQuick({ redirectTo: v })}
          placeholder="e.g. https://openheaders.io/redirected"
          suggestionContext={{ collectionId }}
          style={{ width: '100%', maxHeight: 'var(--oh-multiline-cap, 96px)', minHeight: 32 }}
        />
      </div>
      <div style={{ marginTop: 6, fontSize: 11, color: token.colorTextTertiary, lineHeight: 1.4 }}>
        Matching requests are sent to this URL before they reach the network.
      </div>
    </QuickEditorShell>
  );
}
