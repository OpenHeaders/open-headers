/**
 * IDE-style toolbar for the rich diff viewer — a row of dropdown
 * buttons + icon toggles + a differences counter on the right. The
 * dropdowns mirror the classic IDE diff toolbar so users coming from
 * those tools get the same vocabulary; the icon toggles map 1:1 to
 * Monaco knobs.
 *
 *   [ Side-by-side viewer ▾ ]  [ Do not ignore ▾ ]   [⇕] [⚙]   N differences
 */

import {
  CaretDownOutlined,
  ColumnHeightOutlined,
  ColumnWidthOutlined,
  SettingOutlined,
  ShrinkOutlined,
} from '@ant-design/icons';
import { Button, Dropdown, type MenuProps, Tooltip, Typography, theme } from 'antd';
import type React from 'react';
import type { DiffViewerOptions, DiffViewerWhitespace } from './types';

const { Text } = Typography;

const VIEWER_LABELS: Record<DiffViewerOptions['mode'], string> = {
  'side-by-side': 'Side-by-side viewer',
  unified: 'Unified viewer',
};

const WHITESPACE_LABELS: Record<DiffViewerWhitespace, string> = {
  none: 'Do not ignore',
  ignore: 'Ignore whitespaces',
};

interface Props {
  options: DiffViewerOptions;
  onChange: (next: DiffViewerOptions) => void;
  /** Differences count surfaced from Monaco's `onDidUpdateDiff`. */
  diffCount: number | null;
}

const DiffEditorToolbar: React.FC<Props> = ({ options, onChange, diffCount }) => {
  const { token } = theme.useToken();

  const set = <K extends keyof DiffViewerOptions>(key: K, value: DiffViewerOptions[K]): void => {
    onChange({ ...options, [key]: value });
  };

  const viewerMenu: MenuProps = {
    selectedKeys: [options.mode],
    items: [
      { key: 'side-by-side', label: VIEWER_LABELS['side-by-side'] },
      { key: 'unified', label: VIEWER_LABELS.unified },
    ],
    onClick: ({ key }) => set('mode', key as DiffViewerOptions['mode']),
  };

  const whitespaceMenu: MenuProps = {
    selectedKeys: [options.whitespace],
    items: [
      { key: 'none', label: WHITESPACE_LABELS.none },
      { key: 'ignore', label: WHITESPACE_LABELS.ignore },
    ],
    onClick: ({ key }) => set('whitespace', key as DiffViewerWhitespace),
  };

  const settingsMenu: MenuProps = {
    selectable: true,
    multiple: true,
    selectedKeys: [
      options.showWhitespaces && 'showWhitespaces',
      options.showLineNumbers && 'showLineNumbers',
      options.showIndentGuides && 'showIndentGuides',
      options.softWrap && 'softWrap',
    ].filter((x): x is string => typeof x === 'string'),
    items: [
      { key: 'showWhitespaces', label: 'Show whitespaces' },
      { key: 'showLineNumbers', label: 'Show line numbers' },
      { key: 'showIndentGuides', label: 'Show indent guides' },
      { key: 'softWrap', label: 'Soft-wrap' },
    ],
    onClick: ({ key }) => {
      const k = key as 'showWhitespaces' | 'showLineNumbers' | 'showIndentGuides' | 'softWrap';
      set(k, !options[k]);
    },
  };

  const dropdownButtonStyle: React.CSSProperties = {
    height: 26,
    padding: '0 8px',
    fontSize: 12,
    display: 'inline-flex',
    alignItems: 'center',
    gap: 4,
  };

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 6,
        padding: '6px 10px',
        borderBottom: `1px solid ${token.colorBorderSecondary}`,
        background: token.colorFillQuaternary,
        flexWrap: 'wrap',
      }}
    >
      <Dropdown menu={viewerMenu} trigger={['click']}>
        <Button size="small" style={dropdownButtonStyle}>
          {VIEWER_LABELS[options.mode]}
          <CaretDownOutlined style={{ fontSize: 10 }} />
        </Button>
      </Dropdown>

      <Dropdown menu={whitespaceMenu} trigger={['click']}>
        <Button size="small" style={dropdownButtonStyle}>
          {WHITESPACE_LABELS[options.whitespace]}
          <CaretDownOutlined style={{ fontSize: 10 }} />
        </Button>
      </Dropdown>

      <span style={{ width: 1, height: 16, background: token.colorBorderSecondary, margin: '0 4px' }} />

      <Tooltip title={options.collapseUnchanged ? 'Expand unchanged fragments' : 'Collapse unchanged fragments'}>
        <Button
          size="small"
          icon={<ShrinkOutlined />}
          type={options.collapseUnchanged ? 'primary' : 'default'}
          ghost={options.collapseUnchanged}
          style={{ height: 26, width: 26, padding: 0 }}
          onClick={() => set('collapseUnchanged', !options.collapseUnchanged)}
        />
      </Tooltip>

      <Tooltip title={options.mode === 'side-by-side' ? 'Switch to unified' : 'Switch to side-by-side'}>
        <Button
          size="small"
          icon={options.mode === 'side-by-side' ? <ColumnWidthOutlined /> : <ColumnHeightOutlined />}
          style={{ height: 26, width: 26, padding: 0 }}
          onClick={() => set('mode', options.mode === 'side-by-side' ? 'unified' : 'side-by-side')}
        />
      </Tooltip>

      <Dropdown menu={settingsMenu} trigger={['click']}>
        <Button size="small" icon={<SettingOutlined />} style={{ height: 26, width: 26, padding: 0 }} />
      </Dropdown>

      <div style={{ flex: 1 }} />

      {diffCount !== null && (
        <Text type="secondary" style={{ fontSize: 12, whiteSpace: 'nowrap' }}>
          {diffCount === 0 ? 'No differences' : diffCount === 1 ? '1 difference' : `${diffCount} differences`}
        </Text>
      )}
    </div>
  );
};

export default DiffEditorToolbar;
