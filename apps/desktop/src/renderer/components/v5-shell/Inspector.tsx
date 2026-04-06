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
import { Collapse, Input, Table, Tag, Typography, theme } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { useMemo, useState } from 'react';
import { useEnvironments, useSources } from '@/renderer/hooks/useCentralizedWorkspace';
import { useEditorVariables } from './contexts/EditorVariablesContext';

const { Text } = Typography;
const { Search } = Input;

interface VarDisplay {
  key: string;
  name: string;
  value: string;
  scope: 'environment' | 'collection' | 'workspace' | 'secret' | 'unresolved';
  isSensitive: boolean;
  /** Source name that produces this variable (when scope is environment but value comes from a source). */
  producedBy?: string;
}

const SCOPE_COLORS: Record<string, string> = {
  environment: 'green',
  collection: 'orange',
  workspace: 'purple',
  secret: 'red',
  unresolved: 'default',
};

const SCOPE_LETTERS: Record<string, string> = {
  environment: 'E',
  collection: 'C',
  workspace: 'W',
  secret: 'S',
  unresolved: '-',
};

// ── Expandable value cell — one-liner by default, click to expand ──

function ExpandableValue({ value, color, isSensitive }: { value: string; color: string; isSensitive?: boolean }) {
  const [expanded, setExpanded] = useState(false);

  const borderStyle = { paddingLeft: 8, borderLeft: '1px solid var(--ant-color-border-secondary, #f0f0f0)' };

  if (!value) {
    return (
      <span
        style={{
          fontFamily: "'SF Mono', monospace",
          fontSize: 11,
          color,
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
          display: 'block',
          minWidth: 0,
          ...borderStyle,
        }}
      >
        Enter value
      </span>
    );
  }

  if (expanded) {
    return (
      <div style={{ minWidth: 0, ...borderStyle }}>
        <Input.TextArea
          value={value}
          readOnly
          variant="borderless"
          autoSize={{ minRows: 1, maxRows: 4 }}
          onBlur={() => setExpanded(false)}
          autoFocus
          style={{
            fontFamily: "'SF Mono', monospace",
            fontSize: 11,
            color,
            padding: 0,
            resize: 'none',
          }}
        />
      </div>
    );
  }

  const displayValue = isSensitive ? '••••••••' : value;

  return (
    <div
      style={{
        fontFamily: "'SF Mono', monospace",
        fontSize: 11,
        color,
        minWidth: 0,
        cursor: 'pointer',
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        whiteSpace: 'nowrap',
        ...borderStyle,
      }}
      onClick={() => setExpanded(true)}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter') setExpanded(true);
      }}
    >
      {displayValue}
    </div>
  );
}

interface InspectorProps {
  onClose?: () => void;
  expandedKeys?: string[];
  onExpandedKeysChange?: (keys: string[]) => void;
  /** Active tab type — controls which scope sections are shown */
  activeTabType?: string;
}

