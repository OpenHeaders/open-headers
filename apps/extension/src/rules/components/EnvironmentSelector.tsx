/**
 * EnvironmentSelector — TopBar dropdown for switching the active
 * environment. Mirrors the Postman/Bruno model: a single active env,
 * plus "No environment" as a valid choice (variables still resolve
 * from workspace/collection/vault).
 *
 * Business logic lives in `useEnvironments`; this component delegates
 * switch + navigation. Variables/Vault management opens a dedicated
 * tab in workspace.html via the provided opener callbacks.
 */

import {
  CheckOutlined,
  DownOutlined,
  GlobalOutlined,
  LockOutlined,
  PlusOutlined,
  SettingOutlined,
} from '@ant-design/icons';
import type { V5 } from '@openheaders/core/types';
import type { MenuProps } from 'antd';
import { Button, Dropdown, Space, Typography, theme } from 'antd';
import type React from 'react';
import { useMemo } from 'react';

const { Text } = Typography;

interface EnvironmentSelectorProps {
  environments: V5.Environment[];
  activeEnvironmentId: string | null;
  onSwitch: (uid: string | null) => void;
  onCreateEnvironment: () => void;
  onOpenEnvironment: (uid: string) => void;
  onOpenWorkspaceVariables: () => void;
  onOpenVault: () => void;
}

const EnvironmentSelector: React.FC<EnvironmentSelectorProps> = ({
  environments,
  activeEnvironmentId,
  onSwitch,
  onCreateEnvironment,
  onOpenEnvironment,
  onOpenWorkspaceVariables,
  onOpenVault,
}) => {
  const { token } = theme.useToken();
  const active = activeEnvironmentId ? (environments.find((e) => e.uid === activeEnvironmentId) ?? null) : null;

  const items: MenuProps['items'] = useMemo(() => {
    const envRows: MenuProps['items'] = environments.map((env) => ({
      key: env.uid,
      label: (
        <Space size={8} style={{ minWidth: 200, width: '100%' }}>
          <GlobalOutlined style={{ fontSize: 12, color: token.colorTextTertiary }} />
          <Text style={{ flex: 1 }}>{env.name}</Text>
          {env.uid === activeEnvironmentId ? (
            <CheckOutlined style={{ color: token.colorPrimary, fontSize: 12 }} />
          ) : (
            <span style={{ width: 12, display: 'inline-block' }} />
          )}
          <Button
            size="small"
            type="text"
            icon={<SettingOutlined />}
            onClick={(e) => {
              e.stopPropagation();
              onOpenEnvironment(env.uid);
            }}
            aria-label={`Edit ${env.name}`}
          />
        </Space>
      ),
      onClick: () => {
        if (env.uid !== activeEnvironmentId) onSwitch(env.uid);
      },
    }));

    return [
      {
        key: 'no-env',
        label: (
          <Space size={8} style={{ minWidth: 200, width: '100%' }}>
            <GlobalOutlined style={{ fontSize: 12, color: token.colorTextQuaternary }} />
            <Text style={{ flex: 1, color: token.colorTextSecondary }}>No environment</Text>
            {activeEnvironmentId === null ? (
              <CheckOutlined style={{ color: token.colorPrimary, fontSize: 12 }} />
            ) : (
              <span style={{ width: 12, display: 'inline-block' }} />
            )}
          </Space>
        ),
        onClick: () => {
          if (activeEnvironmentId !== null) onSwitch(null);
        },
      },
      ...(envRows.length > 0 ? [{ type: 'divider' as const, key: 'div-envs' } as const] : []),
      ...envRows,
      { type: 'divider' as const, key: 'div-manage' },
      {
        key: 'create',
        icon: <PlusOutlined />,
        label: 'New environment',
        onClick: onCreateEnvironment,
      },
      {
        key: 'workspace-vars',
        icon: <SettingOutlined />,
        label: 'Workspace variables…',
        onClick: onOpenWorkspaceVariables,
      },
      {
        key: 'vault',
        icon: <LockOutlined />,
        label: 'Vault…',
        onClick: onOpenVault,
      },
    ];
  }, [
    environments,
    activeEnvironmentId,
    onSwitch,
    onCreateEnvironment,
    onOpenEnvironment,
    onOpenWorkspaceVariables,
    onOpenVault,
    token,
  ]);

  return (
    <Dropdown menu={{ items }} trigger={['click']} placement="bottomRight">
      <Button
        type="text"
        size="small"
        aria-label={active ? `Active environment: ${active.name}` : 'No environment selected'}
        style={{
          padding: '0 8px',
          height: 28,
          display: 'inline-flex',
          alignItems: 'center',
          border: `1px solid ${token.colorBorderSecondary}`,
          background: token.colorBgContainer,
        }}
      >
        <Space size={6}>
          <GlobalOutlined style={{ fontSize: 12, color: active ? token.colorPrimary : token.colorTextTertiary }} />
          <Text
            style={{
              maxWidth: 140,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              color: active ? token.colorText : token.colorTextSecondary,
            }}
          >
            {active?.name ?? 'No environment'}
          </Text>
          <DownOutlined style={{ fontSize: 10, color: token.colorTextTertiary }} />
        </Space>
      </Button>
    </Dropdown>
  );
};

export default EnvironmentSelector;
