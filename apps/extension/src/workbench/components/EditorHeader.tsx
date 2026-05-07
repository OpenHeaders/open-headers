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

import { CheckCircleFilled, ExclamationCircleFilled, MoreOutlined, SaveOutlined } from '@ant-design/icons';
import { Button, Divider, Dropdown, type MenuProps, Popover, Tag, Tooltip, theme } from 'antd';
import type React from 'react';
import { ShortcutHintTitle } from '@/components/ShortcutKbd';
import type { EditorLifecycleStatus, EditorShellHeaderWiring } from '@/shared/editor-shell';
import { useShortcutLabel } from '../hooks/useWorkspaceShortcuts';

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

// ── Lifecycle chip ────────────────────────────────────────────────
//
// Single visual vocabulary across editor / sidebar / tab strip. Same
// predicates feed each surface (see `useEditorShell`).

type StatusKey = Exclude<EditorLifecycleStatus, null> | 'live';

interface StatusStyle {
  label: string;
  fg: string;
  border: string;
  bg: string;
  body: string;
}

const STATUS_STYLE: Record<StatusKey, StatusStyle> = {
  scratch: {
    label: 'Scratch',
    fg: '#7a7a7a',
    border: '#bfbfbf',
    bg: 'rgba(140,140,140,0.10)',
    body: 'Unsaved draft. Nothing is persisted until you Save.',
  },
  unresolved: {
    label: 'Unresolved',
    fg: '#cf1322',
    border: '#ffa39e',
    bg: 'rgba(255,77,79,0.10)',
    body: 'Has {{ref}}s that don’t resolve in the active scope.',
  },
  draft: {
    label: 'Draft',
    fg: '#7a7a7a',
    border: '#bfbfbf',
    bg: 'rgba(140,140,140,0.10)',
    body: 'Saved but not yet published / live.',
  },
  live: {
    label: 'Live',
    fg: '#389e0d',
    border: '#b7eb8f',
    bg: 'rgba(82,196,26,0.12)',
    body: 'Published and active.',
  },
};

const STATUS_ORDER: StatusKey[] = ['scratch', 'unresolved', 'draft', 'live'];

function StatusPill({ s, active }: { s: StatusStyle; active: boolean }) {
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 4,
        padding: '1px 8px',
        fontSize: 10,
        fontWeight: 600,
        color: s.fg,
        background: s.bg,
        border: `1px solid ${s.border}`,
        borderRadius: 999,
        flexShrink: 0,
        boxShadow: active ? `0 0 0 2px ${s.bg}` : undefined,
      }}
    >
      {active && <CheckCircleFilled style={{ fontSize: 9, color: s.fg }} />}
      {!active && <ExclamationCircleFilled style={{ fontSize: 9, opacity: 0.35, color: s.fg }} />}
      {s.label}
    </span>
  );
}

function LifecyclePopoverContent({ current }: { current: StatusKey }) {
  return (
    <div style={{ minWidth: 280, maxWidth: 320 }}>
      <div style={{ fontSize: 11, fontWeight: 600, marginBottom: 8, color: 'var(--ant-color-text-secondary)' }}>
        Lifecycle states
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {STATUS_ORDER.map((key) => {
          const style = STATUS_STYLE[key];
          const active = key === current;
          return (
            <div
              key={key}
              style={{
                display: 'flex',
                alignItems: 'flex-start',
                gap: 8,
                padding: active ? '4px 6px' : '4px 6px',
                background: active ? style.bg : 'transparent',
                border: `1px solid ${active ? style.border : 'transparent'}`,
                borderRadius: 6,
              }}
            >
              <StatusPill s={style} active={active} />
              <span
                style={{
                  fontSize: 11,
                  lineHeight: 1.45,
                  color: active ? 'var(--ant-color-text)' : 'var(--ant-color-text-secondary)',
                  fontWeight: active ? 500 : 400,
                }}
              >
                {style.body}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function LifecycleChip({ status }: { status: EditorLifecycleStatus }) {
  if (status === null) return null;
  const style = STATUS_STYLE[status];
  return (
    <Popover
      content={<LifecyclePopoverContent current={status} />}
      placement="bottom"
      trigger={['hover', 'focus']}
      arrow={false}
      mouseEnterDelay={0.1}
    >
      <span style={{ display: 'inline-flex', cursor: 'help' }}>
        <StatusPill s={style} active />
      </span>
    </Popover>
  );
}

const EditorHeader: React.FC<EditorHeaderProps> = ({ title, actions, overflowItems, shell }) => {
  const wiring = shell as unknown as
    | { isDirty: boolean; isPublished?: boolean; status: EditorLifecycleStatus; onSave: () => void }
    | undefined;
  const isDirty = !!wiring?.isDirty;
  const status = wiring?.status ?? null;
  const onSave = wiring?.onSave;
  const { token } = theme.useToken();
  const saveLabel = useShortcutLabel('save');
  const hasOverflow = (overflowItems?.length ?? 0) > 0;
  const hasActions = actions != null || onSave || hasOverflow;
  const saveDisabled = !isDirty;
  const saveAccent = isDirty;
  const saveLabelText = isDirty ? 'Save' : 'Saved';

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
          <LifecycleChip status={status} />
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
