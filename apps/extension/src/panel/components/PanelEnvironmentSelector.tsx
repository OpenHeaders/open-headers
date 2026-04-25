/**
 * PanelEnvironmentSelector — slim env switcher for the DevTools panel.
 *
 * The DevTools panel is a viewer surface, so we strip the editing
 * affordances of the workbench-side `EnvironmentSelector`: no pin /
 * default / vault / workspace-vars rows. The user picks an env to
 * scope their request inspection; anything beyond that bounces them
 * to `workbench.html` in a new tab.
 */

import { CheckOutlined, DownOutlined, GlobalOutlined } from '@ant-design/icons';
import type { V5 } from '@openheaders/core/types';
import { Button, Divider, Dropdown, Space, Typography, theme } from 'antd';
import type React from 'react';
import { useState } from 'react';
import { getBrowserAPI } from '@/types/browser';
import { scopeBadge } from '@/workbench/components/shared/scope-colors';

const { Text } = Typography;

interface PanelEnvironmentSelectorProps {
  environments: V5.Environment[];
  activeEnvironmentId: string | null;
  onSwitch: (uid: string | null) => void;
}

export const PanelEnvironmentSelector: React.FC<PanelEnvironmentSelectorProps> = ({
  environments,
  activeEnvironmentId,
  onSwitch,
}) => {
  const { token } = theme.useToken();
  const [open, setOpen] = useState(false);

  const active = activeEnvironmentId ? (environments.find((e) => e.uid === activeEnvironmentId) ?? null) : null;

  const close = (): void => setOpen(false);

  const rowStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    padding: '5px 8px',
    cursor: 'pointer',
    borderRadius: token.borderRadiusSM,
    minWidth: 200,
  };

  const dropdownContent = (
    <div
      style={{
        background: token.colorBgElevated,
        borderRadius: token.borderRadiusLG,
        boxShadow: token.boxShadowSecondary,
        padding: '6px 4px',
        minWidth: 220,
      }}
      onClick={(e) => e.stopPropagation()}
    >
      <div
        role="menuitem"
        className="oh-env-row"
        style={rowStyle}
        onClick={() => {
          onSwitch(null);
          close();
        }}
      >
        <span style={{ width: 14, flexShrink: 0 }}>
          {activeEnvironmentId === null && <CheckOutlined style={{ fontSize: 12, color: token.colorPrimary }} />}
        </span>
        <GlobalOutlined style={{ fontSize: 14, color: token.colorTextQuaternary }} />
        <Text style={{ flex: 1, color: token.colorTextSecondary, fontSize: 13 }}>No environment</Text>
      </div>
      {environments.length > 0 && <Divider style={{ margin: '4px 0' }} />}
      {environments.map((env) => {
        const isActive = env.uid === activeEnvironmentId;
        return (
          <div
            key={env.uid}
            role="menuitem"
            className="oh-env-row"
            style={rowStyle}
            onClick={() => {
              onSwitch(env.uid);
              close();
            }}
          >
            <span style={{ width: 14, flexShrink: 0 }}>
              {isActive && <CheckOutlined style={{ fontSize: 12, color: token.colorPrimary }} />}
            </span>
            {scopeBadge('environment', 14)}
            <Text
              style={{
                flex: 1,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
                fontSize: 13,
              }}
            >
              {env.name}
            </Text>
          </div>
        );
      })}
      <Divider style={{ margin: '4px 0' }} />
      <div
        role="menuitem"
        className="oh-env-row"
        style={{ ...rowStyle, color: token.colorTextSecondary }}
        onClick={() => {
          void chrome.tabs.create({ url: getBrowserAPI().runtime.getURL('workbench.html') });
          close();
        }}
      >
        <Text style={{ fontSize: 12, color: token.colorTextTertiary }}>Manage in workspace…</Text>
      </div>
    </div>
  );

  return (
    <Dropdown
      open={open}
      onOpenChange={setOpen}
      popupRender={() => dropdownContent}
      trigger={['click']}
      placement="bottomRight"
    >
      <Button
        type="text"
        size="small"
        aria-label={active ? `Active environment: ${active.name}` : 'No environment selected'}
        style={{
          padding: '0 8px',
          height: 24,
          display: 'inline-flex',
          alignItems: 'center',
          border: `1px solid ${token.colorBorderSecondary}`,
          background: token.colorBgContainer,
        }}
      >
        <Space size={4}>
          {active ? scopeBadge('environment', 12) : <GlobalOutlined style={{ fontSize: 12, color: token.colorTextTertiary }} />}
          <Text
            style={{
              maxWidth: 120,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              color: active ? token.colorText : token.colorTextSecondary,
              fontSize: 12,
            }}
          >
            {active?.name ?? 'No environment'}
          </Text>
          <DownOutlined style={{ fontSize: 9, color: token.colorTextTertiary }} />
        </Space>
      </Button>
    </Dropdown>
  );
};
