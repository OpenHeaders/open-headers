/**
 * GitLogTextField — the log's text-or-hash field with its regex and
 * match-case toggles. The reference's reading: typing filters NOTHING;
 * Enter applies what is typed, and the field's × clears the filter at
 * once. What is typed lives here until then; the applied text is the
 * tab's and leads the field — a reset or a tab's own restore replaces
 * what was typed. The toggles change how the APPLIED text matches and
 * act at once.
 */

import { SearchOutlined } from '@ant-design/icons';
import { Input, theme, Tooltip } from 'antd';
import type React from 'react';
import { useEffect, useState } from 'react';
import { useT } from '@openheaders/ui/context/LocaleContext';
import { GIT_CODE_SIZE } from '../git-type-scale';

export interface GitLogTextFieldProps {
  /** The text the log is filtered by now. */
  applied: string;
  /** Enter, or the field's × (with an empty text). */
  onApply: (text: string) => void;
  regex: boolean;
  onToggleRegex: () => void;
  matchCase: boolean;
  onToggleMatchCase: () => void;
  /** The applied text is a regex that failed to compile — error styling. */
  invalid: boolean;
}

interface FilterToggleProps {
  glyph: string;
  title: string;
  active: boolean;
  onToggle: () => void;
  testid: string;
}

const FilterToggle: React.FC<FilterToggleProps> = ({ glyph, title, active, onToggle, testid }) => {
  const { token } = theme.useToken();
  return (
    <Tooltip placement="top" title={title}>
      <button
        type="button"
        aria-label={title}
        aria-pressed={active}
        onClick={onToggle}
        data-testid={testid}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '0 3px',
          border: 'none',
          background: active ? token.colorFillSecondary : 'transparent',
          borderRadius: token.borderRadiusSM,
          cursor: 'pointer',
          fontFamily: token.fontFamilyCode,
          fontSize: GIT_CODE_SIZE,
          color: active ? token.colorPrimaryText : token.colorTextTertiary,
        }}
      >
        {glyph}
      </button>
    </Tooltip>
  );
};

const GitLogTextField: React.FC<GitLogTextFieldProps> = ({
  applied,
  onApply,
  regex,
  onToggleRegex,
  matchCase,
  onToggleMatchCase,
  invalid,
}) => {
  const t = useT();
  const { token } = theme.useToken();
  const [typed, setTyped] = useState(applied);

  useEffect(() => {
    setTyped(applied);
  }, [applied]);

  return (
    <Input
      size="small"
      allowClear
      value={typed}
      status={invalid ? 'error' : undefined}
      onChange={(e) => setTyped(e.target.value)}
      onPressEnter={() => onApply(typed)}
      onClear={() => onApply('')}
      placeholder={t('workbench.gitLog.filterPlaceholder')}
      prefix={<SearchOutlined style={{ color: token.colorTextTertiary }} />}
      suffix={
        <span style={{ display: 'inline-flex', gap: 2 }}>
          <FilterToggle
            glyph=".*"
            title={t('workbench.gitLog.filter.regex')}
            active={regex}
            onToggle={onToggleRegex}
            testid="git-tool-filter-regex"
          />
          <FilterToggle
            glyph="Cc"
            title={t('workbench.gitLog.filter.matchCase')}
            active={matchCase}
            onToggle={onToggleMatchCase}
            testid="git-tool-filter-case"
          />
        </span>
      }
      style={{ width: '100%' }}
      data-testid="git-tool-filter"
    />
  );
};

export default GitLogTextField;
