/**
 * RuleEditor — inline editor for a V5 Rule (header type), rendered in an editor tab.
 *
 * V5 rules are a discriminated union. This editor handles header rules.
 * Other rule types (redirect, body, inject, block, delay, mock) will
 * get their own editor panels when implemented.
 */

import { DeleteOutlined, GlobalOutlined, PlusOutlined, ThunderboltOutlined } from '@ant-design/icons';
import type { V5 } from '@openheaders/core/types';
import { Button, Input, Radio, Select, Space, Switch, Tag, Tooltip, Typography, theme } from 'antd';
import type React from 'react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useHeaderRules } from '@/renderer/hooks/useCentralizedWorkspace';
import { extractRuleVariables, useEditorVariables } from '../contexts/EditorVariablesContext';

const { Text, Title } = Typography;

interface RuleEditorProps {
  ruleId?: string;
  draftData?: Record<string, unknown>;
  onDirtyChange?: (dirty: boolean) => void;
  saveRef?: React.MutableRefObject<(() => void) | null>;
  onSaveDraft?: (data: Record<string, unknown>) => void;
}

export function RuleEditor({ ruleId, draftData, onDirtyChange, saveRef, onSaveDraft }: RuleEditorProps) {
  const { token } = theme.useToken();
  const { rules, updateRule: updateRuleIpc } = useHeaderRules();

  const isDraft = !!draftData && !ruleId;
  const rule = isDraft ? undefined : rules.find((r) => r.uid === ruleId);

  // Local form state (header rule fields)
  const [headerName, setHeaderName] = useState('');
  const [staticValue, setStaticValue] = useState('');
  const [isResponse, setIsResponse] = useState(false);
  const [operation, setOperation] = useState<V5.HeaderOperation>('add');
  const [domains, setDomains] = useState<string[]>([]);
  const [newDomain, setNewDomain] = useState('');
  const [enabled, setEnabled] = useState(true);
  const [isDirty, setIsDirty] = useState(false);

  const initializedRuleId = useRef<string | null>(null);
  const snapshotRef = useRef('');

  const buildFingerprint = useCallback(() => {
    return JSON.stringify({ headerName, staticValue, isResponse, operation, domains });
  }, [headerName, staticValue, isResponse, operation, domains]);

  // Initialize from draft data
  const draftInitialized = useRef(false);
  useEffect(() => {
    if (isDraft && draftData && !draftInitialized.current) {
      draftInitialized.current = true;
      const action = draftData.action as Partial<V5.HeaderAction> | undefined;
      setHeaderName(action?.headerName || '');
      setStaticValue((draftData.staticValue as string) || '');
      setIsResponse(action?.isResponse ?? false);
      setOperation((action?.operation as V5.HeaderOperation) || 'add');
      setDomains((draftData.domains as string[]) || []);
      setEnabled(draftData.enabled !== false);
      snapshotRef.current = JSON.stringify({
        headerName: '',
        staticValue: '',
        isResponse: false,
        operation: 'add',
        domains: [],
      });
    }
  }, [isDraft, draftData]);

  // Initialize from persisted rule
  useEffect(() => {
    if (rule && initializedRuleId.current !== rule.uid) {
      initializedRuleId.current = rule.uid;
      if (rule.type === 'header') {
        setHeaderName(rule.action.headerName);
        setStaticValue(rule.staticValue || '');
        setIsResponse(rule.action.isResponse);
        setOperation(rule.action.operation);
      }
      setDomains(rule.domains || []);
      setEnabled(rule.enabled);

      snapshotRef.current = JSON.stringify({
        headerName: rule.type === 'header' ? rule.action.headerName : '',
        staticValue: rule.type === 'header' ? rule.staticValue || '' : '',
        isResponse: rule.type === 'header' ? rule.action.isResponse : false,
        operation: rule.type === 'header' ? rule.action.operation : 'add',
        domains: rule.domains || [],
      });
    }
  }, [rule]);

  // Publish used variables to context for the Inspector panel
  const { setUsedVariables, clearVariables } = useEditorVariables();
  useEffect(() => {
    const vars = extractRuleVariables({ headerName, headerValue: staticValue, prefix: '', suffix: '', domains });
    setUsedVariables(vars);
    return () => clearVariables();
  }, [headerName, staticValue, domains, setUsedVariables, clearVariables]);

  // Smart dirty detection
  const currentFingerprint = buildFingerprint();
  const isActuallyDirty = snapshotRef.current !== '' && currentFingerprint !== snapshotRef.current;

  useEffect(() => {
    if (isActuallyDirty !== isDirty) {
      setIsDirty(isActuallyDirty);
    }
  }, [isActuallyDirty, isDirty]);

  useEffect(() => {
    onDirtyChange?.(isDirty);
  }, [isDirty, onDirtyChange]);

  // Save handler
  const handleSave = useCallback(() => {
    if (isDraft && onSaveDraft) {
      onSaveDraft({
        type: 'header',
        name: draftData?.name || 'New Rule',
        enabled,
        domains,
        action: { operation, headerName, isResponse },
        staticValue,
      });
      return;
    }
    if (!ruleId) return;
    updateRuleIpc(ruleId, {
      enabled,
      domains,
      action: { operation, headerName, isResponse },
      staticValue,
    } as Partial<V5.HeaderRule>)
      .then(() => {
        snapshotRef.current = buildFingerprint();
        onDirtyChange?.(false);
      })
      .catch(() => {});
  }, [
    isDraft,
    onSaveDraft,
    draftData,
    enabled,
    domains,
    operation,
    headerName,
    isResponse,
    staticValue,
    ruleId,
    updateRuleIpc,
    buildFingerprint,
    onDirtyChange,
  ]);

  useEffect(() => {
    if (saveRef) saveRef.current = handleSave;
  }, [saveRef, handleSave]);

  // Add domain
  const addDomain = useCallback(() => {
    const trimmed = newDomain.trim();
    if (trimmed && !domains.includes(trimmed)) {
      setDomains((prev) => [...prev, trimmed]);
      setNewDomain('');
    }
  }, [newDomain, domains]);

  const removeDomain = useCallback((domain: string) => {
    setDomains((prev) => prev.filter((d) => d !== domain));
  }, []);

  if (!isDraft && !rule) {
    return (
      <div style={{ padding: 24, textAlign: 'center' }}>
        <Text type="secondary">Rule not found.</Text>
      </div>
    );
  }

  return (
    <div style={{ padding: '16px 24px', maxWidth: 700, overflow: 'auto', height: '100%' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
        <ThunderboltOutlined style={{ fontSize: 16, color: enabled ? token.colorPrimary : token.colorTextTertiary }} />
        <Title level={5} style={{ margin: 0 }}>
          {isDraft ? (draftData?.name as string) || 'New Rule' : rule?.name || 'Rule'}
        </Title>
        <div style={{ marginLeft: 'auto' }}>
          <Switch size="small" checked={enabled} onChange={setEnabled} checkedChildren="ON" unCheckedChildren="OFF" />
        </div>
      </div>

      {/* Operation */}
      <div style={{ marginBottom: 16 }}>
        <Text strong style={{ fontSize: 12, display: 'block', marginBottom: 4 }}>
          Operation
        </Text>
        <Radio.Group value={operation} onChange={(e) => setOperation(e.target.value)} size="small">
          <Radio.Button value="add">Add</Radio.Button>
          <Radio.Button value="override">Override</Radio.Button>
          <Radio.Button value="remove">Remove</Radio.Button>
        </Radio.Group>
      </div>

      {/* Header name */}
      <div style={{ marginBottom: 16 }}>
        <Text strong style={{ fontSize: 12, display: 'block', marginBottom: 4 }}>
          Header Name
        </Text>
        <Input
          value={headerName}
          onChange={(e) => setHeaderName(e.target.value)}
          placeholder="e.g. Authorization"
          size="small"
        />
      </div>

      {/* Value (only for add/override) */}
      {operation !== 'remove' && (
        <div style={{ marginBottom: 16 }}>
          <Text strong style={{ fontSize: 12, display: 'block', marginBottom: 4 }}>
            Value
          </Text>
          <Input
            value={staticValue}
            onChange={(e) => setStaticValue(e.target.value)}
            placeholder="e.g. Bearer {{TOKEN}}"
            size="small"
          />
        </div>
      )}

      {/* Response / Request toggle */}
      <div style={{ marginBottom: 16 }}>
        <Text strong style={{ fontSize: 12, display: 'block', marginBottom: 4 }}>
          Apply to
        </Text>
        <Radio.Group
          value={isResponse ? 'response' : 'request'}
          onChange={(e) => setIsResponse(e.target.value === 'response')}
          size="small"
        >
          <Radio.Button value="request">Request</Radio.Button>
          <Radio.Button value="response">Response</Radio.Button>
        </Radio.Group>
      </div>

      {/* Domains */}
      <div style={{ marginBottom: 16 }}>
        <Text strong style={{ fontSize: 12, display: 'block', marginBottom: 4 }}>
          <GlobalOutlined /> Domains
        </Text>
        <Space wrap size={4} style={{ marginBottom: 8 }}>
          {domains.map((d) => (
            <Tag key={d} closable onClose={() => removeDomain(d)} style={{ fontSize: 11 }}>
              {d}
            </Tag>
          ))}
        </Space>
        <Space.Compact style={{ width: '100%' }}>
          <Input
            value={newDomain}
            onChange={(e) => setNewDomain(e.target.value)}
            placeholder="e.g. *.openheaders.io"
            size="small"
            onPressEnter={addDomain}
          />
          <Button size="small" icon={<PlusOutlined />} onClick={addDomain} />
        </Space.Compact>
      </div>
    </div>
  );
}
