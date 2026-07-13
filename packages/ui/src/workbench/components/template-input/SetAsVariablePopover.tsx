/**
 * SetAsVariablePopover — "Set as variable" from a text selection.
 *
 * The inverse of `VariableHoverPopover`'s create flow: there the
 * REFERENCE (name) is known and the user types the value; here the
 * VALUE arrives pre-filled from the selection and the user names it.
 * Shares the same scope machinery (`buildCreateOptions` /
 * `resolveCreateFlow` with no namespace lock → free "Add to" choice)
 * and the same save dispatch (`runCreate` + `surfaceResult`).
 *
 * Rendered inline by the selection context menu's host (portal to
 * `document.body`); each open gets a fresh mount so state resets
 * implicitly. Dismissal (outside click / Esc) is owned by the host.
 */

import { SaveOutlined } from '@ant-design/icons';
import type { VariableLookupResult } from '@openheaders/ui/shared/hooks/variables/useVariableLookup';
import { useVariableMutator } from '@openheaders/ui/shared/hooks/mutators/useVariableMutator';
import { useEnvVarVault } from '@openheaders/ui/shared/hooks/readers/useEnvVarVault';
import { useRules } from '@openheaders/ui/shared/hooks/readers/useRules';
import { App, Button, Dropdown, Input, type MenuProps, Tooltip, theme } from 'antd';
import type React from 'react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useT } from '@openheaders/ui/context/LocaleContext';
import { usePopoverPlacement } from '@openheaders/ui/shared/popover';
import { scopeBadge } from '../shared/scope-colors';
import TemplateInput from './TemplateInput';
import {
  buildCreateOptions,
  type CreateScope,
  createScopeToColorKey,
  labelForCreateScope,
  resolveCreateFlow,
} from './variable-popover-create-flow';
import { runCreate, surfaceResult } from './variable-popover-save';

const POPOVER_WIDTH = 380;
const NO_NAMESPACE: VariableLookupResult['namespace'] = null;

export interface SetAsVariablePopoverProps {
  anchorEl: HTMLElement;
  /** Selection text — pre-fills the value (still editable). */
  initialValue: string;
  collectionId?: string;
  onClose: () => void;
}

const SetAsVariablePopover: React.FC<SetAsVariablePopoverProps> = ({
  anchorEl,
  initialValue,
  collectionId,
  onClose,
}) => {
  const { token } = theme.useToken();
  const { message } = App.useApp();
  const t = useT();
  const { activeEnvironmentId, activeEnvironment, workspaceVariables, vault } = useEnvVarVault();
  const { localCollections } = useRules();
  const mutator = useVariableMutator();

  const { position, popoverRef, measured } = usePopoverPlacement(anchorEl, POPOVER_WIDTH);
  const [name, setName] = useState('');
  const [value, setValue] = useState(initialValue);
  const [addTo, setAddTo] = useState<CreateScope | null>(null);
  const [saving, setSaving] = useState(false);
  const nameRef = useRef<import('antd').InputRef | null>(null);

  useEffect(() => {
    if (!measured) return;
    nameRef.current?.focus();
  }, [measured]);

  const createOptions = useMemo(
    () => buildCreateOptions(NO_NAMESPACE, !!activeEnvironmentId, !!collectionId, t),
    [activeEnvironmentId, collectionId, t],
  );
  const createFlow = resolveCreateFlow(null, addTo, createOptions);
  const effectiveAddTo = createFlow.scope;

  const canSave = name.trim().length > 0 && !!effectiveAddTo && !saving;

  const handleSave = async () => {
    if (!effectiveAddTo) return;
    setSaving(true);
    try {
      const result = await runCreate(
        mutator,
        effectiveAddTo,
        name.trim(),
        value,
        {
          activeEnvironment,
          workspaceVariables,
          vault,
          localCollections,
          collectionId,
        },
        t,
      );
      surfaceResult(result, message, onClose, t);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      ref={popoverRef as React.RefCallback<HTMLDivElement>}
      role="dialog"
      data-variable-popover-root=""
      style={{
        position: 'fixed',
        top: position.top,
        left: position.left,
        width: POPOVER_WIDTH,
        zIndex: 1080,
        background: token.colorBgElevated,
        border: `1px solid ${token.colorBorderSecondary}`,
        borderRadius: token.borderRadiusLG,
        boxShadow: token.boxShadowSecondary,
        padding: 12,
        opacity: measured ? 1 : 0,
        pointerEvents: measured ? undefined : 'none',
      }}
    >
      <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 10 }}>
        {t('shared.templateInput.setAsNewVariable')}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <Input
          ref={nameRef}
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder={t('shared.templateInput.variableName')}
          aria-label={t('shared.templateInput.variableName')}
          onPressEnter={() => {
            if (canSave) void handleSave();
          }}
        />
        <TemplateInput
          value={value}
          onChange={setValue}
          multiline
          maxRows={6}
          disableSuggestions
          placeholder={t('shared.templateInput.valuePlaceholder')}
          aria-label={t('shared.templateInput.variableValue')}
          style={{ width: '100%', fontFamily: token.fontFamilyCode, fontSize: 12 }}
        />
      </div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 10, gap: 8 }}>
        <Dropdown
          trigger={['click']}
          overlayStyle={{ zIndex: 1090 }}
          menu={{
            items: createOptions.map<NonNullable<MenuProps['items']>[number]>((opt) => ({
              key: opt.key,
              disabled: opt.disabled,
              label: (
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                  {scopeBadge(opt.colorKey, 14)}
                  {opt.label}
                  {opt.hint && <span style={{ color: token.colorTextSecondary, fontSize: 11 }}>· {opt.hint}</span>}
                </span>
              ),
              onClick: () => setAddTo(opt.key),
            })),
          }}
        >
          <Button size="small" style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            {effectiveAddTo && scopeBadge(createScopeToColorKey(effectiveAddTo), 14)}
            {effectiveAddTo
              ? t('shared.templateInput.addToScope', { scope: labelForCreateScope(effectiveAddTo, t) })
              : t('shared.templateInput.addToPickScope')}{' '}
            ▾
          </Button>
        </Dropdown>
        <Tooltip title={t('shared.action.save')} placement="bottomRight" zIndex={1090}>
          <Button
            size="small"
            type="primary"
            icon={<SaveOutlined />}
            loading={saving}
            disabled={!canSave}
            onClick={() => void handleSave()}
            style={{ fontSize: 11 }}
          >
            {t('shared.action.save')}
          </Button>
        </Tooltip>
      </div>
      {createFlow.unavailable === 'no-active-env' && (
        <div style={{ marginTop: 8, fontSize: 11, color: token.colorTextSecondary }}>
          {t('shared.templateInput.noActiveEnvHint')}
        </div>
      )}
    </div>
  );
};

export default SetAsVariablePopover;
