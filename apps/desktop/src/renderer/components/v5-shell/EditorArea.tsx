/**
 * EditorArea — editor content area (rendered inside the tab/breadcrumb container).
 *
 * Renders ALL open tab editors simultaneously but hides inactive ones with
 * display:none. This preserves local state (unsaved changes, cursor position,
 * scroll position) when switching between tabs.
 */

import { ApiOutlined, GlobalOutlined, RocketOutlined, ThunderboltOutlined } from '@ant-design/icons';
import { Button, Space, Typography, theme } from 'antd';
import type React from 'react';
import { useEffect } from 'react';
import appIcon from '@/renderer/images/icon128.png';
import { CollectionVariablesEditor } from './editors/CollectionVariablesEditor';
import { EnvironmentEditor } from './editors/EnvironmentEditor';
import { RuleEditor } from './editors/RuleEditor';
import { SourceEditor } from './editors/RequestEditor';
import { WorkspaceVariablesEditor } from './editors/WorkspaceVariablesEditor';
import type { ResolvedTab } from './hooks/useResolvedTabs';
import type { Tab } from './hooks/useTabs';
import { SettingsEditor } from './SettingsEditor';

const { Title, Text } = Typography;

interface EditorAreaProps {
  tabs: ResolvedTab[];
  activeTab?: ResolvedTab | null;
  onNewRequest?: () => void;
  onNewRule?: () => void;
  onNewEnvironment?: () => void;
  onOpenOverview?: () => void;
  onDirtyChange?: (dirty: boolean) => void;
  onSaveLabelChange?: (label: string | null) => void;
  saveRef?: React.MutableRefObject<(() => void) | null>;
  responseSideBySide?: boolean;
  workspaceName?: string;
  onSaveDraft?: (tabId: string, draftData: Record<string, unknown>) => void;
}

function OverviewScreen({ workspaceName }: { workspaceName?: string }) {
  const { token } = theme.useToken();
  return (
    <div className="v5-editor-content v5-welcome" style={{ background: token.colorBgContainer }}>
      <img src={appIcon} alt="Open Headers" style={{ width: 48, height: 48, marginBottom: 16 }} />
      <Title level={3} style={{ marginBottom: 4 }}>
        {workspaceName ?? 'Workspace'}
      </Title>
      <Text type="secondary" style={{ marginBottom: 32 }}>
        Open Headers — The open-source browser DevTools you're missing
      </Text>
    </div>
  );
}

