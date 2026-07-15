/**
 * Split-orientation entries for a ⋯ overflow menu — the dropdown
 * counterpart of `SplitLayoutToggle`, following the editor header's
 * "Header on Top / Header at Bottom" pattern: split glyph, label,
 * trailing check on the active orientation.
 */

import { CheckOutlined } from '@ant-design/icons';
import { LayoutMenuIcon } from '@openheaders/ui/shared/dock-layout';
import type { MenuProps } from 'antd';
import { theme } from 'antd';
import type React from 'react';
import { useT } from '@openheaders/ui/context/LocaleContext';
import type { SplitLayout } from './use-split-layout-preference';

const menuIconWrap = (node: React.ReactNode) => (
  <span
    style={{
      display: 'inline-flex',
      alignItems: 'center',
      justifyContent: 'center',
      width: 22,
      height: 18,
    }}
  >
    {node}
  </span>
);

export function useSplitLayoutMenuItems(
  layout: SplitLayout,
  onChange: (next: SplitLayout) => void,
): NonNullable<MenuProps['items']> {
  const t = useT();
  const { token } = theme.useToken();
  const label = (text: string, active: boolean) => (
    <span style={{ display: 'inline-flex', alignItems: 'center', flex: 1 }}>
      <span style={{ flex: 1 }}>{text}</span>
      {active && <CheckOutlined style={{ fontSize: 10, color: token.colorPrimary, marginLeft: 12 }} />}
    </span>
  );
  return [
    {
      key: 'split-layout-horizontal',
      icon: menuIconWrap(<LayoutMenuIcon kind="split-right" />),
      label: label(t('shared.splitLayout.horizontal'), layout === 'horizontal'),
      onClick: () => onChange('horizontal'),
    },
    {
      key: 'split-layout-vertical',
      icon: menuIconWrap(<LayoutMenuIcon kind="split-down" />),
      label: label(t('shared.splitLayout.vertical'), layout === 'vertical'),
      onClick: () => onChange('vertical'),
    },
  ];
}
