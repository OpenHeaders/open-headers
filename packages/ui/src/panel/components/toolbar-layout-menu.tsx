/**
 * PanelToolbar's layout-menu builder — the dropdown items for bottom
 * panel alignment, tool-window labels, activity-bar layout, layout
 * inheritance info, reset, and hidden-tool restore. Also exports the
 * small glyph/label helpers the toolbar's inline bottom-align dropdown
 * shares with the menu.
 */

import { InfoCircleOutlined, ReloadOutlined } from '@ant-design/icons';
import type { Translate } from '@openheaders/ui/context/LocaleContext';
import type { DockLayoutApi } from '@openheaders/ui/shared/dock-layout';
import {
  DockSlotIcon,
  LayoutMenuIcon,
  resolveToolWindowLabel,
  SidebarLayoutIcon,
} from '@openheaders/ui/shared/dock-layout';
import type { EditingScopeViewStateApi } from '@openheaders/ui/shared/editing-scope-view-state';
import { instanceLabel, instanceLabelPlural } from '@openheaders/ui/shared/host-vocabulary';
import type { GlobalToken, MenuProps } from 'antd';
import { Space, Tooltip } from 'antd';
import type React from 'react';
import { PANEL_TOOL_WINDOW_MAP, type PanelToolWindowId } from '../data/tool-windows';
import type { PanelViewState } from '../data/use-panel-tool-layout';

export type SidebarLayoutVariantSetting = 'proportional' | 'compact' | 'stacked' | 'dynamic';
export type BottomPanelAlignmentSetting = 'center' | 'left' | 'right' | 'justify';
export type BottomPanelSplitSetting = 'columns' | 'rows';

export const menuIconWrap = (node: React.ReactNode): React.ReactNode => (
  <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 22, height: 18 }}>
    {node}
  </span>
);

export const menuLabel = (checked: boolean, text: React.ReactNode): React.ReactNode => (
  <Space size={6}>
    {/* visibility (not conditional render) keeps the glyph's line box when
        unchecked, so the row height and text position never shift. */}
    <span style={{ width: 12, display: 'inline-block', visibility: checked ? 'visible' : 'hidden' }}>✓</span>
    {text}
  </Space>
);

export const alignmentGlyph = (
  a: BottomPanelAlignmentSetting,
): 'bottom-full' | 'bottom-left' | 'bottom-right' | 'bottom-nested' =>
  a === 'justify' ? 'bottom-full' : a === 'left' ? 'bottom-left' : a === 'right' ? 'bottom-right' : 'bottom-nested';

export const splitGlyph = (s: BottomPanelSplitSetting): 'bottom-split-columns' | 'bottom-split-rows' =>
  s === 'rows' ? 'bottom-split-rows' : 'bottom-split-columns';

export interface PanelLayoutMenuOptions {
  t: Translate;
  token: GlobalToken;
  tl: DockLayoutApi<PanelToolWindowId>;
  perTab: EditingScopeViewStateApi<PanelViewState>;
  bottomPanelAlignment: BottomPanelAlignmentSetting;
  setBottomPanelAlignment: (v: BottomPanelAlignmentSetting) => void;
  bottomPanelSplit: BottomPanelSplitSetting;
  setBottomPanelSplit: (v: BottomPanelSplitSetting) => void;
  showLabels: boolean;
  setShowLabels: (v: boolean) => void;
  sidebarLayout: SidebarLayoutVariantSetting;
  setSidebarLayout: (v: SidebarLayoutVariantSetting) => void;
}

/**
 * Builds the layout dropdown's items. Rebuilt every render (as the
 * inline array was) so setting values and the tool-layout state stay
 * current — no memoization is required because no item closes over a
 * value that must be referentially stable.
 */