export function Inspector({
  onClose,
  expandedKeys: expandedKeysProp,
  onExpandedKeysChange,
  activeTabType,
}: InspectorProps) {
  const { token } = theme.useToken();
  const { environments, activeEnvironment } = useEnvironments();
  const { sources } = useSources();
  const { usedVariables } = useEditorVariables();
  const [searchTerm, setSearchTerm] = useState('');
  const expandedKeys = expandedKeysProp ?? [];
  const setExpandedKeys = (keys: string[]) => onExpandedKeysChange?.(keys);

  const activeEnv = activeEnvironment ? environments.find((e) => e.id === activeEnvironment) : undefined;
  const activeEnvData = activeEnv?.variables ?? {};

  // Source-produced variable lookup: sources with storeAsVariable set
  const sourceOutputMap = useMemo(() => {
    const map = new Map<string, { value: string; sourceName: string }>();
    for (const source of sources) {
      if (
        source.storeAsVariable &&
        source.sourceContent !== null &&
        source.sourceContent !== undefined &&
        source.activationState !== 'waiting_for_deps'
      ) {
        map.set(source.storeAsVariable, {
          value: source.sourceContent,
          sourceName: source.sourceName || source.sourcePath || source.sourceId,
        });
      }
    }
    return map;
  }, [sources]);

  // Variables used in the current request/rule
  const inRequestVars: VarDisplay[] = useMemo(() => {
    return usedVariables.map((uv) => {
      // Check environment first
      const envVar = activeEnvData[uv.name];
      if (envVar?.value) {
        return {
          key: uv.name,
          name: uv.name,
          value: envVar.value,
          scope: 'environment' as const,
          isSensitive: envVar.isSensitive,
        };
      }

      // Check source-produced variables
      const sourceOutput = sourceOutputMap.get(uv.name);
      if (sourceOutput) {
        return {
          key: uv.name,
          name: uv.name,
          value: sourceOutput.value,
          scope: 'environment' as const,
          isSensitive: false,
          producedBy: sourceOutput.sourceName,
        };
      }

      return {
        key: uv.name,
        name: uv.name,
        value: '',
        scope: 'unresolved' as const,
        isSensitive: false,
      };
    });
  }, [usedVariables, activeEnvData, sourceOutputMap]);

  // All variables grouped by scope
  const allByScope = useMemo(() => {
    const envVars: VarDisplay[] = [];
    for (const [name, variable] of Object.entries(activeEnvData)) {
      envVars.push({
        key: name,
        name,
        value: variable.value,
        scope: 'environment',
        isSensitive: variable.isSensitive,
      });
    }

    // Add source-produced variables that aren't already in the environment
    for (const [name, output] of sourceOutputMap) {
      if (!activeEnvData[name]) {
        envVars.push({
          key: name,
          name,
          value: output.value,
          scope: 'environment',
          isSensitive: false,
          producedBy: output.sourceName,
        });
      }
    }

    return {
      environment: envVars,
      collection: [] as VarDisplay[],
      workspace: [] as VarDisplay[],
      secret: [] as VarDisplay[],
    };
  }, [activeEnvData, sourceOutputMap]);

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
        <div>
          <Text strong style={{ fontFamily: "'SF Mono', monospace", fontSize: 12, ...ellipsisStyle }}>
            {r.name}
          </Text>
          {r.producedBy && (
            <Text type="secondary" style={{ fontSize: 10, display: 'block', ...ellipsisStyle }}>
              ← {r.producedBy}
            </Text>
          )}
        </div>
      ),
    },
    {
      key: 'value',
      render: (_, r) => (
        <Text
          style={{
            fontFamily: "'SF Mono', monospace",
            fontSize: 12,
            color: r.isSensitive ? '#8c8c8c' : r.value ? '#595959' : '#bfbfbf',
            ...ellipsisStyle,
          }}
        >
          {r.isSensitive && r.value ? '••••••••' : r.value || 'Enter value'}
        </Text>
      ),
    },
  ];

  const renderScopeSection = (
    scope: 'environment' | 'collection' | 'workspace' | 'secret',
    label: string,
    vars: VarDisplay[],
    emptyText: string,
    subtitle?: string,
  ) => {
    const filtered = filter(vars);
    return (
      <div style={{ marginBottom: 4 }}>
        <div
          style={{
            padding: '8px 12px',
            background: token.colorBgElevated,
            borderBottom: `1px solid ${token.colorBorderSecondary}`,
            display: 'flex',
            alignItems: 'center',
            gap: 6,
          }}
        >
          <Tag color={SCOPE_COLORS[scope]} style={{ margin: 0, minWidth: 22, textAlign: 'center', fontSize: 11 }}>
            {SCOPE_LETTERS[scope]}
          </Tag>
          <Text strong style={{ fontSize: 12 }}>
            {label}
          </Text>
          {subtitle && (
            <Text type="secondary" style={{ fontSize: 10, marginLeft: 'auto', ...ellipsisStyle, maxWidth: 100 }}>
              {subtitle}
            </Text>
          )}
        </div>
        {filtered.length > 0 ? (
          <div>
            {filtered.map((v) => (
              <div
                key={v.key}
                style={{
                  display: 'grid',
                  gridTemplateColumns: '1fr 1fr',
                  borderBottom: `1px solid ${token.colorBorderSecondary}`,
                  padding: '6px 12px',
                  minWidth: 0,
                }}
              >
                <Text
                  strong
                  style={{
                    fontFamily: "'SF Mono', monospace",
                    fontSize: 11,
                    ...ellipsisStyle,
                    minWidth: 0,
                    paddingRight: 8,
                  }}
                >
                  {v.name}
                </Text>
                <ExpandableValue
                  value={v.value}
                  isSensitive={v.isSensitive}
                  color={
                    v.isSensitive
                      ? token.colorTextTertiary
                      : v.value
                        ? token.colorTextSecondary
                        : token.colorTextQuaternary
                  }
                />
              </div>
            ))}
          </div>
        ) : (
          <div style={{ padding: '12px', borderBottom: `1px solid ${token.colorBorderSecondary}` }}>
            <Text type="secondary" style={{ fontSize: 11 }}>
              {emptyText}
            </Text>
          </div>
        )}
      </div>
    );
  };

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
        <Text strong style={{ fontSize: 14 }}>
          Variables in request
        </Text>
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
              <Text strong style={{ fontSize: 12 }}>
                All variables
              </Text>
            }
            key="all-vars"
            style={{ borderTop: `1px solid ${token.colorBorderSecondary}` }}
          >
            {/* Environment — always visible */}
            {renderScopeSection(
              'environment',
              'Environment',
              allByScope.environment,
              'No environment variables defined',
              activeEnv?.name,
            )}
            {/* Collection — only when inside a collection context (request/rule/collection/folder) */}
            {(activeTabType === 'request' ||
              activeTabType === 'collection' ||
              activeTabType === 'rule' ||
              activeTabType === 'collection-overview' ||
              activeTabType === 'folder-overview') &&
              renderScopeSection('collection', 'Collection', allByScope.collection, 'No collection variables defined')}
            {/* Workspace (globals) + Secret (vault) — always visible */}
            {renderScopeSection('workspace', 'Workspace', allByScope.workspace, 'No workspace variables defined')}
            {renderScopeSection('secret', 'Secret', allByScope.secret, 'No secrets defined')}
          </Collapse.Panel>
        </Collapse>
      </div>
    </div>
  );
}
