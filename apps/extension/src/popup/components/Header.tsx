import { DownloadOutlined, NodeExpandOutlined, SettingOutlined } from '@ant-design/icons';
import { useRules } from '@hooks/useRules';
import { App, Badge, Button, Space, Switch, Tooltip, Typography, theme } from 'antd';
import type React from 'react';
import { useSetting } from '@/rules/settings/hooks';
import { getBrowserAPI } from '@/types/browser';

const { Title, Text } = Typography;

const Header: React.FC = () => {
  const { token } = theme.useToken();
  const { isConnected, isStatusLoaded } = useRules();
  const { message } = App.useApp();
  const [isRulesExecutionPaused, setIsRulesExecutionPaused] = useSetting('rulesEngine.paused');

  const handleGlobalRulesToggle = async (checked: boolean): Promise<void> => {
    setIsRulesExecutionPaused(!checked);
    message.success(checked ? 'Rules execution resumed' : 'Rules execution paused');
  };

  const handleOpenSettings = (): void => {
    const url = getBrowserAPI().runtime.getURL('workspace.html#/settings');
    getBrowserAPI().tabs.create({ url });
  };

  const disconnectedTooltip = (
    <div style={{ fontSize: 12, lineHeight: 1.6, maxWidth: 240 }}>
      <div style={{ fontWeight: 600, marginBottom: 4 }}>Desktop app not detected</div>
      <div style={{ opacity: 0.8, marginBottom: 8 }}>
        Install the desktop app to unlock workspaces, variables, team sync, and workflow recordings.
      </div>
      <Button
        type="primary"
        size="small"
        icon={<DownloadOutlined />}
        onClick={() => window.open('https://openheaders.io', '_blank')}
        style={{ fontSize: 11, height: 24 }}
      >
        Get the desktop app
      </Button>
    </div>
  );

  return (
    <div className="header">
      <Space align="center" size={8}>
        <img
          src={getBrowserAPI().runtime.getURL('images/logo-pixel.svg')}
          alt="Open Headers"
          style={{ width: 26, height: 26 }}
        />
        <Title level={4} className="popup-header-title" style={{ margin: 0 }}>
          Open Headers
        </Title>
        {isStatusLoaded &&
          (isConnected ? (
            <Badge status="success" />
          ) : (
            <Tooltip title={disconnectedTooltip} placement="bottom" styles={{ root: { maxWidth: 280 } }}>
              <span style={{ cursor: 'help', display: 'inline-flex' }}>
                <Badge status="error" />
              </span>
            </Tooltip>
          ))}
      </Space>
      <Space align="center" size={12}>
        <div
          className="header-rules-toggle"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            padding: '0 8px',
            borderLeft: `1px solid ${token.colorBorderSecondary}`,
          }}
        >
          <NodeExpandOutlined
            style={{
              fontSize: '14px',
              color: isRulesExecutionPaused ? token.colorWarning : token.colorTextSecondary,
            }}
          />
          <Text
            style={{
              fontSize: '12px',
              color: isRulesExecutionPaused ? token.colorWarning : token.colorTextSecondary,
            }}
          >
            Rules
          </Text>
          <Tooltip
            title={
              isRulesExecutionPaused
                ? 'Resume rules execution'
                : 'Pause all rules (preserves individual rule settings)'
            }
          >
            <Switch
              size="default"
              checked={!isRulesExecutionPaused}
              onChange={handleGlobalRulesToggle}
              checkedChildren="Active"
              unCheckedChildren="Paused"
            />
          </Tooltip>
        </div>
        <Tooltip title="Open settings">
          <Button
            type="text"
            size="small"
            icon={<SettingOutlined />}
            onClick={handleOpenSettings}
            style={{
              padding: '4px 8px',
              height: 'auto',
              display: 'flex',
              alignItems: 'center',
            }}
          />
        </Tooltip>
      </Space>
    </div>
  );
};

export default Header;
