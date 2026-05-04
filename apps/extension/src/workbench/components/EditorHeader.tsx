/**
 * EditorHeader — shared header row used by every editor (Environment,
 * Rule, Request, Vault, Variables, etc.). Mirrors the dock-panel
 * `PanelHeader` pattern so editors and tool-windows share the same
 * visual language:
 *
 *   [title / subtitle slot] [flex filler] [actions slot] [Save] [⋯]
 *
 * `title` carries the entity identity (icon chip + name + status tags).
 * `actions` is the panel-specific inline slot — e.g. EnvironmentEditor
 * injects "Set active" / "Set as default" here. Save + kebab are
 * standardized on the right so the layout is consistent across editors.
 */

import { MoreOutlined, SaveOutlined } from '@ant-design/icons';
import { Button, Divider, Dropdown, type MenuProps, Tooltip, theme } from 'antd';
import type React from 'react';
import { ShortcutHintTitle } from '@/components/ShortcutKbd';
import type { EditorShellHeaderWiring } from '@/shared/editor-shell';
import { useShortcutLabel } from '../hooks/useWorkspaceShortcuts';

export interface EditorHeaderProps {
  /** Entity identity — icon chip + name + status tags. */
  title: React.ReactNode;
  /** Panel-specific inline actions (e.g. Set active, Send, Run). */
  actions?: React.ReactNode;
  /** Overflow menu items. Rule editors pass Save-as-Template here. */
  overflowItems?: MenuProps['items'];
  /** Shell-produced wiring bundle. Save semantics:
   *   - `isPublished === true && !isDirty` → button disabled, "Saved"
   *   - otherwise → enabled "Save" (orange when dirty or unpublished)
   *  When undefined the Save button is hidden — used for non-editor
   *  surfaces (entity list pages) that mount the header for layout
   *  parity but have nothing to save. */
  shell?: EditorShellHeaderWiring;
}

const EditorHeader: React.FC<EditorHeaderProps> = ({ title, actions, overflowItems, shell }) => {
  const wiring = shell as unknown as
    | { isDirty: boolean; isPublished?: boolean; onSave: () => void }
    | undefined;
  const isDirty = wiring?.isDirty;
  const isPublished = wiring?.isPublished;
  const onSave = wiring?.onSave;
  const { token } = theme.useToken();
  const saveLabel = useShortcutLabel('save');
  const hasOverflow = (overflowItems?.length ?? 0) > 0;
  const hasActions = actions != null || onSave || hasOverflow;
  // Publication-gate semantics. When `isPublished` is undefined, fall
  // back to the legacy "Save iff dirty" model so non-publication editors
  // behave unchanged.
  const hasPublishGate = isPublished !== undefined;
  const saveDisabled = hasPublishGate ? isPublished === true && !isDirty : !isDirty;
  const saveAccent = hasPublishGate ? !isPublished || isDirty : !!isDirty;
  const saveLabelText = hasPublishGate && isPublished === true && !isDirty ? 'Saved' : 'Save';

  return (
    <div
      className="rules-editor-header"
      style={{
        borderBottom: `1px solid ${token.colorBorderSecondary}`,
        background: token.colorBgContainer,
      }}
    >
      <div className="rules-editor-header-title">{title}</div>
      {hasActions && (
        <div className="rules-editor-header-actions">
          {actions}
          {actions != null && (onSave || hasOverflow) && (
            <Divider type="vertical" style={{ margin: '0 4px', height: 20 }} />
          )}
          {onSave && (
            <Tooltip
              title={<ShortcutHintTitle label={saveLabel}>{saveLabelText}</ShortcutHintTitle>}
              placement="bottomRight"
            >
              <Button
                size="small"
                type="primary"
                icon={<SaveOutlined />}
                onClick={onSave}
                disabled={saveDisabled}
                style={{
                  fontSize: 11,
                  ...(saveAccent ? { background: '#f5722d', borderColor: '#f5722d' } : {}),
                }}
              >
                {saveLabelText}
              </Button>
            </Tooltip>
          )}
          {hasOverflow && (
            <Dropdown menu={{ items: overflowItems }} trigger={['click']} placement="bottomRight">
              <Button size="small" icon={<MoreOutlined />} style={{ fontSize: 11 }} aria-label="More actions" />
            </Dropdown>
          )}
        </div>
      )}
    </div>
  );
};

export default EditorHeader;
