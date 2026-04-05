/**
 * Inspector — right sidebar showing "Variables in request" panel.
 *
 * Matches the MVP VariablesPanel design:
 * - Title with count + close button
 * - Search/filter input
 * - "Used in this request" section with scope badges
 * - "All variables" collapsible section with Environment/Collection/Globals/Vault
 */

import { CaretRightOutlined, CloseOutlined, SearchOutlined } from '@ant-design/icons';
import { Badge, Collapse, Input, Space, Table, Tag, Typography, theme } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { useMemo, useState } from 'react';
import { useEnvironments } from '@/renderer/hooks/useCentralizedWorkspace';
import { useEditorVariables } from './contexts/EditorVariablesContext';

const { Text } = Typography;
const { Search } = Input;

interface VarDisplay {
  key: string;
  name: string;
  value: string;
  scope: 'environment' | 'collection' | 'global' | 'vault' | 'unresolved';
  isSecret: boolean;
}

const SCOPE_COLORS: Record<string, string> = {
  environment: 'green',
  collection: 'orange',
  global: 'purple',
  vault: 'red',
  unresolved: 'default',
};

const SCOPE_LETTERS: Record<string, string> = {
  environment: 'E',
  collection: 'C',
  global: 'G',
  vault: 'V',
  unresolved: '-',
};

interface InspectorProps {
  onClose?: () => void;
  expandedKeys?: string[];
  onExpandedKeysChange?: (keys: string[]) => void;
}

