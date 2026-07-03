/**
 * BlockQuickCreate — the block create-mode body of the shared
 * `QuickEditorShell`. Opened from the Headers tab's "Cancel request"
 * CTA. Block rules carry no action configuration — the block itself is
 * the action — so the body is a fields-less confirm showing what the
 * rule will match; Save mints AND publishes it in one gesture. The
 * footer link hands the draft off to the workbench for condition edits.
 */

import { StopOutlined } from '@ant-design/icons';
import type { BlockRuleDraft } from '@openheaders/core/types';
import { useActiveWorkspaceId } from '@openheaders/ui/shared/hooks/useActiveWorkspaceId';
import { useRuleMutator } from '@openheaders/ui/shared/hooks/useRuleMutator';
import { useRules } from '@openheaders/ui/shared/hooks/useRules';
import { useSettingValue } from '@openheaders/ui/workbench/settings/hooks';
import { App, Typography, theme } from 'antd';
import { useState } from 'react';
import { handOffRuleDraft } from '../../data/rule-draft-bridge';
import { generateSmartRuleName } from '../../data/smart-rule-name';
import { buildBlockRuleSeed } from '../../data/url-rule-create';
import { QuickEditorShell } from './QuickEditorShell';
import { useQuickCreateSave } from './use-quick-create-save';

const { Text } = Typography;

export interface BlockQuickCreateProps {
  anchorEl: HTMLElement;
  /** Captured-request draft built by the CTA (`rule-draft-bridge`). */
  draft: BlockRuleDraft;
  onClose: () => void;
  onMouseEnter?: () => void;
  onMouseLeave?: (e: React.MouseEvent) => void;
  visible?: boolean;
}

export function BlockQuickCreate({
  anchorEl,
  draft,
  onClose,
  onMouseEnter,
  onMouseLeave,
  visible = true,
}: BlockQuickCreateProps) {
  const { token } = theme.useToken();
  const { message } = App.useApp();
  const workspaceId = useActiveWorkspaceId();
  const mutator = useRuleMutator({ workspaceId, surfaceId: 'devpanel' });
  const { rules, localCollections } = useRules();
  const strategy = useSettingValue('rulesEngine.draftUrlStrategy');

  // Pre-filled from the capture; editable via the shell's title.
  const [name, setName] = useState(() => generateSmartRuleName({ kind: 'block', url: draft.url ?? '' }, rules));

  // Context-less create falls back to the first collection — the same
  // fallback `useTabOpeners.openCreateTab` applies in the workbench.
  const parentPath = localCollections[0]?.path ?? null;

  const { saving, canSave, handleSave, saveLabel } = useQuickCreateSave({
    buildSeed: () => buildBlockRuleSeed(draft, name, strategy),
    parentPath,
    workspaceId,
    mutator,
    message,
    onClose,
  });

  const openInEditor = () => {
    void handOffRuleDraft(draft)
      .then(() => onClose())
      .catch((err: Error) => message.error(err.message));
  };

  return (
    <QuickEditorShell
      anchorEl={anchorEl}
      liveRule={null}
      ruleType="block"
      ruleName={name}
      onRuleNameChange={setName}
      liveRuleUid={null}
      isDirty={false}
      onOpenInEditor={openInEditor}
      canOpenInEditor
      save={{ saving, canSave, saveLabel, onSave: () => void handleSave() }}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      visible={visible}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'flex-start',
          gap: 10,
          padding: '10px 12px',
          borderRadius: token.borderRadius,
          border: `1px solid ${token.colorBorderSecondary}`,
          background: token.colorFillQuaternary,
        }}
      >
        <StopOutlined style={{ color: token.colorTextTertiary, fontSize: 14, marginTop: 2 }} />
        <div style={{ minWidth: 0 }}>
          <Text strong style={{ fontSize: 12, display: 'block', marginBottom: 2 }}>
            Block requests to
          </Text>
          <Text
            style={{ fontSize: 11, fontFamily: token.fontFamilyCode, wordBreak: 'break-all', display: 'block' }}
          >
            {draft.url}
          </Text>
          <Text type="secondary" style={{ fontSize: 11, lineHeight: 1.5 }}>
            Matching requests are canceled before they leave the browser — the page sees a network error.
          </Text>
        </div>
      </div>
    </QuickEditorShell>
  );
}
