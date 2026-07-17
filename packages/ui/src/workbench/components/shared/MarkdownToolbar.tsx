/**
 * MarkdownToolbar — GitHub-style formatting row for a Monaco markdown
 * buffer. Buttons insert/wrap markdown syntax around the current
 * selection (see `markdown-commands`); the source stays plain
 * markdown — no rich-text state, no second format.
 */

import {
  BoldOutlined,
  CodeOutlined,
  FontSizeOutlined,
  ItalicOutlined,
  LinkOutlined,
  OrderedListOutlined,
  StrikethroughOutlined,
  TableOutlined,
  UnorderedListOutlined,
} from '@ant-design/icons';
import type { MessageKey } from '@openheaders/i18n';
import { Button, Tooltip, theme } from 'antd';
import type React from 'react';
import { ShortcutHintTitle } from '@openheaders/ui/components/ShortcutKbd';
import { useT } from '@openheaders/ui/context/LocaleContext';
import { isMac } from '@openheaders/ui/shared/platform';
import {
  insertCodeBlock,
  insertLink,
  insertTable,
  type MarkdownEditor,
  toggleHeading,
  toggleLinePrefix,
  toggleWrap,
} from './markdown-commands';

const MOD = isMac ? '⌘' : 'Ctrl+';

interface ToolButton {
  key: string;
  icon: React.ReactNode;
  /** Tooltip + accessible-label copy; the tooltip wraps it in a
   *  `ShortcutHintTitle` when the action has a chord. */
  labelKey: MessageKey;
  /** Keyboard chord shown beside the tooltip label, when the action has one. */
  chord?: string;
  run: (editor: MarkdownEditor) => void;
}

const GROUPS: ToolButton[][] = [
  [
    { key: 'heading', icon: <FontSizeOutlined />, labelKey: 'workbench.markdown.heading', run: toggleHeading },
    {
      key: 'bold',
      icon: <BoldOutlined />,
      labelKey: 'workbench.markdown.bold',
      chord: `${MOD}B`,
      run: (ed) => toggleWrap(ed, '**', 'bold'),
    },
    {
      key: 'italic',
      icon: <ItalicOutlined />,
      labelKey: 'workbench.markdown.italic',
      chord: `${MOD}I`,
      run: (ed) => toggleWrap(ed, '*', 'italic'),
    },
    {
      key: 'strike',
      icon: <StrikethroughOutlined />,
      labelKey: 'workbench.markdown.strikethrough',
      run: (ed) => toggleWrap(ed, '~~', 'text'),
    },
  ],
  [
    { key: 'code', icon: <CodeOutlined />, labelKey: 'workbench.markdown.codeBlock', run: insertCodeBlock },
    {
      key: 'link',
      icon: <LinkOutlined />,
      labelKey: 'workbench.markdown.link',
      chord: `${MOD}K`,
      run: insertLink,
    },
  ],
  [
    {
      key: 'ul',
      icon: <UnorderedListOutlined />,
      labelKey: 'workbench.markdown.bulletedList',
      run: (ed) => toggleLinePrefix(ed, '- '),
    },
    {
      key: 'ol',
      icon: <OrderedListOutlined />,
      labelKey: 'workbench.markdown.numberedList',
      run: (ed) => toggleLinePrefix(ed, (i) => `${i + 1}. `),
    },
    { key: 'table', icon: <TableOutlined />, labelKey: 'workbench.markdown.table', run: insertTable },
  ],
];

interface MarkdownToolbarProps {
  /** The live Monaco buffer to act on — null while the editor mounts. */
  editor: MarkdownEditor | null;
}

const MarkdownToolbar: React.FC<MarkdownToolbarProps> = ({ editor }) => {
  const t = useT();
  const { token } = theme.useToken();
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
      {GROUPS.map((group, gi) => (
        <div key={group[0]?.key} style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          {gi > 0 && (
            <span
              aria-hidden="true"
              style={{ width: 1, height: 14, background: token.colorBorderSecondary, margin: '0 4px' }}
            />
          )}
          {group.map((btn) => (
            <Tooltip
              key={btn.key}
              title={
                btn.chord ? <ShortcutHintTitle label={btn.chord}>{t(btn.labelKey)}</ShortcutHintTitle> : t(btn.labelKey)
              }
              placement="top"
            >
              <Button
                size="small"
                type="text"
                icon={btn.icon}
                aria-label={t(btn.labelKey)}
                disabled={!editor}
                onClick={() => {
                  if (editor) btn.run(editor);
                }}
                style={{ width: 24, height: 24, minWidth: 24, color: token.colorTextSecondary }}
              />
            </Tooltip>
          ))}
        </div>
      ))}
    </div>
  );
};

export default MarkdownToolbar;
