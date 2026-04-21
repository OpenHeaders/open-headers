/**
 * SettingsSearch — search input with filter-chip hints.
 *
 * Supports the `@modified`, `@experimental`, `@deprecated` tokens that
 * the search.ts indexer understands. Clicking a chip appends the token
 * to the query; clicking again removes it.
 */

import { CloseOutlined, SearchOutlined } from '@ant-design/icons';
import { Button, Input, theme } from 'antd';
import type React from 'react';
import { useCallback } from 'react';

interface SettingsSearchProps {
  query: string;
  onQueryChange: (next: string) => void;
}

const FILTERS: readonly { token: string; label: string }[] = [
  { token: '@modified', label: 'Modified' },
  { token: '@experimental', label: 'Experimental' },
];

const SettingsSearch: React.FC<SettingsSearchProps> = ({ query, onQueryChange }) => {
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
        prefix={<SearchOutlined style={{ color: token.colorTextTertiary }} />}
        placeholder="Search settings (try @modified)"
        value={query}
        onChange={(e) => onQueryChange(e.target.value)}
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
