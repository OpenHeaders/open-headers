/**
 * EditorViewMenu — the compose toolbars' "Editor" dropdown, right of
 * the Find / Replace / Beautify cluster. One button carrying the live
 * display knobs, grouped by SCOPE so a toggle never surprises another
 * tab: "This editor" holds the host's per-pane Wrap state; "All
 * editors" writes the global `editor.*` settings (line numbers,
 * whitespace rendering, the EOL ¬ glyph) — the same values the
 * Settings page edits, the timeline-toolbar precedent. Menu-item
 * clicks keep the popover OPEN (the app's popover convention — only an
 * outside click or a trigger re-click closes), so several knobs flip
 * in one visit. The rows read like the auth-type popup's: every row
 * reserves a left check-gutter and the active ones carry the mark —
 * the mark alone, no single-choice tint, since several knobs are on
 * at once (`selectedKeys` → `.oh-editor-view-menu` in editor.less) —
 * while the right edge keeps the glyphs that mean "more": the submenu
 * caret, the open-elsewhere arrow. The last row is the jump to the rest of the knobs —
 * Settings › Editor › Code Editor, suffixed with the neutral boxed
 * jump arrow the desktop teaser's "Open in the desktop app" wears —
 * and it closes the popover, since the Settings surface takes over;
 * it renders only under a shell that provides `openSettings`.
 */

import { ControlOutlined, SelectOutlined } from '@ant-design/icons';
import type { MessageKey } from '@openheaders/i18n';
import { Button, Dropdown, theme, Tooltip } from 'antd';
import type React from 'react';
import { useState } from 'react';
import { useT } from '@openheaders/ui/context/LocaleContext';
import { useOpenSettings } from '../../hooks/OpenSettingsContext';
import { useSetting } from '../../settings/hooks';

/** The Settings category the jump lands on — the Code Editor page
 *  under Editor, where every `editor.*` knob lives. */
const CODE_EDITOR_CATEGORY_ID = 'codeEditor';

/** The whitespace submenu reuses the Settings page's own option labels. */
const WHITESPACE_OPTION_LABEL_KEYS: Record<'none' | 'boundary' | 'all', MessageKey> = {
  none: 'workbench.settings.def.editor.renderWhitespace.option.none.label',
  boundary: 'workbench.settings.def.editor.renderWhitespace.option.boundary.label',
  all: 'workbench.settings.def.editor.renderWhitespace.option.all.label',
};

interface EditorViewMenuProps {
  /** The host pane's Wrap state (per-pane, not a setting). */
  wrap: boolean;
  onWrapChange: (next: boolean) => void;
  style?: React.CSSProperties;
  'data-testid'?: string;
}

const EditorViewMenu: React.FC<EditorViewMenuProps> = ({ wrap, onWrapChange, style, 'data-testid': testid }) => {
  const { token } = theme.useToken();
  const t = useT();
  const [open, setOpen] = useState(false);
  const [lineNumbers, setLineNumbers] = useSetting('editor.lineNumbers');
  const [renderWhitespace, setRenderWhitespace] = useSetting('editor.renderWhitespace');
  const [renderLineEnds, setRenderLineEnds] = useSetting('editor.renderLineEnds');
  const openSettings = useOpenSettings();

  // The rows whose knob is ON carry the check — antd's selection
  // plane (several at once), so the mark is the row's state, not a
  // suffix glyph; the stylesheet paints the mark and nothing else.
  const selectedKeys = [
    ...(wrap ? ['wrap'] : []),
    ...(lineNumbers ? ['line-numbers'] : []),
    `whitespace-${renderWhitespace}`,
    ...(renderLineEnds ? ['line-ends'] : []),
  ];

  const settingsJump =
    openSettings === null
      ? []
      : [
          { type: 'divider' as const },
          {
            key: 'settings',
            label: (
              <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16 }}>
                {t('shared.editorMenu.settings')}
                <SelectOutlined style={{ color: token.colorTextSecondary }} />
              </span>
            ),
            onClick: () => {
              setOpen(false);
              openSettings({ categoryId: CODE_EDITOR_CATEGORY_ID });
            },
          },
        ];

  return (
    <Dropdown
      trigger={['click']}
      placement="bottomRight"
      open={open}
      onOpenChange={(next, info) => {
        // Menu-item clicks keep the popover open; only the trigger and
        // outside clicks change visibility.
        if (info.source === 'menu') return;
        setOpen(next);
      }}
      menu={{
        rootClassName: 'oh-editor-view-menu',
        selectable: true,
        multiple: true,
        selectedKeys,
        items: [
          {
            type: 'group',
            label: t('shared.editorMenu.thisEditor'),
            children: [
              {
                key: 'wrap',
                label: t('shared.codeEditor.wrap'),
                onClick: () => onWrapChange(!wrap),
              },
            ],
          },
          { type: 'divider' },
          {
            type: 'group',
            label: t('shared.editorMenu.allEditors'),
            children: [
              {
                key: 'line-numbers',
                label: t('shared.editorMenu.lineNumbers'),
                onClick: () => setLineNumbers(!lineNumbers),
              },
              {
                key: 'whitespace',
                label: t('shared.editorMenu.whitespace'),
                children: (['none', 'boundary', 'all'] as const).map((value) => ({
                  key: `whitespace-${value}`,
                  label: t(WHITESPACE_OPTION_LABEL_KEYS[value]),
                  onClick: () => setRenderWhitespace(value),
                })),
              },
              {
                key: 'line-ends',
                label: t('shared.editorMenu.lineEnds'),
                onClick: () => setRenderLineEnds(!renderLineEnds),
              },
            ],
          },
          ...settingsJump,
        ],
      }}
    >
      {/* The hint names what the menu holds, like Find / Replace /
        Format's hints beside it; it yields while the menu is open (the
        sidebar header's dropdown-trigger idiom). */}
      <Tooltip title={t('shared.editorMenu.tooltip')} placement="top" open={open ? false : undefined}>
        <Button
          size="small"
          type="text"
          icon={<ControlOutlined />}
          style={style}
          data-testid={testid}
          aria-label={t('shared.editorMenu.label')}
        >
          {t('shared.editorMenu.label')}
        </Button>
      </Tooltip>
    </Dropdown>
  );
};

export default EditorViewMenu;
