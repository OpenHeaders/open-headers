/**
 * EnvironmentEditor — inline editor for an environment, rendered in an editor tab.
 *
 * Shows a table of variables with inline editing, add/delete, and secret toggle.
 * Mirrors the v4 VariableTable + EnvironmentModals pattern.
 */

import { DeleteOutlined, EyeInvisibleOutlined, EyeOutlined, GlobalOutlined, PlusOutlined } from '@ant-design/icons';
import { Button, Input, Space, Switch, Table, Tag, Typography, theme } from 'antd';
import { useCallback, useMemo, useState } from 'react';
import { useEnvironments } from '@/renderer/hooks/useCentralizedWorkspace';

const { Text, Title } = Typography;

interface EnvironmentEditorProps {
  environmentName: string;
}

interface VariableRow {
  key: string;
  name: string;
  value: string;
  isSecret: boolean;
}

export function EnvironmentEditor({ environmentName }: EnvironmentEditorProps) {
  const { token } = theme.useToken();
  const { environments, activeEnvironment, switchEnvironment, setVariable, deleteVariable } = useEnvironments();

  const envData = environments[environmentName];
  const isActive = environmentName === activeEnvironment;

  // New variable form
  const [newVarName, setNewVarName] = useState('');
  const [newVarValue, setNewVarValue] = useState('');
  const [newVarSecret, setNewVarSecret] = useState(false);
  const [revealedSecrets, setRevealedSecrets] = useState<Set<string>>(new Set());

  // Editing state
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');

  const variables: VariableRow[] = useMemo(() => {
    if (!envData) return [];
    return Object.entries(envData).map(([name, variable]) => ({
      key: name,
      name,
      value: variable.value,
      isSecret: variable.isSecret,
    }));
  }, [envData]);

  const toggleSecretReveal = (name: string) => {
    setRevealedSecrets((prev) => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  };

  const handleAddVariable = useCallback(() => {
    const name = newVarName.trim();
    if (!name) return;
    void setVariable(name, newVarValue, environmentName, newVarSecret);
    setNewVarName('');
    setNewVarValue('');
    setNewVarSecret(false);
  }, [newVarName, newVarValue, newVarSecret, environmentName, setVariable]);

  const handleDeleteVariable = useCallback(
    (name: string) => {
      void deleteVariable(name, environmentName);
    },
    [environmentName, deleteVariable],
  );

  const handleStartEdit = (name: string, currentValue: string) => {
    setEditingKey(name);
    setEditValue(currentValue);
  };

  const handleSaveEdit = (name: string, isSecret: boolean) => {
    void setVariable(name, editValue, environmentName, isSecret);
    setEditingKey(null);
  };

  const columns = [
    {
      title: 'Variable',
      dataIndex: 'name',
      key: 'name',
      width: 200,
      render: (name: string) => (
        <Text style={{ fontFamily: "'SF Mono', 'Fira Code', monospace", fontSize: 12 }}>{name}</Text>
      ),
    },
    {
      title: 'Value',
      dataIndex: 'value',
      key: 'value',
      render: (_: string, record: VariableRow) => {
        if (editingKey === record.name) {
          return (
            <Input
              size="small"
              value={editValue}
              onChange={(e) => setEditValue(e.target.value)}
              onPressEnter={() => handleSaveEdit(record.name, record.isSecret)}
              onBlur={() => handleSaveEdit(record.name, record.isSecret)}
              autoFocus
              style={{ fontFamily: "'SF Mono', monospace", fontSize: 12 }}
            />
          );
        }

        const isRevealed = revealedSecrets.has(record.name);
        const displayValue = record.isSecret && !isRevealed ? '••••••••' : record.value;

        return (
          <Space size={4}>
            <Text
              style={{
                fontFamily: "'SF Mono', monospace",
                fontSize: 12,
                cursor: 'pointer',
                maxWidth: 300,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
                display: 'inline-block',
              }}
              onClick={() => handleStartEdit(record.name, record.value)}
            >
              {displayValue || '(empty)'}
            </Text>
            {record.isSecret && (
              <span
                style={{ cursor: 'pointer', color: token.colorTextTertiary, fontSize: 11 }}
                onClick={() => toggleSecretReveal(record.name)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') toggleSecretReveal(record.name);
                }}
              >
                {isRevealed ? <EyeInvisibleOutlined /> : <EyeOutlined />}
              </span>
            )}
          </Space>
        );
      },
    },
    {
      title: 'Type',
      dataIndex: 'isSecret',
      key: 'type',
      width: 80,
      render: (isSecret: boolean) =>
        isSecret ? (
          <Tag color="red" style={{ fontSize: 10 }}>
            Secret
          </Tag>
        ) : (
          <Tag style={{ fontSize: 10 }}>Default</Tag>
        ),
    },
    {
      title: '',
      key: 'actions',
      width: 40,
      render: (_: unknown, record: VariableRow) => (
        <Button
          type="text"
          danger
          size="small"
          icon={<DeleteOutlined />}
          onClick={() => handleDeleteVariable(record.name)}
        />
      ),
    },
  ];

  if (!envData) {
    return (
      <div className="v5-editor-content v5-welcome" style={{ background: token.colorBgContainer }}>
        <Text type="secondary">Environment "{environmentName}" not found.</Text>
      </div>
    );
  }

  return (
    <div className="v5-editor-content" style={{ background: token.colorBgContainer, overflow: 'auto' }}>
      <div className="v5-rule-editor">
        {/* Header */}
        <div className="v5-rule-editor-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <GlobalOutlined style={{ fontSize: 18, color: isActive ? token.colorPrimary : token.colorTextTertiary }} />
            <Title level={4} style={{ margin: 0 }}>
              {environmentName}
            </Title>
            {isActive && (
              <Tag color="blue" style={{ fontSize: 10 }}>
                Active
              </Tag>
            )}
          </div>
          {!isActive && (
            <Button size="small" type="primary" onClick={() => void switchEnvironment(environmentName)}>
              Activate
            </Button>
          )}
        </div>

        <div className="v5-rule-editor-body">
          {/* Variables table */}
          <div className="v5-editor-section">
            <Text type="secondary" className="v5-editor-section-title">
              VARIABLES ({variables.length})
            </Text>
            <Table
              dataSource={variables}
              columns={columns}
              pagination={false}
              size="small"
              locale={{ emptyText: 'No variables defined. Add one below.' }}
              style={{ marginBottom: 16 }}
            />
          </div>

          {/* Add variable form */}
          <div className="v5-editor-section">
            <Text type="secondary" className="v5-editor-section-title">
              ADD VARIABLE
            </Text>
            <Space size={8} align="start">
              <Input
                size="small"
                value={newVarName}
                onChange={(e) => setNewVarName(e.target.value.toUpperCase().replace(/[^A-Z0-9_]/g, ''))}
                placeholder="VARIABLE_NAME"
                style={{ width: 180, fontFamily: "'SF Mono', monospace", fontSize: 12 }}
                onPressEnter={handleAddVariable}
              />
              <Input
                size="small"
                value={newVarValue}
                onChange={(e) => setNewVarValue(e.target.value)}
                placeholder="Value"
                style={{ width: 240 }}
                onPressEnter={handleAddVariable}
              />
              <Switch
                size="small"
                checked={newVarSecret}
                onChange={setNewVarSecret}
                checkedChildren="Secret"
                unCheckedChildren="Default"
              />
              <Button size="small" icon={<PlusOutlined />} onClick={handleAddVariable} disabled={!newVarName.trim()}>
                Add
              </Button>
            </Space>
          </div>
        </div>
      </div>
    </div>
  );
}
