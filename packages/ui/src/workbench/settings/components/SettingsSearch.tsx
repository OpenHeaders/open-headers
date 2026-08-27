/**
 * SettingsSearch — search input with the modified-only toggle.
 *
 * The `M` tag inside the input toggles the `@modified` token the
 * search.ts indexer understands (it also honors `@deprecated`, typed).
 */

import { CloseOutlined, SearchOutlined } from '@ant-design/icons';
import { useT } from '@openheaders/ui/context/LocaleContext';
import { Input, type InputRef, Tooltip, theme } from 'antd';
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

const FILTER_MODIFIED = '@modified';

const SettingsSearch: React.FC<SettingsSearchProps> = ({ query, onQueryChange, inputRef, autoFocus, onArrowDown }) => {
  const { token } = theme.useToken();
  const t = useT();
  const active = query.toLowerCase().includes(FILTER_MODIFIED);

  const toggleModified = useCallback(() => {
    if (active) {
      onQueryChange(query.replace(new RegExp(`\\s*${FILTER_MODIFIED}`, 'i'), '').trim());
    } else {
      onQueryChange(`${FILTER_MODIFIED} ${query}`.trim());
    }
  }, [active, query, onQueryChange]);

  return (
    <Input
      ref={inputRef}
      autoFocus={autoFocus}
      prefix={<SearchOutlined style={{ color: token.colorTextTertiary }} />}
      suffix={
        <Tooltip title={t('workbench.settings.search.filter.modified')} placement="bottom">
          <button
            type="button"
            aria-pressed={active}
            aria-label={t('workbench.settings.search.filter.modified')}
            onMouseDown={(e) => e.preventDefault()}
            onClick={toggleModified}
            style={{
              width: 18,
              height: 18,
              padding: 0,
              border: `1px solid ${active ? token.colorPrimary : token.colorBorder}`,
              borderRadius: 4,
              background: active ? token.colorPrimary : 'transparent',
              color: active ? token.colorTextLightSolid : token.colorTextTertiary,
              fontSize: 10,
              fontWeight: 600,
              lineHeight: '16px',
              cursor: 'pointer',
            }}
          >
            M
          </button>
        </Tooltip>
      }
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
    />
  );
};

export default SettingsSearch;
