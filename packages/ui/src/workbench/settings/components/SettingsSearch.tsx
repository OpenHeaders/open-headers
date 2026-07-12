/**
 * SettingsSearch — search input with filter-chip hints.
 *
 * Supports the `@modified`, `@experimental`, `@deprecated` tokens that
 * the search.ts indexer understands. Clicking a chip appends the token
 * to the query; clicking again removes it.
 */

import { CloseOutlined, SearchOutlined } from '@ant-design/icons';
import type { MessageKey } from '@openheaders/i18n';
import { useT } from '@openheaders/ui/context/LocaleContext';
import { Button, Input, type InputRef, theme } from 'antd';
import type React from 'react';
import { useCallback } from 'react';

interface SettingsSearchProps {
  query: string;
  onQueryChange: (next: string) => void;
  /** Forwarded to the inner Ant Input so the shell can focus it via hotkey. */
  inputRef?: React.Ref<InputRef>;
  autoFocus?: boolean;
  /** ArrowDown in the input — shell uses this to jump focus into the sidebar. */
  onArrowDown?: () => void;
}

const FILTERS: readonly { token: string; labelKey: MessageKey }[] = [
  { token: '@modified', labelKey: 'workbench.settings.search.filter.modified' },
  { token: '@experimental', labelKey: 'workbench.settings.search.filter.experimental' },
];

const SettingsSearch: React.FC<SettingsSearchProps> = ({ query, onQueryChange, inputRef, autoFocus, onArrowDown }) => {
  const { token } = theme.useToken();
  const t = useT();

  const toggleFilter = useCallback(
    (filterToken: string) => {
      const has = query.toLowerCase().includes(filterToken);
      if (has) {
        onQueryChange(query.replace(new RegExp(`\\s*${filterToken}`, 'i'), '').trim());
      } else {
        onQueryChange(`${filterToken} ${query}`.trim());
      }
    },
    [query, onQueryChange],
  );

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 1, minWidth: 0 }}>
      <Input
        ref={inputRef}
        autoFocus={autoFocus}
        prefix={<SearchOutlined style={{ color: token.colorTextTertiary }} />}
        placeholder={t('workbench.settings.search.placeholder')}
        value={query}
        onChange={(e) => onQueryChange(e.target.value)}
        onKeyDown={(e) => {
          // Esc on a non-empty query clears it; on empty input we let
          // Ant Modal's default Esc handler close the modal.
          if (e.key === 'Escape' && query.length > 0) {
            e.stopPropagation();
            onQueryChange('');
            return;
          }
          if (e.key === 'ArrowDown' && onArrowDown) {
            e.preventDefault();
            onArrowDown();
          }
        }}
        allowClear={{ clearIcon: <CloseOutlined /> }}
        style={{ maxWidth: 420 }}
      />
      <div style={{ display: 'flex', gap: 4 }}>
        {FILTERS.map((f) => {
          const active = query.toLowerCase().includes(f.token);
          return (
            <Button key={f.token} size="small" type={active ? 'primary' : 'text'} onClick={() => toggleFilter(f.token)}>
              {t(f.labelKey)}
            </Button>
          );
        })}
      </div>
    </div>
  );
};

export default SettingsSearch;