function EmptyPlaceholder({
  onNewRequest,
  onNewRule,
  onNewEnvironment,
  onOpenOverview,
}: {
  onNewRequest?: () => void;
  onNewRule?: () => void;
  onNewEnvironment?: () => void;
  onOpenOverview?: () => void;
}) {
  const { token } = theme.useToken();
  return (
    <div className="v5-editor-content v5-welcome" style={{ background: token.colorBgContainer }}>
      <img src={appIcon} alt="Open Headers" style={{ width: 48, height: 48, marginBottom: 24, opacity: 0.3 }} />
      <Space direction="vertical" size={4} style={{ width: '100%', maxWidth: 280 }}>
        <Button type="text" block onClick={onNewRequest} style={{ justifyContent: 'flex-start' }}>
          <ApiOutlined /> Create new request
          <Text type="secondary" style={{ marginLeft: 'auto', fontSize: 11 }}>
            {'\u2318'}N
          </Text>
        </Button>
        <Button type="text" block onClick={onNewRule} style={{ justifyContent: 'flex-start' }}>
          <ThunderboltOutlined /> Create new rule
          <Text type="secondary" style={{ marginLeft: 'auto', fontSize: 11 }}>
            {'\u21E7\u2318'}N
          </Text>
        </Button>
        <Button type="text" block onClick={onNewEnvironment} style={{ justifyContent: 'flex-start' }}>
          <GlobalOutlined /> Create new environment
        </Button>
        <Button type="text" block style={{ justifyContent: 'flex-start' }}>
          <RocketOutlined /> Import collection
          <Text type="secondary" style={{ marginLeft: 'auto', fontSize: 11 }}>
            {'\u2318'}O
          </Text>
        </Button>
        <Button type="text" block onClick={onOpenOverview} style={{ justifyContent: 'flex-start' }}>
          Open workspace overview
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
  onSaveDraft,
}: {
  tab: Tab;
  isActive: boolean;
  onDirtyChange?: (dirty: boolean) => void;
  onSaveLabelChange?: (label: string | null) => void;
  saveRef?: React.MutableRefObject<(() => void) | null>;
  responseSideBySide?: boolean;
  onSaveDraft?: (tabId: string, draftData: Record<string, unknown>) => void;
}) {
  // Only pass dirty/save callbacks to the active editor
  const dirtyChange = isActive ? onDirtyChange : undefined;
  const saveLabelChange = isActive ? onSaveLabelChange : undefined;
  const save = isActive ? saveRef : undefined;

  let content: React.ReactNode = null;

  if (tab.draft && tab.draftData) {
    // Draft tabs — editors work with local-only state
    if (tab.type === 'request') {
      content = (
        <SourceEditor
          draftData={tab.draftData}
          onDirtyChange={dirtyChange}
          onSaveLabelChange={saveLabelChange}
          saveRef={save}
          responseSideBySide={responseSideBySide}
          onSaveDraft={onSaveDraft ? (data) => onSaveDraft(tab.id, data) : undefined}
        />
      );
    } else if (tab.type === 'rule') {
      content = (
        <RuleEditor
          draftData={tab.draftData}
          onDirtyChange={dirtyChange}
          saveRef={save}
          onSaveDraft={onSaveDraft ? (data) => onSaveDraft(tab.id, data) : undefined}
        />
      );
    } else if (tab.type === 'environment') {
      content = (
        <EnvironmentEditor
          draftData={tab.draftData}
          onDirtyChange={dirtyChange}
          saveRef={save}
          onSaveDraft={onSaveDraft ? (data) => onSaveDraft(tab.id, data) : undefined}
        />
      );
    }
  } else if (tab.type === 'settings') {
    content = <SettingsEditor />;
  } else if (tab.type === 'globals') {
    content = <WorkspaceVariablesEditor onDirtyChange={dirtyChange} saveRef={save} />;
  } else if (tab.type === 'collection-variables' && tab.entityId) {
    content = <CollectionVariablesEditor collectionId={tab.entityId} onDirtyChange={dirtyChange} saveRef={save} />;
  } else if (tab.type === 'rule' && tab.entityId) {
    content = <RuleEditor ruleId={tab.entityId} onDirtyChange={dirtyChange} saveRef={save} />;
  } else if (tab.type === 'environment' && tab.entityId) {
    content = <EnvironmentEditor environmentId={tab.entityId} onDirtyChange={dirtyChange} saveRef={save} />;
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
  } else if (tab.type === 'collection-overview' && tab.entityId) {
    content = (
      <div style={{ padding: '24px 32px' }}>
        <Title level={4}>Collection Overview</Title>
        <Text type="secondary">Collection details coming soon.</Text>
      </div>
    );
  } else if (tab.type === 'folder-overview' && tab.entityId) {
    content = (
      <div style={{ padding: '24px 32px' }}>
        <Title level={4}>Folder Overview</Title>
        <Text type="secondary">Folder details coming soon.</Text>
      </div>
    );
  }

  if (!content) return null;

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
  onNewEnvironment,
  onOpenOverview,
  onDirtyChange,
  onSaveLabelChange,
  saveRef,
  responseSideBySide,
  workspaceName,
  onSaveDraft,
}: EditorAreaProps) {
  // Clear dirty state when switching to a non-editor tab
  useEffect(() => {
    if (!activeTab || activeTab.type === 'overview') {
      onDirtyChange?.(false);
      onSaveLabelChange?.(null);
      if (saveRef) saveRef.current = null;
    }
  }, [activeTab, onDirtyChange, onSaveLabelChange, saveRef]);

  // Tabs that have editors (not overview, not settings — those are singletons rendered separately)
  const editorTabs = tabs.filter((t) => t.type !== 'overview' && (t.entityId || t.type === 'globals' || t.draft));

  const showOverview = activeTab?.type === 'overview';
  const showEmpty = !activeTab;

  return (
    <div className="v5-editor-content" style={{ position: 'relative' }}>
      {/* Empty placeholder — shown when no tabs are open at all */}
      {showEmpty && (
        <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column' }}>
          <EmptyPlaceholder
            onNewRequest={onNewRequest}
            onNewRule={onNewRule}
            onNewEnvironment={onNewEnvironment}
            onOpenOverview={onOpenOverview}
          />
        </div>
      )}

      {/* Overview tab */}
      {showOverview && (
        <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column' }}>
          <OverviewScreen workspaceName={workspaceName} />
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
          onSaveDraft={onSaveDraft}
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