export function buildPanelLayoutMenu({
  t,
  token,
  tl,
  perTab,
  bottomPanelAlignment,
  setBottomPanelAlignment,
  bottomPanelSplit,
  setBottomPanelSplit,
  showLabels,
  setShowLabels,
  sidebarLayout,
  setSidebarLayout,
}: PanelLayoutMenuOptions): MenuProps['items'] {
  return [
    {
      key: 'bottom-layout',
      icon: menuIconWrap(<LayoutMenuIcon kind={alignmentGlyph(bottomPanelAlignment)} />),
      label: t('panel.layout.bottomLayout'),
      children: [
        ...(
          [
            { key: 'center', label: t('panel.layout.alignCenter') },
            { key: 'left', label: t('panel.layout.alignLeft') },
            { key: 'right', label: t('panel.layout.alignRight') },
            { key: 'justify', label: t('panel.layout.alignJustify') },
          ] as { key: BottomPanelAlignmentSetting; label: string }[]
        ).map((opt) => ({
          key: `bottom-${opt.key}`,
          icon: menuIconWrap(<LayoutMenuIcon kind={alignmentGlyph(opt.key)} />),
          label: menuLabel(bottomPanelAlignment === opt.key, opt.label),
          onClick: () => setBottomPanelAlignment(opt.key),
        })),
        { type: 'divider' as const },
        ...(
          [
            { key: 'columns', label: t('panel.layout.splitColumns') },
            { key: 'rows', label: t('panel.layout.splitRows') },
          ] as { key: BottomPanelSplitSetting; label: string }[]
        ).map((opt) => ({
          key: `split-${opt.key}`,
          icon: menuIconWrap(<LayoutMenuIcon kind={splitGlyph(opt.key)} />),
          label: menuLabel(bottomPanelSplit === opt.key, opt.label),
          onClick: () => setBottomPanelSplit(opt.key),
        })),
      ],
    },
    {
      key: 'show-labels',
      icon: menuIconWrap(<LayoutMenuIcon kind={showLabels ? 'show-labels' : 'hide-labels'} />),
      label: menuLabel(showLabels, t('panel.layout.showToolWindowNames')),
      onClick: () => setShowLabels(!showLabels),
    },
    {
      key: 'sidebar-layout',
      icon: menuIconWrap(<SidebarLayoutIcon variant={sidebarLayout} />),
      label: t('panel.layout.activityBarLayout'),
      children: (
        [
          { key: 'proportional', label: t('panel.layout.sidebarProportional') },
          { key: 'compact', label: t('panel.layout.sidebarCompact') },
          { key: 'stacked', label: t('panel.layout.sidebarStacked') },
          { key: 'dynamic', label: t('panel.layout.sidebarDynamic') },
        ] as { key: SidebarLayoutVariantSetting; label: string }[]
      ).map((opt) => ({
        key: `sidebar-${opt.key}`,
        icon: menuIconWrap(<SidebarLayoutIcon variant={opt.key} />),
        label: menuLabel(sidebarLayout === opt.key, opt.label),
        onClick: () => setSidebarLayout(opt.key),
      })),
    },
    { type: 'divider' },
    {
      key: 'inheritance-info',
      icon: menuIconWrap(<LayoutMenuIcon kind="layout-default" />),
      label: (
        <Space size={6}>
          <span style={{ fontSize: 11, color: token.colorTextSecondary }}>
            {perTab.isDonor
              ? t('panel.layout.defaultLayoutDonor', { unit: instanceLabel() })
              : t('panel.layout.inheritsDefault')}
          </span>
          <Tooltip
            trigger={['hover', 'click']}
            title={
              perTab.isDonor
                ? t('panel.layout.donorTooltip', { unit: instanceLabel(), units: instanceLabelPlural() })
                : t('panel.layout.nonDonorTooltip', { unit: instanceLabel(), units: instanceLabelPlural() })
            }
          >
            <InfoCircleOutlined style={{ fontSize: 11, color: token.colorTextTertiary, cursor: 'help' }} />
          </Tooltip>
        </Space>
      ),
      disabled: true,
    },
    {
      key: 'reset-layout',
      icon: menuIconWrap(<ReloadOutlined style={{ fontSize: 12 }} />),
      label: t('panel.layout.resetToDefaults'),
      onClick: () => perTab.resetToDefaults(),
    },
    { type: 'divider' },
    {
      key: 'restore',
      icon: menuIconWrap(<LayoutMenuIcon kind="restore-hidden" />),
      label: t('panel.layout.restoreHidden'),
      disabled: tl.state.hidden.length === 0,
      children:
        tl.state.hidden.length === 0
          ? undefined
          : tl.state.hidden.map((id) => {
              const def = PANEL_TOOL_WINDOW_MAP[id];
              return {
                key: `restore-${id}`,
                icon: menuIconWrap(<DockSlotIcon slot={def.defaultSlot} size={20} />),
                label: (
                  <Space size={6}>
                    <span>{resolveToolWindowLabel(def, t)}</span>
                  </Space>
                ),
                onClick: () => tl.restoreWindow(id),
              };
            }),
    },
  ];
}
