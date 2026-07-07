/**
 * ScriptSnippetsMenu — "</> Snippets" trigger + searchable, grouped
 * popover over the snippet catalog. Picking an entry hands its code to
 * the host (which inserts at the editor cursor) and closes the popover.
 */

import { CodeOutlined, SearchOutlined } from '@ant-design/icons';
import type { ScriptKind } from '@openheaders/core/scripts';
import { Button, Input, Popover, theme } from 'antd';
import type React from 'react';
import { useMemo, useState } from 'react';
import { filterScriptSnippetGroups, getScriptSnippetGroups } from './script-snippets';

interface ScriptSnippetsMenuProps {
  kind: ScriptKind;
  onInsert: (code: string) => void;
}

const ScriptSnippetsMenu: React.FC<ScriptSnippetsMenuProps> = ({ kind, onInsert }) => {
  const { token } = theme.useToken();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');

  const groups = useMemo(() => filterScriptSnippetGroups(getScriptSnippetGroups(kind), query), [kind, query]);

  const setOpenAndReset = (next: boolean) => {
    setOpen(next);
    if (!next) setQuery('');
  };

  const content = (
    <div style={{ width: 280, display: 'flex', flexDirection: 'column', gap: 4 }}>
      <Input
        size="small"
        autoFocus
        allowClear
        prefix={<SearchOutlined style={{ color: token.colorTextTertiary }} />}
        placeholder="Search snippets"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
      />
      {/* Fixed height regardless of matches — the popover keeps its
          footprint while the user types, instead of collapsing around
          a shrinking result list. */}
      <div style={{ height: 320, overflowY: 'auto', display: 'flex', flexDirection: 'column' }}>
        {groups.length === 0 && (
          <div
            style={{
              flex: 1,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: token.colorTextTertiary,
              fontSize: 13,
            }}
          >
            No snippet found
          </div>
        )}
        {groups.map((group) => (
          <div key={group.label} style={{ display: 'flex', flexDirection: 'column' }}>
            <div
              style={{
                padding: '8px 4px 2px',
                color: token.colorTextTertiary,
                fontSize: 11,
                fontWeight: 600,
                textTransform: 'uppercase',
                letterSpacing: 0.4,
              }}
            >
              {group.label}
            </div>
            {group.snippets.map((snippet) => (
              <button
                key={snippet.id}
                type="button"
                onClick={() => onInsert(snippet.code)}
                style={{
                  padding: '5px 4px',
                  background: 'transparent',
                  border: 'none',
                  borderRadius: 4,
                  cursor: 'pointer',
                  color: token.colorText,
                  fontSize: 13,
                  textAlign: 'left',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = token.colorFillTertiary;
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'transparent';
                }}
              >
                {snippet.label}
              </button>
            ))}
          </div>
        ))}
      </div>
    </div>
  );

  return (
    <Popover
      content={content}
      trigger="click"
      placement="topRight"
      open={open}
      onOpenChange={setOpenAndReset}
      destroyOnHidden
    >
      <Button size="small" type="text" icon={<CodeOutlined />} data-testid="oh-script-snippets">
        Snippets
      </Button>
    </Popover>
  );
};

export default ScriptSnippetsMenu;
