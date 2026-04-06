/**
 * EditorArea — editor content area (rendered inside the tab/breadcrumb container).
 *
 * Renders ALL open tab editors simultaneously but hides inactive ones with
 * display:none. This preserves local state (unsaved changes, cursor position,
 * scroll position) when switching between tabs.
 */

import { ApiOutlined, PlusOutlined, RocketOutlined, ThunderboltOutlined } from '@ant-design/icons';
import { Button, Space, Typography, theme } from 'antd';
import type React from 'react';
import { useEffect } from 'react';
import appIcon from '@/renderer/images/icon128.png';
import { EnvironmentEditor } from './editors/EnvironmentEditor';
import { RuleEditor } from './editors/RuleEditor';
import { SourceEditor } from './editors/SourceEditor';
import type { Tab } from './hooks/useTabs';
import { SettingsEditor } from './SettingsEditor';

const { Title, Text } = Typography;

interface EditorAreaProps {
  tabs: Tab[];
  activeTab?: Tab | null;
  onNewRequest?: () => void;
  onNewRule?: () => void;
  onDirtyChange?: (dirty: boolean) => void;
  onSaveLabelChange?: (label: string | null) => void;
  saveRef?: React.MutableRefObject<(() => void) | null>;
  responseSideBySide?: boolean;
}

function WelcomeScreen({ onNewRequest, onNewRule }: { onNewRequest?: () => void; onNewRule?: () => void }) {
  const { token } = theme.useToken();
  return (
    <div className="v5-editor-content v5-welcome" style={{ background: token.colorBgContainer }}>
      <img src={appIcon} alt="Open Headers" style={{ width: 48, height: 48, marginBottom: 16 }} />
      <Title level={3} style={{ marginBottom: 4 }}>
        Open Headers — Next
      </Title>
      <Text type="secondary" style={{ marginBottom: 32 }}>
        The definitive open-source browser DevTools platform
      </Text>

      <Space direction="vertical" size={12} style={{ width: '100%', maxWidth: 320 }}>
        <Button type="primary" icon={<ApiOutlined />} block onClick={onNewRequest}>
          <PlusOutlined /> New Request
        </Button>
        <Button icon={<ThunderboltOutlined />} block onClick={onNewRule}>
          <PlusOutlined /> New Rule
        </Button>
        <Button icon={<RocketOutlined />} block>
          Import from Postman / Bruno / Insomnia
        </Button>
      </Space>
    </div>
  );
}

function TabEditor({
  tab,
  isActive,
  onDirtyChange,
  onSaveLabelChange,
  saveRef,
  responseSideBySide,
}: {
  tab: Tab;
  isActive: boolean;
  onDirtyChange?: (dirty: boolean) => void;
  onSaveLabelChange?: (label: string | null) => void;
  saveRef?: React.MutableRefObject<(() => void) | null>;
  responseSideBySide?: boolean;
}) {
  // Only pass dirty/save callbacks to the active editor
  const dirtyChange = isActive ? onDirtyChange : undefined;
  const saveLabelChange = isActive ? onSaveLabelChange : undefined;
  const save = isActive ? saveRef : undefined;

  let content: React.ReactNode = null;

  if (tab.type === 'settings') {
    content = <SettingsEditor />;
  } else if (tab.type === 'rule' && tab.entityId) {
    content = <RuleEditor ruleId={tab.entityId} onDirtyChange={dirtyChange} saveRef={save} />;
  } else if (tab.type === 'environment' && tab.entityId) {
    content = <EnvironmentEditor environmentName={tab.entityId} />;
  } else if ((tab.type === 'collection' || tab.type === 'request') && tab.entityId) {
    content = (
      <SourceEditor
        sourceId={tab.entityId}
        onDirtyChange={dirtyChange}
        onSaveLabelChange={saveLabelChange}
        saveRef={save}
        responseSideBySide={responseSideBySide}
      />
    );
  }

  if (!content) return null;

  // Use visibility:hidden + absolute positioning instead of display:none.
  // display:none causes zero-width containers that crash antd's internal
  // EllipsisMeasure component (infinite setState loop in layout effect).
  return (
    <div
      style={
        isActive
          ? { position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column' }
          : {
              position: 'absolute',
              inset: 0,
              display: 'flex',
              flexDirection: 'column' as const,
              overflow: 'hidden',
              visibility: 'hidden' as const,
              pointerEvents: 'none' as const,
            }
      }
    >
      {content}
    </div>
  );
}

export function EditorArea({
  tabs,
  activeTab,
  onNewRequest,
  onNewRule,
  onDirtyChange,
  onSaveLabelChange,
  saveRef,
  responseSideBySide,
}: EditorAreaProps) {
  // Clear dirty state when switching to a non-editor tab
  useEffect(() => {
    if (!activeTab || activeTab.type === 'welcome') {
      onDirtyChange?.(false);
      onSaveLabelChange?.(null);
      if (saveRef) saveRef.current = null;
    }
  }, [activeTab, onDirtyChange, onSaveLabelChange, saveRef]);

  // Tabs that have editors (not welcome)
  const editorTabs = tabs.filter((t) => t.type !== 'welcome' && t.entityId);

  const showWelcome = !activeTab || activeTab.type === 'welcome';

  return (
    <div className="v5-editor-content" style={{ position: 'relative' }}>
      {showWelcome && (
        <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column' }}>
          <WelcomeScreen onNewRequest={onNewRequest} onNewRule={onNewRule} />
        </div>
      )}

      {editorTabs.map((tab) => (
        <TabEditor
          key={tab.id}
          tab={tab}
          isActive={activeTab?.id === tab.id}
          onDirtyChange={onDirtyChange}
          onSaveLabelChange={onSaveLabelChange}
          saveRef={saveRef}
          responseSideBySide={responseSideBySide}
        />
      ))}

      {/* Settings tab (singleton, no entityId) */}
      {tabs.some((t) => t.type === 'settings') && (
        <div
          style={
            activeTab?.type === 'settings'
              ? { position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column' }
              : { position: 'absolute', inset: 0, overflow: 'hidden', visibility: 'hidden', pointerEvents: 'none' }
          }
        >
          <SettingsEditor />
        </div>
      )}
    </div>
  );
}