export function Inspector({ onClose, expandedKeys: expandedKeysProp, onExpandedKeysChange }: InspectorProps) {
  const { token } = theme.useToken();
  const { environments, activeEnvironment } = useEnvironments();
  const { usedVariables } = useEditorVariables();
  const [searchTerm, setSearchTerm] = useState('');
  const expandedKeys = expandedKeysProp ?? [];
  const setExpandedKeys = (keys: string[]) => onExpandedKeysChange?.(keys);

  const activeEnvData = environments[activeEnvironment] || {};

  // Variables used in the current request/rule
  const inRequestVars: VarDisplay[] = useMemo(() => {
    return usedVariables.map((uv) => {
      const envVar = activeEnvData[uv.name];
      const resolved = !!envVar && !!envVar.value;
      return {
        key: uv.name,
        name: uv.name,
        value: envVar?.isSecret ? '••••••••' : envVar?.value || '',
        scope: resolved ? 'environment' : 'unresolved',
        isSecret: envVar?.isSecret || false,
      };
    });
  }, [usedVariables, activeEnvData]);

  // All variables grouped by scope
  // Note: v4 has no separate Vault/Collection/Global stores — all vars are environment vars.
  // isSecret is just a flag, not a different scope.
  const allByScope = useMemo(() => {
    const envVars: VarDisplay[] = [];
    for (const [name, variable] of Object.entries(activeEnvData)) {
      envVars.push({
        key: name,
        name,
        value: variable.isSecret ? '••••••••' : variable.value,
        scope: 'environment',
        isSecret: variable.isSecret,
      });
    }
    return {
      environment: envVars,
      collection: [] as VarDisplay[],
      global: [] as VarDisplay[],
      vault: [] as VarDisplay[],
    };
  }, [activeEnvData]);

  // Filter
  const filter = (vars: VarDisplay[]) => {
    if (!searchTerm) return vars;
    const term = searchTerm.toLowerCase();
    return vars.filter((v) => v.name.toLowerCase().includes(term) || v.value.toLowerCase().includes(term));
  };

  const ellipsisStyle: React.CSSProperties = {
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
    display: 'block',
  };

  // Columns with scope badge
  const columnsWithScope: ColumnsType<VarDisplay> = [
    {
      key: 'scope',
      width: 36,
      render: (_, r) => (
        <Tag color={SCOPE_COLORS[r.scope]} style={{ margin: 0, minWidth: 22, textAlign: 'center', fontSize: 11 }}>
          {SCOPE_LETTERS[r.scope]}
        </Tag>
      ),
    },
    {
      key: 'name',
      width: '45%',
      render: (_, r) => (
        <Text strong style={{ fontFamily: "'SF Mono', monospace", fontSize: 12, ...ellipsisStyle }}>
          {r.name}
        </Text>
      ),
    },
    {
      key: 'value',
      render: (_, r) => (
        <Text
          style={{
            fontFamily: "'SF Mono', monospace",
            fontSize: 12,
            color: r.isSecret ? '#8c8c8c' : r.value ? '#595959' : '#bfbfbf',
            ...ellipsisStyle,
          }}
        >
          {r.value || 'Enter value'}
        </Text>
      ),
    },
  ];

  // Columns without scope badge
  const columnsNoScope: ColumnsType<VarDisplay> = columnsWithScope.slice(1);

  const totalInRequest = inRequestVars.length;
  const totalAll =
    allByScope.environment.length + allByScope.collection.length + allByScope.global.length + allByScope.vault.length;

  const renderScopeSection = (
    scope: 'environment' | 'collection' | 'global' | 'vault',
    label: string,
    vars: VarDisplay[],
    emptyText: string,
    subtitle?: string,
  ) => (
    <div style={{ marginBottom: 4 }}>
      <div
        style={{
          padding: '8px 16px',
          background: token.colorBgElevated,
          borderBottom: `1px solid ${token.colorBorderSecondary}`,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}
      >
        <Space size={6}>
          <Tag color={SCOPE_COLORS[scope]} style={{ margin: 0, minWidth: 22, textAlign: 'center', fontSize: 11 }}>
            {SCOPE_LETTERS[scope]}
          </Tag>
          <Text strong style={{ fontSize: 12 }}>
            {label}
          </Text>
        </Space>
        {subtitle && (
          <Text type="secondary" style={{ fontSize: 11 }}>
            {subtitle}
          </Text>
        )}
      </div>
      {filter(vars).length > 0 ? (
        <Table
          dataSource={filter(vars)}
          columns={columnsNoScope}
          pagination={false}
          size="small"
          showHeader={false}
          rowKey="key"
          className="v5-inspector-vars"
        />
      ) : (
        <div
          style={{
            padding: 16,
            textAlign: 'center',
            borderBottom: `1px solid ${token.colorBorderSecondary}`,
          }}
        >
          <Text type="secondary" style={{ fontSize: 12 }}>
            {emptyText}
          </Text>
        </div>
      )}
    </div>
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: token.colorBgLayout }}>
      {/* Header */}
      <div
        style={{
          padding: '12px 16px',
          borderBottom: `1px solid ${token.colorBorderSecondary}`,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexShrink: 0,
        }}
      >
        <Space size={8}>
          <Text strong style={{ fontSize: 14 }}>
            Variables in request
          </Text>
          {totalInRequest > 0 && <Badge count={totalInRequest} size="small" />}
        </Space>
        {onClose && (
          <CloseOutlined
            style={{ color: token.colorTextTertiary, cursor: 'pointer', fontSize: 12 }}
            onClick={onClose}
          />
        )}
      </div>

      {/* Search */}
      <div style={{ padding: '8px 16px', borderBottom: `1px solid ${token.colorBorderSecondary}`, flexShrink: 0 }}>
        <Search
          placeholder="Filter variables"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          allowClear
          size="small"
          prefix={<SearchOutlined />}
        />
      </div>

      {/* Content */}
      <div style={{ flex: 1, overflowY: 'auto' }}>
        {/* Used in this request */}
        {filter(inRequestVars).length > 0 && (
          <div>
            <div
              style={{
                padding: '8px 16px',
                background: token.colorBgElevated,
                borderBottom: `1px solid ${token.colorBorderSecondary}`,
              }}
            >
              <Text strong style={{ fontSize: 12 }}>
                Used in this request
              </Text>
            </div>
            <Table
              dataSource={filter(inRequestVars)}
              columns={columnsWithScope}
              pagination={false}
              size="small"
              showHeader={false}
              rowKey="key"
            />
          </div>
        )}

        {inRequestVars.length === 0 && (
          <div style={{ padding: 16, textAlign: 'center' }}>
            <Text type="secondary" style={{ fontSize: 12 }}>
              No variables used. Use {`{{variable_name}}`} syntax in your request.
            </Text>
          </div>
        )}

        {/* All variables */}
        <Collapse
          activeKey={expandedKeys}
          onChange={(keys) => setExpandedKeys(keys as string[])}
          ghost
          expandIcon={({ isActive }) => <CaretRightOutlined rotate={isActive ? 90 : 0} />}
        >
          <Collapse.Panel
            header={
              <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%' }}>
                <Text strong style={{ fontSize: 12 }}>
                  All variables
                </Text>
                {totalAll > 0 && <Badge count={totalAll} size="small" />}
              </div>
            }
            key="all-vars"
            style={{ borderTop: `1px solid ${token.colorBorderSecondary}` }}
          >
            {renderScopeSection(
              'environment',
              'Environment',
              allByScope.environment,
              'No environment variables defined',
              activeEnvironment,
            )}
            {renderScopeSection('collection', 'Collection', allByScope.collection, 'No collection variables defined')}
            {renderScopeSection('global', 'Globals', allByScope.global, 'No global variables defined')}
            {renderScopeSection('vault', 'Vault', allByScope.vault, 'No vault secrets defined')}
          </Collapse.Panel>
        </Collapse>
      </div>
    </div>
  );
}
