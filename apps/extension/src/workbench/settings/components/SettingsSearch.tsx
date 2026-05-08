/**
 * SettingsSearch — search input with filter-chip hints.
 *
 * Supports the `@modified`, `@experimental`, `@deprecated` tokens that
 * the search.ts indexer understands. Clicking a chip appends the token
 * to the query; clicking again removes it.
 */

import { CloseOutlined, SearchOutlined } from '@ant-design/icons';
import { Button, Input, type InputRef, theme } from 'antd';
import type React from 'react';
import { useCallback } from 'react';

interface SettingsSearchProps {
  query: string;
  onQueryChange: (next: string) => void;
  /** Forwarded to the inner Ant Input so the shell can focus it via hotkey. */
  inputRef?: React.Ref<InputRef>;
  autoFocus?: boolean;
}

const FILTERS: readonly { token: string; label: string }[] = [
  { token: '@modified', label: 'Modified' },
  { token: '@experimental', label: 'Experimental' },
];

const SettingsSearch: React.FC<SettingsSearchProps> = ({ query, onQueryChange, inputRef, autoFocus }) => {
  const { token } = theme.useToken();

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
        placeholder="Search settings (try @modified)"
        value={query}
        onChange={(e) => onQueryChange(e.target.value)}
        onKeyDown={(e) => {
          // Esc on a non-empty query clears it; on empty input we let
          // Ant Modal's default Esc handler close the modal.
          if (e.key === 'Escape' && query.length > 0) {
            e.stopPropagation();
            onQueryChange('');
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
              {f.label}
            </Button>
          );
        })}
      </div>
    </div>
  );
};

export default SettingsSearch;
