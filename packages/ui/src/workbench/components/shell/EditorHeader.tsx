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
 *
 * Lifecycle (Scratch / Draft / Unresolved / Live) is NOT rendered
 * here — it lives in the workbench footer (`StatusBar`), wired through
 * the `ActiveEditorLifecycle` awareness context. Keeping the header
 * focused on actions avoids mixing identity metadata with controls.
 */

import { CheckOutlined, MoreOutlined, SaveOutlined } from '@ant-design/icons';
import { Button, Divider, Dropdown, type MenuProps, Tooltip, theme } from 'antd';
import type React from 'react';
import { ShortcutHintTitle } from '@openheaders/ui/components/ShortcutKbd';
import type { EditorLifecycleStatus, EditorShellHeaderWiring } from '@openheaders/ui/shared/editor-shell';
import { useShortcutLabel } from '../../hooks/useWorkspaceShortcuts';
import { useSetting } from '../../settings/hooks';
import LayoutMenuIcon from './LayoutMenuIcon';

const menuIconWrap = (node: React.ReactNode) => (
  <span
    style={{
      display: 'inline-flex',
      alignItems: 'center',
      justifyContent: 'center',
      width: 22,
      height: 18,
    }}
  >
    {node}
  </span>
);

export interface EditorHeaderProps {
  /** Entity identity — icon chip + name + status tags. */
  title: React.ReactNode;
  /** Panel-specific inline actions (e.g. Set active, Send, Run). */
  actions?: React.ReactNode;
  /** Overflow menu items. Rule editors pass Save-as-Template here. */
  overflowItems?: MenuProps['items'];
  /** Shell-produced wiring bundle. Save semantics:
   *   - `!isDirty` → button disabled, label "Saved" (clean form, nothing
   *     to commit). Holds whether the entity is published or not — an
   *     unpublished rule with no form edits has nothing to save; the
   *     publication gate is communicated through the sidebar "draft"
   *     pill + italic tab label, not by lighting Save orange.
   *   - `isDirty` → enabled "Save" (orange).
   *  When undefined the Save button is hidden — used for non-editor
   *  surfaces (entity list pages) that mount the header for layout
   *  parity but have nothing to save. */
  shell?: EditorShellHeaderWiring;
}

const EditorHeader: React.FC<EditorHeaderProps> = ({ title, actions, overflowItems, shell }) => {
  const wiring = shell as unknown as
    | { isDirty: boolean; isPublished?: boolean; status: EditorLifecycleStatus; onSave: () => void }
    | undefined;
  const isDirty = !!wiring?.isDirty;
  const onSave = wiring?.onSave;
  const { token } = theme.useToken();
  const saveLabel = useShortcutLabel('save');

  // Every editor mounts this header as the first child of its flex
  // column, with the scrollable body as the sibling — so the bottom
  // placement is pure CSS `order` on the modifier class (see
  // `.rules-editor-header--bottom` in rules.less), no per-editor
  // wiring. Popups flip upward so they open over the content instead
  // of under the status bar.
  const [headerPosition, setHeaderPosition] = useSetting('appearance.editorHeaderPosition');
  const atBottom = headerPosition === 'bottom';
  const popupPlacement = atBottom ? ('topRight' as const) : ('bottomRight' as const);

  // Dock items live in every editor's ⋯ menu so the setting is
  // discoverable where it acts (it also lives in Settings →
  // Appearance). Appended after the editor-specific items; the active
  // side is marked with a trailing check.
  const positionCheck = <CheckOutlined style={{ fontSize: 10, color: token.colorPrimary, marginLeft: 12 }} />;
  const positionLabel = (text: string, active: boolean) => (
    <span style={{ display: 'inline-flex', alignItems: 'center', flex: 1 }}>
      <span style={{ flex: 1 }}>{text}</span>
      {active && positionCheck}
    </span>
  );
  const mergedOverflowItems: MenuProps['items'] = [
    ...(overflowItems ?? []),
    ...(overflowItems?.length ? [{ type: 'divider' as const }] : []),
    {
      key: 'editor-header-top',
      icon: menuIconWrap(<LayoutMenuIcon kind="header-top" />),
      label: positionLabel('Header on Top', !atBottom),
      onClick: () => setHeaderPosition('top'),
    },
    {
      key: 'editor-header-bottom',
      icon: menuIconWrap(<LayoutMenuIcon kind="header-bottom" />),
      label: positionLabel('Header at Bottom', atBottom),
      onClick: () => setHeaderPosition('bottom'),
    },
  ];

  const saveDisabled = !isDirty;
  const saveAccent = isDirty;
  const saveLabelText = isDirty ? 'Save' : 'Saved';

  return (
    <div
      className={`rules-editor-header${atBottom ? ' rules-editor-header--bottom' : ''}`}
      style={{
        background: token.colorBgContainer,
      }}
    >
      <div className="rules-editor-header-title">{title}</div>
      <div className="rules-editor-header-actions">
        {actions}
        {actions != null && <Divider type="vertical" style={{ margin: '0 4px', height: 20 }} />}
        {onSave && (
          <Tooltip title={<ShortcutHintTitle label={saveLabel}>Save</ShortcutHintTitle>} placement={popupPlacement}>
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
        {/* min-width keeps long labels ("Save as User Template",
            "Header at Bottom" + check) from cramping — the menu still
            grows beyond it for longer editor-specific items. */}
        <Dropdown
          menu={{ items: mergedOverflowItems }}
          trigger={['click']}
          placement={popupPlacement}
          overlayStyle={{ minWidth: 220 }}
        >
          <Button size="small" icon={<MoreOutlined />} style={{ fontSize: 11 }} aria-label="More actions" />
        </Dropdown>
      </div>
    </div>
  );
};

export default EditorHeader;
