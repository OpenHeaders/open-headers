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
 * in one visit.
 */

import { CheckOutlined, ControlOutlined } from '@ant-design/icons';
import type { MessageKey } from '@openheaders/i18n';
import { Button, Dropdown, theme } from 'antd';
import type React from 'react';
import { useState } from 'react';
import { useT } from '@openheaders/ui/context/LocaleContext';
import { useSetting } from '../../settings/hooks';

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

  const optionLabel = (label: string, checked: boolean): React.ReactNode => (
    <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16 }}>
      {label}
      {checked && <CheckOutlined style={{ color: token.colorPrimary }} />}
    </span>
  );

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
        items: [
          {
            type: 'group',
            label: t('shared.editorMenu.thisEditor'),
            children: [
              {
                key: 'wrap',
                label: optionLabel(t('shared.codeEditor.wrap'), wrap),
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
                label: optionLabel(t('shared.editorMenu.lineNumbers'), lineNumbers),
                onClick: () => setLineNumbers(!lineNumbers),
              },
              {
                key: 'whitespace',
                label: t('shared.editorMenu.whitespace'),
                children: (['none', 'boundary', 'all'] as const).map((value) => ({
                  key: `whitespace-${value}`,
                  label: optionLabel(t(WHITESPACE_OPTION_LABEL_KEYS[value]), renderWhitespace === value),
                  onClick: () => setRenderWhitespace(value),
                })),
              },
              {
                key: 'line-ends',
                label: optionLabel(t('shared.editorMenu.lineEnds'), renderLineEnds),
                onClick: () => setRenderLineEnds(!renderLineEnds),
              },
            ],
          },
        ],
      }}
    >
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
    </Dropdown>
  );
};

export default EditorViewMenu;
