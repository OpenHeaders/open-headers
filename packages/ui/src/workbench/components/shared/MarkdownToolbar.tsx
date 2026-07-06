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
import { Button, Tooltip, theme } from 'antd';
import type React from 'react';
import { ShortcutHintTitle } from '@openheaders/ui/components/ShortcutKbd';
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
  /** Tooltip body — a `ShortcutHintTitle` when the action has a chord. */
  tip: React.ReactNode;
  /** Plain-text accessible label (tooltips may carry markup). */
  aria: string;
  run: (editor: MarkdownEditor) => void;
}

const GROUPS: ToolButton[][] = [
  [
    { key: 'heading', icon: <FontSizeOutlined />, tip: 'Heading', aria: 'Heading', run: toggleHeading },
    {
      key: 'bold',
      icon: <BoldOutlined />,
      tip: <ShortcutHintTitle label={`${MOD}B`}>Bold</ShortcutHintTitle>,
      aria: 'Bold',
      run: (ed) => toggleWrap(ed, '**', 'bold'),
    },
    {
      key: 'italic',
      icon: <ItalicOutlined />,
      tip: <ShortcutHintTitle label={`${MOD}I`}>Italic</ShortcutHintTitle>,
      aria: 'Italic',
      run: (ed) => toggleWrap(ed, '*', 'italic'),
    },
    {
      key: 'strike',
      icon: <StrikethroughOutlined />,
      tip: 'Strikethrough',
      aria: 'Strikethrough',
      run: (ed) => toggleWrap(ed, '~~', 'text'),
    },
  ],
  [
    { key: 'code', icon: <CodeOutlined />, tip: 'Code block', aria: 'Code block', run: insertCodeBlock },
    {
      key: 'link',
      icon: <LinkOutlined />,
      tip: <ShortcutHintTitle label={`${MOD}K`}>Link</ShortcutHintTitle>,
      aria: 'Link',
      run: insertLink,
    },
  ],
  [
    {
      key: 'ul',
      icon: <UnorderedListOutlined />,
      tip: 'Bulleted list',
      aria: 'Bulleted list',
      run: (ed) => toggleLinePrefix(ed, '- '),
    },
    {
      key: 'ol',
      icon: <OrderedListOutlined />,
      tip: 'Numbered list',
      aria: 'Numbered list',
      run: (ed) => toggleLinePrefix(ed, (i) => `${i + 1}. `),
    },
    { key: 'table', icon: <TableOutlined />, tip: 'Table', aria: 'Table', run: insertTable },
  ],
];

interface MarkdownToolbarProps {
  /** The live Monaco buffer to act on — null while the editor mounts. */
  editor: MarkdownEditor | null;
}

const MarkdownToolbar: React.FC<MarkdownToolbarProps> = ({ editor }) => {
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
            <Tooltip key={btn.key} title={btn.tip} placement="top">
              <Button
                size="small"
                type="text"
                icon={btn.icon}
                aria-label={btn.aria}
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
