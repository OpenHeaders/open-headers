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
import { useT } from '@openheaders/ui/context/LocaleContext';
import { filterScriptSnippetGroups, getScriptSnippetGroups } from './script-snippets';

interface ScriptSnippetsMenuProps {
  kind: ScriptKind;
  onInsert: (code: string) => void;
}

const ScriptSnippetsMenu: React.FC<ScriptSnippetsMenuProps> = ({ kind, onInsert }) => {
  const { token } = theme.useToken();
  const t = useT();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');

  const groups = useMemo(() => filterScriptSnippetGroups(getScriptSnippetGroups(kind), query, t), [kind, query, t]);

  const setOpenAndReset = (next: boolean) => {
    setOpen(next);
    if (!next) setQuery('');
  };

  const content = (
    <div style={{ width: 224, display: 'flex', flexDirection: 'column', gap: 4 }}>
      <Input
        size="small"
        autoFocus
        allowClear
        prefix={<SearchOutlined style={{ color: token.colorTextTertiary }} />}
        placeholder={t('workbench.editors.scriptEditor.searchSnippets')}
        value={query}
        onChange={(e) => setQuery(e.target.value)}
      />
      {/* Fixed height regardless of matches — the popover keeps its
          footprint while the user types, instead of collapsing around
          a shrinking result list. `scroll` (not `auto`) + the persistent
          scrollbar class keep the gutter always visible as a cue. */}
      <div
        className="oh-persistent-scroll"
        style={{ height: 240, overflowY: 'scroll', overscrollBehavior: 'none', display: 'flex', flexDirection: 'column', paddingRight: 2 }}
      >
        {groups.length === 0 && (
          <div
            style={{
              flex: 1,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: token.colorTextTertiary,
              fontSize: 12,
            }}
          >
            {t('workbench.editors.scriptEditor.noSnippetFound')}
          </div>
        )}
        {groups.map((group) => (
          <div key={group.labelKey} style={{ display: 'flex', flexDirection: 'column' }}>
            <div
              style={{
                padding: '6px 4px 2px',
                color: token.colorTextTertiary,
                fontSize: 10,
                fontWeight: 600,
                textTransform: 'uppercase',
                letterSpacing: 0.4,
              }}
            >
              {t(group.labelKey)}
            </div>
            {group.snippets.map((snippet) => (
              <button
                key={snippet.id}
                type="button"
                onClick={() => onInsert(snippet.code)}
                style={{
                  padding: '3px 4px',
                  background: 'transparent',
                  border: 'none',
                  borderRadius: 4,
                  cursor: 'pointer',
                  color: token.colorText,
                  fontSize: 12,
                  textAlign: 'left',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = token.colorFillTertiary;
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'transparent';
                }}
              >
                {t(snippet.labelKey)}
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
      styles={{ container: { padding: 8 } }}
    >
      <Button size="small" type="text" icon={<CodeOutlined />} data-testid="oh-script-snippets">
        {t('workbench.editors.scriptEditor.snippets')}
      </Button>
    </Popover>
  );
};

export default ScriptSnippetsMenu;
