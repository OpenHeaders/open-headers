/**
 * RuleEditor — inline editor for a HeaderRule, rendered in an editor tab.
 *
 * Mirrors the v4 UnifiedHeaderModal fields but in a full-page layout.
 * Explicit save via Save button or ⌘S.
 */

import { DeleteOutlined, GlobalOutlined, PlusOutlined, ThunderboltOutlined } from '@ant-design/icons';
import type { Source } from '@openheaders/core';
import { Button, Input, Radio, Select, Space, Switch, Tag, Tooltip, Typography, theme } from 'antd';
import type React from 'react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useHeaderRules, useSources } from '@/renderer/hooks/useCentralizedWorkspace';
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
  const { rules, updateRule, removeRule, toggleRule } = useHeaderRules();
  const { sources } = useSources();

  const isDraft = !!draftData && !ruleId;
  const rule = isDraft ? undefined : rules.find((r) => r.id === ruleId);

  // Local form state
  const [headerName, setHeaderName] = useState('');
  const [headerValue, setHeaderValue] = useState('');
  const [tag, setTag] = useState('');
  const [isResponse, setIsResponse] = useState(false);
  const [isDynamic, setIsDynamic] = useState(false);
  const [sourceId, setSourceId] = useState<string | number | null>(null);
  const [prefix, setPrefix] = useState('');
  const [suffix, setSuffix] = useState('');
  const [domains, setDomains] = useState<string[]>([]);
  const [newDomain, setNewDomain] = useState('');
  const [isEnabled, setIsEnabled] = useState(true);
  const [isDirty, setIsDirty] = useState(false);

  // Track whether we've initialized from this rule
  const initializedRuleId = useRef<string | null>(null);
  const snapshotRef = useRef('');

  const buildFingerprint = useCallback(() => {
    return JSON.stringify({ headerName, headerValue, tag, isResponse, isDynamic, sourceId, prefix, suffix, domains });
  }, [headerName, headerValue, tag, isResponse, isDynamic, sourceId, prefix, suffix, domains]);

  // Initialize from draft data
  const draftInitialized = useRef(false);
  useEffect(() => {
    if (isDraft && draftData && !draftInitialized.current) {
      draftInitialized.current = true;
      setHeaderName((draftData.headerName as string) || '');
      setHeaderValue((draftData.headerValue as string) || '');
      setTag((draftData.tag as string) || '');
      setIsResponse(!!draftData.isResponse);
      setIsDynamic(!!draftData.isDynamic);
      setSourceId((draftData.sourceId as string | number | null) ?? null);
      setPrefix((draftData.prefix as string) || '');
      setSuffix((draftData.suffix as string) || '');
      setDomains((draftData.domains as string[]) || []);
      setIsEnabled(draftData.isEnabled !== false);
      snapshotRef.current = JSON.stringify({
        headerName: '',
        headerValue: '',
        tag: '',
        isResponse: false,
        isDynamic: false,
        sourceId: null,
        prefix: '',
        suffix: '',
        domains: [],
      });
    }
  }, [isDraft, draftData]);

  // Initialize local state from rule
  useEffect(() => {
    if (rule && initializedRuleId.current !== rule.id) {
      initializedRuleId.current = rule.id;
      setHeaderName(rule.headerName);
      setHeaderValue(rule.headerValue);
      setTag(rule.tag || '');
      setIsResponse(rule.isResponse);
      setIsDynamic(rule.isDynamic);
      setSourceId(rule.sourceId);
      setPrefix(rule.prefix || '');
      setSuffix(rule.suffix || '');
      setDomains(rule.domains || []);
      setIsEnabled(rule.isEnabled);

      snapshotRef.current = JSON.stringify({
        headerName: rule.headerName,
        headerValue: rule.headerValue,
        tag: rule.tag || '',
        isResponse: rule.isResponse,
        isDynamic: rule.isDynamic,
        sourceId: rule.sourceId,
        prefix: rule.prefix || '',
        suffix: rule.suffix || '',
        domains: rule.domains || [],
      });
    }
  }, [rule]);

  // Publish used variables to context for the Inspector panel
  const { setUsedVariables, clearVariables } = useEditorVariables();
  useEffect(() => {
    const vars = extractRuleVariables({ headerName, headerValue, prefix, suffix, domains });
    setUsedVariables(vars);
    return () => clearVariables();
  }, [headerName, headerValue, prefix, suffix, domains, setUsedVariables, clearVariables]);

  // Smart dirty detection
  const currentFingerprint = buildFingerprint();
  const isActuallyDirty = snapshotRef.current !== '' && currentFingerprint !== snapshotRef.current;

  useEffect(() => {
    if (isActuallyDirty !== isDirty) {
      setIsDirty(isActuallyDirty);
    }
    onDirtyChange?.(isActuallyDirty);
  }, [isActuallyDirty, isDirty, onDirtyChange]);

  // Explicit save
  const handleSave = useCallback(() => {
    if (isDraft && onSaveDraft) {
      onSaveDraft({
        type: 'header',
        name: headerName || 'New Rule',
        headerName,
        headerValue,
        tag,
        isResponse,
        isDynamic,
        sourceId,
        prefix,
        suffix,
        domains,
        isEnabled,
        description: '',
        hasEnvVars: false,
        envVars: [],
      });
      return;
    }
    if (!ruleId) return;
    void updateRule(ruleId, {
      headerName,
      headerValue,
      tag,
      isResponse,
      isDynamic,
      sourceId,
      prefix,
      suffix,
      domains,
      updatedAt: new Date().toISOString(),
    }).then(() => {
      snapshotRef.current = currentFingerprint;
      setIsDirty(false);
      onDirtyChange?.(false);
    });
  }, [
    isDraft,
    onSaveDraft,
    ruleId,
    headerName,
    headerValue,
    tag,
    isResponse,
    isDynamic,
    sourceId,
    prefix,
    suffix,
    domains,
    isEnabled,
    updateRule,
    onDirtyChange,
    currentFingerprint,
  ]);

  // Expose save to parent
  useEffect(() => {
    if (saveRef) saveRef.current = handleSave;
  }, [saveRef, handleSave]);

  // Toggle enabled is immediate (not part of dirty state)
  const handleToggleEnabled = (val: boolean) => {
    setIsEnabled(val);
    if (!isDraft && ruleId) {
      void toggleRule(ruleId, val);
    }
  };

  const handleAddDomain = () => {
    const trimmed = newDomain.trim();
    if (!trimmed || domains.includes(trimmed)) return;
    setDomains([...domains, trimmed]);
    setNewDomain('');
  };

  const handleRemoveDomain = (domain: string) => {
    setDomains(domains.filter((d) => d !== domain));
  };

  const sourceOptions = useMemo(
    () =>
      sources.map((s: Source) => ({
        value: s.sourceId,
        label: s.sourceName || s.sourcePath || s.sourceId,
      })),
    [sources],
  );

  if (!rule && !isDraft) {
    return (
      <div className="v5-editor-content v5-welcome" style={{ background: token.colorBgContainer }}>
        <Text type="secondary">Rule not found. It may have been deleted.</Text>
      </div>
    );
  }

  return (
    <div className="v5-editor-content" style={{ background: token.colorBgContainer, overflow: 'auto' }}>
      <div className="v5-rule-editor">
        {/* Header */}
        <div className="v5-rule-editor-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <ThunderboltOutlined
              style={{ fontSize: 18, color: isEnabled ? token.colorSuccess : token.colorTextTertiary }}
            />
            <Title level={4} style={{ margin: 0 }}>
              {rule?.name || headerName || 'New Rule'}
            </Title>
          </div>
          <Space>
            <Switch
              checked={isEnabled}
              onChange={handleToggleEnabled}
              checkedChildren="Enabled"
              unCheckedChildren="Disabled"
            />
            {!isDraft && ruleId && (
              <Tooltip title="Delete rule">
                <Button danger type="text" icon={<DeleteOutlined />} onClick={() => void removeRule(ruleId)} />
              </Tooltip>
            )}
          </Space>
        </div>

        {/* Form sections */}
        <div className="v5-rule-editor-body">
          {/* ── Header Section ───────────────────────── */}
          <div className="v5-editor-section">
            <Text type="secondary" className="v5-editor-section-title">
              HEADER
            </Text>

            <div className="v5-editor-field">
              <Text className="v5-editor-label">Type</Text>
              <Radio.Group
                value={isResponse ? 'response' : 'request'}
                onChange={(e) => {
                  setIsResponse(e.target.value === 'response');
                }}
                size="small"
              >
                <Radio.Button value="request">Request</Radio.Button>
                <Radio.Button value="response">Response</Radio.Button>
              </Radio.Group>
            </div>

            <div className="v5-editor-field">
              <Text className="v5-editor-label">Header name</Text>
              <Input
                size="small"
                value={headerName}
                onChange={(e) => {
                  setHeaderName(e.target.value);
                }}
                placeholder="e.g. Authorization"
                style={{ maxWidth: 360 }}
              />
            </div>

            <div className="v5-editor-field">
              <Text className="v5-editor-label">Tag</Text>
              <Input
                size="small"
                value={tag}
                onChange={(e) => {
                  setTag(e.target.value);
                }}
                placeholder="Optional label"
                maxLength={20}
                style={{ maxWidth: 200 }}
              />
            </div>
          </div>

          {/* ── Value Section ────────────────────────── */}
          <div className="v5-editor-section">
            <Text type="secondary" className="v5-editor-section-title">
              VALUE
            </Text>

            <div className="v5-editor-field">
              <Text className="v5-editor-label">Source</Text>
              <Radio.Group
                value={isDynamic ? 'dynamic' : 'static'}
                onChange={(e) => {
                  const dynamic = e.target.value === 'dynamic';
                  setIsDynamic(dynamic);
                  if (!dynamic) {
                    setSourceId(null);
                    setPrefix('');
                    setSuffix('');
                  }
                }}
                size="small"
              >
                <Radio.Button value="static">Static</Radio.Button>
                <Radio.Button value="dynamic">Dynamic</Radio.Button>
              </Radio.Group>
            </div>

            {!isDynamic ? (
              <div className="v5-editor-field">
                <Text className="v5-editor-label">Value</Text>
                <Input.TextArea
                  size="small"
                  value={headerValue}
                  onChange={(e) => {
                    setHeaderValue(e.target.value);
                  }}
                  placeholder="Header value"
                  autoSize={{ minRows: 1, maxRows: 4 }}
                  style={{ maxWidth: 480 }}
                />
              </div>
            ) : (
              <>
                <div className="v5-editor-field">
                  <Text className="v5-editor-label">Source</Text>
                  <Select
                    size="small"
                    value={sourceId as string | undefined}
                    onChange={(val) => {
                      setSourceId(val);
                    }}
                    options={sourceOptions}
                    placeholder="Select a source"
                    style={{ width: 300 }}
                    allowClear
                  />
                </div>
                <div className="v5-editor-field">
                  <Text className="v5-editor-label">Prefix</Text>
                  <Input
                    size="small"
                    value={prefix}
                    onChange={(e) => {
                      setPrefix(e.target.value);
                    }}
                    placeholder="e.g. Bearer "
                    style={{ maxWidth: 240 }}
                  />
                </div>
                <div className="v5-editor-field">
                  <Text className="v5-editor-label">Suffix</Text>
                  <Input
                    size="small"
                    value={suffix}
                    onChange={(e) => {
                      setSuffix(e.target.value);
                    }}
                    placeholder="Optional suffix"
                    style={{ maxWidth: 240 }}
                  />
                </div>
              </>
            )}
          </div>

          {/* ── Domains Section ──────────────────────── */}
          <div className="v5-editor-section">
            <Text type="secondary" className="v5-editor-section-title">
              <GlobalOutlined /> DOMAINS
            </Text>

            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 8 }}>
              {domains.map((domain) => (
                <Tag key={domain} closable onClose={() => handleRemoveDomain(domain)} style={{ fontSize: 11 }}>
                  {domain}
                </Tag>
              ))}
              {domains.length === 0 && (
                <Text type="secondary" style={{ fontSize: 11 }}>
                  No domains — rule applies to all traffic.
                </Text>
              )}
            </div>

            <Space.Compact size="small">
              <Input
                value={newDomain}
                onChange={(e) => setNewDomain(e.target.value)}
                placeholder="Add domain (e.g. *.openheaders.io)"
                onPressEnter={handleAddDomain}
                style={{ width: 260 }}
              />
              <Button icon={<PlusOutlined />} onClick={handleAddDomain} />
            </Space.Compact>
          </div>
        </div>
      </div>
    </div>
  );
}
