/**
 * Sidebar — unified items panel with collapsible sections.
 *
 * Shows Collections, Rules, and Environments in one scrollable view.
 * Switches content based on the active ActivityBar panel.
 */

import { PlusOutlined, ThunderboltOutlined } from '@ant-design/icons';
import { Typography, theme } from 'antd';
import type { ActivityPanel } from './V5Shell';

const { Text } = Typography;

interface SidebarProps {
  activePanel: ActivityPanel;
}

function SidebarSection({ title, onAdd }: { title: string; onAdd?: () => void }) {
  const { token } = theme.useToken();
  return (
    <div className="v5-sidebar-section" style={{ color: token.colorTextSecondary }}>
      <span className="v5-sidebar-section-title">{title}</span>
      {onAdd && <PlusOutlined className="v5-sidebar-add" style={{ color: token.colorTextSecondary }} onClick={onAdd} />}
    </div>
  );
}

function ItemsPanel() {
  const { token } = theme.useToken();
  return (
    <>
      <SidebarSection title="COLLECTIONS" onAdd={() => {}} />
      <div className="v5-sidebar-empty" style={{ color: token.colorTextTertiary }}>
        No collections yet. Create one to organize your API requests.
      </div>

      <SidebarSection title="RULES" onAdd={() => {}} />
      <div className="v5-sidebar-empty" style={{ color: token.colorTextTertiary }}>
        <ThunderboltOutlined /> Rules will appear here.
      </div>

      <SidebarSection title="ENVIRONMENTS" onAdd={() => {}} />
      <div className="v5-sidebar-empty" style={{ color: token.colorTextTertiary }}>
        No environments configured.
      </div>
    </>
  );
}

function RecordingsPanel() {
  const { token } = theme.useToken();
  return (
    <>
      <SidebarSection title="RECORDINGS" onAdd={() => {}} />
      <div className="v5-sidebar-empty" style={{ color: token.colorTextTertiary }}>
        No recordings yet.
      </div>
    </>
  );
}

function PlaceholderPanel({ title }: { title: string }) {
  const { token } = theme.useToken();
  return (
    <div className="v5-sidebar-empty" style={{ color: token.colorTextTertiary, paddingTop: 24 }}>
      {title} — coming soon.
    </div>
  );
}

export function Sidebar({ activePanel }: SidebarProps) {
  const { token } = theme.useToken();

  return (
    <div className="v5-sidebar" style={{ background: token.colorBgContainer }}>
      <div className="v5-sidebar-content">
        {activePanel === 'items' && <ItemsPanel />}
        {activePanel === 'recordings' && <RecordingsPanel />}
        {activePanel === 'history' && <PlaceholderPanel title="History" />}
        {activePanel === 'files' && <PlaceholderPanel title="Local Files" />}
      </div>

      <div
        className="v5-sidebar-footer"
        style={{
          borderTop: `1px solid ${token.colorBorderSecondary}`,
          background: token.colorBgElevated,
        }}
      >
        <Text type="secondary" style={{ fontSize: 11, cursor: 'pointer' }}>
          Globals
        </Text>
        <Text type="secondary" style={{ fontSize: 11, cursor: 'pointer' }}>
          Vault
        </Text>
        <Text type="secondary" style={{ fontSize: 11, cursor: 'pointer' }}>
          Tools ▾
        </Text>
      </div>
    </div>
  );
}
