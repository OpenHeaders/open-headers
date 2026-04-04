/**
 * Inspector — right sidebar with context-sensitive tabs.
 *
 * Tabs change based on editor context:
 * - Request: Variables | Linked Rules | Code Gen
 * - Rule: Variables | Matched Requests | Linked Request
 * - Environment: Variables (all)
 */

import { Typography, theme } from 'antd';
import { useMemo, useState } from 'react';
import { useEnvironments } from '@/renderer/hooks/useCentralizedWorkspace';
import type { DisplayVariable } from './inspector/VariablesPanel';
import { VariablesPanel } from './inspector/VariablesPanel';

const { Text } = Typography;

type InspectorTab = 'variables' | 'linked-rules' | 'code-gen';

export function Inspector() {
  const { token } = theme.useToken();
  const [activeTab, setActiveTab] = useState<InspectorTab>('variables');
  const { environments, activeEnvironment } = useEnvironments();

  const allVars = useMemo(() => {
    const envVars: DisplayVariable[] = [];
    const activeEnvData = environments[activeEnvironment];
    if (activeEnvData) {
      for (const [name, variable] of Object.entries(activeEnvData)) {
        envVars.push({
          name,
          value: variable.value,
          scope: 'environment',
          isSecret: variable.isSecret,
          resolved: true,
        });
      }
    }
    return {
      vault: [],
      environment: envVars,
      collection: [],
      globals: [],
    };
  }, [environments, activeEnvironment]);

  const tabs: Array<{ key: InspectorTab; label: string }> = [
    { key: 'variables', label: 'Variables' },
    { key: 'linked-rules', label: 'Linked Rules' },
    { key: 'code-gen', label: 'Code Gen' },
  ];

  return (
    <div className="v5-inspector" style={{ background: token.colorBgContainer }}>
      <div
        className="v5-inspector-header"
        style={{
          borderBottom: `1px solid ${token.colorBorderSecondary}`,
          background: token.colorBgElevated,
        }}
      >
        <div className="v5-inspector-title">
          <Text strong style={{ fontSize: 12 }}>
            Inspector
          </Text>
        </div>
        <div className="v5-inspector-tabs">
          {tabs.map((tab) => (
            <span
              key={tab.key}
              className={`v5-inspector-tab ${activeTab === tab.key ? 'active' : ''}`}
              style={
                activeTab === tab.key
                  ? { color: token.colorText, borderBottomColor: token.colorPrimary }
                  : { color: token.colorTextSecondary }
              }
              onClick={() => setActiveTab(tab.key)}
              role="tab"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === 'Enter') setActiveTab(tab.key);
              }}
            >
              {tab.label}
            </span>
          ))}
        </div>
      </div>

      <div className="v5-inspector-content">
        {activeTab === 'variables' && <VariablesPanel activeEnvironment={activeEnvironment} allVars={allVars} />}
        {activeTab === 'linked-rules' && (
          <div style={{ padding: 10, color: token.colorTextTertiary, fontSize: 12 }}>
            <Text type="secondary">No linked rules. Select a request that is used as a value source by a rule.</Text>
          </div>
        )}
        {activeTab === 'code-gen' && (
          <div style={{ padding: 10 }}>
            <div className="v5-codegen-row" style={{ color: token.colorTextSecondary }}>
              📋 cURL
            </div>
            <div className="v5-codegen-row" style={{ color: token.colorTextSecondary }}>
              📋 JavaScript (fetch)
            </div>
            <div className="v5-codegen-row" style={{ color: token.colorTextSecondary }}>
              📋 Python (requests)
            </div>
            <div className="v5-codegen-row" style={{ color: token.colorTextSecondary }}>
              📋 Go (net/http)
            </div>
            <div className="v5-codegen-row" style={{ color: token.colorTextSecondary }}>
              📋 Node.js (axios)
            </div>
          </div>
        )}
      </div>

      <div
        className="v5-inspector-footer"
        style={{
          borderTop: `1px solid ${token.colorBorderSecondary}`,
          background: token.colorBgElevated,
          color: token.colorTextTertiary,
        }}
      >
        <Text type="secondary" style={{ fontSize: 10 }}>
          Resolution: Vault &rarr; Environment &rarr; Collection &rarr; Globals
        </Text>
      </div>
    </div>
  );
}
