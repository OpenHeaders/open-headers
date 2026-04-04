/**
 * RuleEditor — inline editor for a HeaderRule, rendered in an editor tab.
 *
 * Mirrors the v4 UnifiedHeaderModal fields but in a full-page layout.
 * Auto-saves on change (debounced).
 */

import { DeleteOutlined, GlobalOutlined, PlusOutlined, ThunderboltOutlined } from '@ant-design/icons';
import type { HeaderRule, Source } from '@openheaders/core';
import { Button, Input, Radio, Select, Space, Switch, Tag, Tooltip, Typography, theme } from 'antd';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useHeaderRules, useSources } from '@/renderer/hooks/useCentralizedWorkspace';

const { Text, Title } = Typography;

interface RuleEditorProps {
  ruleId: string;
}

export function RuleEditor({ ruleId }: RuleEditorProps) {
  const { token } = theme.useToken();
  const { rules, updateRule, removeRule, toggleRule } = useHeaderRules();
  const { sources } = useSources();

  const rule = rules.find((r) => r.id === ruleId);

  // Local form state — initialized from rule, synced back via debounced save
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

  // Track whether we've initialized from this rule
  const initializedRuleId = useRef<string | null>(null);

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
    }
  }, [rule]);

  // Debounced auto-save
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const scheduleUpdate = useCallback(
    (updates: Partial<HeaderRule>) => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
      saveTimer.current = setTimeout(() => {
        void updateRule(ruleId, { ...updates, updatedAt: new Date().toISOString() });
      }, 600);
    },
    [ruleId, updateRule],
  );

  // Field change handlers that update local state + schedule save
  const handleHeaderNameChange = (val: string) => {
    setHeaderName(val);
    scheduleUpdate({ headerName: val });
  };

  const handleHeaderValueChange = (val: string) => {
    setHeaderValue(val);
    scheduleUpdate({ headerValue: val });
  };

  const handleTagChange = (val: string) => {
    setTag(val);
    scheduleUpdate({ tag: val });
  };

  const handleIsResponseChange = (val: boolean) => {
    setIsResponse(val);
    scheduleUpdate({ isResponse: val });
  };

  const handleIsDynamicChange = (val: boolean) => {
    setIsDynamic(val);
    if (!val) {
      setSourceId(null);
      setPrefix('');
      setSuffix('');
      scheduleUpdate({ isDynamic: val, sourceId: null, prefix: '', suffix: '' });
    } else {
      scheduleUpdate({ isDynamic: val });
    }
  };

  const handleSourceIdChange = (val: string | number | null) => {
    setSourceId(val);
    scheduleUpdate({ sourceId: val });
  };

  const handlePrefixChange = (val: string) => {
    setPrefix(val);
    scheduleUpdate({ prefix: val });
  };

  const handleSuffixChange = (val: string) => {
    setSuffix(val);
    scheduleUpdate({ suffix: val });
  };

  const handleToggleEnabled = (val: boolean) => {
    setIsEnabled(val);
    void toggleRule(ruleId, val);
  };

  const handleAddDomain = () => {
    const trimmed = newDomain.trim();
    if (!trimmed || domains.includes(trimmed)) return;
    const updated = [...domains, trimmed];
    setDomains(updated);
    setNewDomain('');
    scheduleUpdate({ domains: updated });
  };

  const handleRemoveDomain = (domain: string) => {
    const updated = domains.filter((d) => d !== domain);
    setDomains(updated);
    scheduleUpdate({ domains: updated });
  };

  // Source options for the dynamic value dropdown
  const sourceOptions = useMemo(
    () =>
      sources.map((s: Source) => ({
        value: s.sourceId,
        label: s.sourceName || s.sourcePath || s.sourceId,
      })),
    [sources],
  );

  if (!rule) {
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
              {rule.name || rule.headerName}
            </Title>
          </div>
          <Space>
            <Switch
              checked={isEnabled}
              onChange={handleToggleEnabled}
              checkedChildren="Enabled"
              unCheckedChildren="Disabled"
            />
            <Tooltip title="Delete rule">
              <Button danger type="text" icon={<DeleteOutlined />} onClick={() => void removeRule(ruleId)} />
            </Tooltip>
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
                onChange={(e) => handleIsResponseChange(e.target.value === 'response')}
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
                onChange={(e) => handleHeaderNameChange(e.target.value)}
                placeholder="e.g. Authorization"
                style={{ maxWidth: 360 }}
              />
            </div>

            <div className="v5-editor-field">
              <Text className="v5-editor-label">Tag</Text>
              <Input
                size="small"
                value={tag}
                onChange={(e) => handleTagChange(e.target.value)}
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
                onChange={(e) => handleIsDynamicChange(e.target.value === 'dynamic')}
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
                  onChange={(e) => handleHeaderValueChange(e.target.value)}
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
                    onChange={handleSourceIdChange}
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
                    onChange={(e) => handlePrefixChange(e.target.value)}
                    placeholder="e.g. Bearer "
                    style={{ maxWidth: 240 }}
                  />
                </div>
                <div className="v5-editor-field">
                  <Text className="v5-editor-label">Suffix</Text>
                  <Input
                    size="small"
                    value={suffix}
                    onChange={(e) => handleSuffixChange(e.target.value)}
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
