/**
 * RequestBodyQuickCreate — the request-body create-mode body of the
 * shared `QuickEditorShell`. Opened from the Payload tab's "Override
 * request body" CTA, pre-filled with the captured outgoing body
 * (`rule-draft-bridge`). Same shape as the response create body minus
 * status/content-type — a request body carries neither. Save mints the
 * rule AND publishes it in one gesture into the workspace's first
 * collection; the footer link hands the CURRENT draft state off to the
 * workbench for full options (dynamic body, GraphQL filter, …).
 */

import type { RequestBodyRuleDraft } from '@openheaders/core/types';
import { stableStringify } from '@openheaders/ui/shared/forms';
import { useActiveWorkspaceId } from '@openheaders/ui/shared/hooks/readers/useActiveWorkspaceId';
import { useRuleMutator } from '@openheaders/ui/shared/hooks/mutators/useRuleMutator';
import { useRules } from '@openheaders/ui/shared/hooks/readers/useRules';
import { TemplateInput } from '@openheaders/ui/workbench/components/template-input';
import { useSettingValue } from '@openheaders/ui/workbench/settings/hooks';
import { App, Tag, theme } from 'antd';
import { useRef, useState } from 'react';
import {
  buildRequestBodyRuleSeed,
  mergeQuickIntoRequestBodyDraft,
  type RequestBodyQuickDraft,
  seedRequestBodyQuickDraft,
} from '../../data/rule-create/payload-rule-create';
import { handOffRuleDraft } from '../../data/rule-create/rule-draft-bridge';
import { generateSmartRuleName } from '../../data/rule-create/smart-rule-name';
import { QuickDestinationRow } from './QuickDestinationRow';
import { QuickEditorShell } from './QuickEditorShell';
import { useQuickCreateDestination } from './use-quick-create-destination';
import { useQuickCreateSave } from './use-quick-create-save';

export interface RequestBodyQuickCreateProps {
  anchorEl: HTMLElement;
  /** Captured-request draft built by the CTA (`rule-draft-bridge`). */
  draft: RequestBodyRuleDraft;
  onClose: () => void;
  onMouseEnter?: () => void;
  onMouseLeave?: (e: React.MouseEvent) => void;
  visible?: boolean;
}

export function RequestBodyQuickCreate({
  anchorEl,
  draft,
  onClose,
  onMouseEnter,
  onMouseLeave,
  visible = true,
}: RequestBodyQuickCreateProps) {
  const { token } = theme.useToken();
  const { message } = App.useApp();
  const workspaceId = useActiveWorkspaceId();
  const mutator = useRuleMutator({ workspaceId, surfaceId: 'devpanel' });
  const { rules } = useRules();
  const strategy = useSettingValue('rulesEngine.draftUrlStrategy');

  // Pre-filled from the capture; editable via the shell's title.
  const [name, setName] = useState(() => generateSmartRuleName({ kind: 'request-body', url: draft.url ?? '' }, rules));
  const [seed] = useState<RequestBodyQuickDraft>(() => seedRequestBodyQuickDraft(draft));
  const [quick, setQuick] = useState<RequestBodyQuickDraft>(seed);
  const quickRef = useRef(quick);
  quickRef.current = quick;
  const isDirty = stableStringify(quick) !== stableStringify(seed);

  const dest = useQuickCreateDestination(draft.url);
  const collectionId = dest.collectionId;

  const { saving, canSave, handleSave, saveLabel } = useQuickCreateSave({
    buildSeed: () => buildRequestBodyRuleSeed(draft, quickRef.current, name, strategy),
    destination: dest.forSave,
    workspaceId,
    mutator,
    message,
    onClose,
  });

  const openInEditor = () => {
    void handOffRuleDraft(mergeQuickIntoRequestBodyDraft(draft, quickRef.current))
      .then(() => onClose())
      .catch((err: Error) => message.error(err.message));
  };

  const fieldLabelStyle: React.CSSProperties = {
    fontSize: 10,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
    color: token.colorTextTertiary,
    marginBottom: 2,
  };

  return (
    <QuickEditorShell
      anchorEl={anchorEl}
      liveRule={null}
      ruleType="request-body"
      ruleName={name}
      onRuleNameChange={setName}
      liveRuleUid={null}
      isDirty={isDirty}
      destination={<QuickDestinationRow api={dest} />}
      tags={
        draft.resourceType === 'graphql' ? (
          <Tag style={{ marginInlineEnd: 0, fontSize: 10 }} color="purple">
            GraphQL
          </Tag>
        ) : undefined
      }
      onOpenInEditor={openInEditor}
      canOpenInEditor
      save={{ saving, canSave, saveLabel, onSave: () => void handleSave() }}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      visible={visible}
    >
      <div style={fieldLabelStyle}>Request Body</div>
      <TemplateInput
        multiline
        maxRows={12}
        resizable
        allowClear
        value={quick.requestBody}
        onChange={(v) => setQuick({ requestBody: v })}
        placeholder={'{"query": "…", "variables": {}}'}
        suggestionContext={{ collectionId }}
        style={{
          width: '100%',
          minHeight: 120,
          fontFamily: token.fontFamilyCode,
          fontSize: 12,
        }}
      />
      <div style={{ marginTop: 6, fontSize: 11, color: token.colorTextTertiary, lineHeight: 1.4 }}>
        Matching requests are sent with this body instead of the page's.
      </div>
    </QuickEditorShell>
  );
}
