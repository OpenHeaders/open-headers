/**
 * TestResultsView — workspace tab that renders a completed test session.
 *
 * Fetches the session from background storage by id, groups the scoped rules
 * by Chrome DNR priority tier (same tiers as RuleFlow), and shows a status
 * badge per rule: executed (fired on at least one request), no-fire (in scope
 * but never fired), skipped (explicitly outside scope — reserved for later).
 *
 * The per-rule drill-down (matched URLs, header diffs, shadowed-by links) is
 * scaffolded here as a side panel and will deepen in later slices.
 */

import {
  CheckCircleTwoTone,
  CloseCircleTwoTone,
  DeleteOutlined,
  ExperimentOutlined,
  ReloadOutlined,
} from '@ant-design/icons';
import { useRules } from '@hooks/useRules';
import type { V5 } from '@openheaders/core/types';
import { getActionDetail } from '@openheaders/core/utils';
import { runtime } from '@utils/browser-api';
import { App, Button, Card, Empty, Space, Spin, Tag, theme, Typography } from 'antd';
import type React from 'react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { PRIORITY_TIERS, type PriorityTier } from './rule-flow/PriorityGroup';

const { Text, Title } = Typography;

// ── Types (must match background test-runner) ────────────────────

type TestRuleStatus = 'executed' | 'no-fire' | 'skipped';

interface TestFireEvent {
  ruleUid: string;
  url: string;
  kind: string;
  t: number;
}

interface TestSessionResult {
  id: string;
  scope: 'single' | 'folder' | 'collection';
  ruleUids: string[];
  url: string;
  startedAt: number;
  endedAt: number;
  waitSeconds: number;
  fires: TestFireEvent[];
  ruleStatuses: Record<string, TestRuleStatus>;
}

// ── Component ────────────────────────────────────────────────────

interface TestResultsViewProps {
  sessionId: string;
  onSelectRule?: (uid: string) => void;
}

const TestResultsView: React.FC<TestResultsViewProps> = ({ sessionId, onSelectRule }) => {
  const { token } = theme.useToken();
  const { rules } = useRules();
  const { message } = App.useApp();
  const [session, setSession] = useState<TestSessionResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedRuleUid, setSelectedRuleUid] = useState<string | null>(null);

  const loadSession = useCallback(() => {
    setLoading(true);
    setError(null);
    runtime.sendMessage({ type: 'getTestSession', sessionId }, (response: unknown) => {
      const data = response as { success?: boolean; session?: TestSessionResult | null; error?: string } | null;
      if (data?.success && data.session) {
        setSession(data.session);
      } else if (data?.success) {
        setError('Session not found — it may have been trimmed or deleted.');
      } else {
        setError(data?.error ?? 'Failed to load test session');
      }
      setLoading(false);
    });
  }, [sessionId]);

  useEffect(() => {
    loadSession();
  }, [loadSession]);

  const handleDelete = useCallback(() => {
    runtime.sendMessage({ type: 'deleteTestSession', sessionId }, (response: unknown) => {
      const data = response as { success?: boolean } | null;
      if (data?.success) {
        message.success('Test session deleted');
        setSession(null);
      } else {
        message.error('Failed to delete test session');
      }
    });
  }, [sessionId, message]);

  // Group scoped rules by tier using the same ordering as RuleFlow.
  const rulesByTier = useMemo(() => {
    const out = new Map<string, V5.Rule[]>();
    for (const tier of PRIORITY_TIERS) out.set(tier.key, []);
    if (!session) return out;
    const scope = new Set(session.ruleUids);
    for (const rule of rules) {
      if (!scope.has(rule.uid)) continue;
      const tier = PRIORITY_TIERS.find((t) => t.ruleTypes.includes(rule.type));
      if (tier) out.get(tier.key)!.push(rule);
    }
    return out;
  }, [session, rules]);

  const selectedRule = useMemo(
    () => (selectedRuleUid ? rules.find((r) => r.uid === selectedRuleUid) : null),
    [selectedRuleUid, rules],
  );

  const selectedFires = useMemo(
    () => (selectedRuleUid && session ? session.fires.filter((f) => f.ruleUid === selectedRuleUid) : []),
    [selectedRuleUid, session],
  );

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%' }}>
        <Spin tip="Loading test session…" />
      </div>
    );
  }

  if (error || !session) {
    return (
      <div style={{ padding: 48 }}>
        <Empty
          description={
            <Space direction="vertical" size={8} style={{ maxWidth: 420 }}>
              <Text>{error ?? 'No session loaded'}</Text>
              <Text type="secondary" style={{ fontSize: 12 }}>
                Sessions are kept in extension storage and trimmed to the 50 most recent.
              </Text>
            </Space>
          }
        />
      </div>
    );
  }

  const executedCount = Object.values(session.ruleStatuses).filter((s) => s === 'executed').length;
  const noFireCount = Object.values(session.ruleStatuses).filter((s) => s === 'no-fire').length;
  const nonEmptyTiers = PRIORITY_TIERS.filter((t) => (rulesByTier.get(t.key) ?? []).length > 0);

  return (
    <div style={{ height: '100%', display: 'flex', minHeight: 0 }}>
      {/* Main pipeline */}
      <div style={{ flex: 1, overflowY: 'auto', padding: 16 }}>
        <div style={{ marginBottom: 16 }}>
          <Space align="center" size={8}>
            <ExperimentOutlined style={{ fontSize: 18, color: token.colorPrimary }} />
            <Title level={5} style={{ margin: 0 }}>
              Test results
            </Title>
          </Space>
          <div style={{ marginTop: 4 }}>
            <Text type="secondary" style={{ fontSize: 12 }}>
              {session.url} — ran {new Date(session.endedAt).toLocaleString()}
            </Text>
          </div>
          <div style={{ marginTop: 8 }}>
            <Space wrap size={8}>
              <Tag color="success">{executedCount} executed</Tag>
              <Tag>{noFireCount} no fire</Tag>
              <Tag color="default">{session.fires.length} total fires</Tag>
              <Tag color="blue">{session.waitSeconds}s capture</Tag>
              <Button
                size="small"
                icon={<ReloadOutlined />}
                onClick={loadSession}
                style={{ marginLeft: 8 }}
              >
                Reload
              </Button>
              <Button size="small" danger icon={<DeleteOutlined />} onClick={handleDelete}>
                Delete
              </Button>
            </Space>
          </div>
        </div>

        {nonEmptyTiers.length === 0 ? (
          <Empty description="No rules in this session" />
        ) : (
          <Space direction="vertical" size={16} style={{ width: '100%' }}>
            {nonEmptyTiers.map((tier) => (
              <TierBlock
                key={tier.key}
                tier={tier}
                tierRules={rulesByTier.get(tier.key) ?? []}
                ruleStatuses={session.ruleStatuses}
                fires={session.fires}
                selectedRuleUid={selectedRuleUid}
                onSelect={(uid) => setSelectedRuleUid(uid)}
              />
            ))}
          </Space>
        )}
      </div>

      {/* Drill-down panel */}
      {selectedRule && (
        <div
          style={{
            width: 320,
            borderLeft: `1px solid ${token.colorBorderSecondary}`,
            background: token.colorBgContainer,
            padding: 16,
            overflowY: 'auto',
          }}
        >
          <Title level={5} style={{ marginTop: 0 }}>
            {selectedRule.name}
          </Title>
          <Text type="secondary" style={{ fontSize: 11 }}>
            {selectedRule.type}
          </Text>
          <div style={{ marginTop: 12 }}>
            <Text strong style={{ fontSize: 12 }}>
              Status
            </Text>
            <div style={{ marginTop: 4 }}>
              <StatusTag status={session.ruleStatuses[selectedRule.uid] ?? 'no-fire'} />
            </div>
          </div>
          <div style={{ marginTop: 12 }}>
            <Text strong style={{ fontSize: 12 }}>
              Fires ({selectedFires.length})
            </Text>
            {selectedFires.length === 0 ? (
              <div style={{ marginTop: 4 }}>
                <Text type="secondary" style={{ fontSize: 11 }}>
                  No requests fired this rule during the capture window.
                </Text>
              </div>
            ) : (
              <div style={{ marginTop: 4, maxHeight: 240, overflowY: 'auto' }}>
                {selectedFires.slice(0, 20).map((fire, i) => (
                  <div
                    key={`${fire.t}-${i}`}
                    style={{
                      fontSize: 11,
                      color: token.colorTextSecondary,
                      marginBottom: 4,
                      wordBreak: 'break-all',
                    }}
                  >
                    <Tag color="blue">{fire.kind}</Tag>
                    {fire.url || <em>(DNR match)</em>}
                  </div>
                ))}
                {selectedFires.length > 20 && (
                  <Text type="secondary" style={{ fontSize: 10 }}>
                    +{selectedFires.length - 20} more
                  </Text>
                )}
              </div>
            )}
          </div>
          {onSelectRule && (
            <div style={{ marginTop: 16 }}>
              <Button size="small" block onClick={() => onSelectRule(selectedRule.uid)}>
                Open rule in editor
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

// ── Subcomponents ────────────────────────────────────────────────

interface TierBlockProps {
  tier: PriorityTier;
  tierRules: V5.Rule[];
  ruleStatuses: Record<string, TestRuleStatus>;
  fires: TestFireEvent[];
  selectedRuleUid: string | null;
  onSelect: (uid: string) => void;
}

const TierBlock: React.FC<TierBlockProps> = ({ tier, tierRules, ruleStatuses, fires, selectedRuleUid, onSelect }) => {
  const { token } = theme.useToken();
  return (
    <Card
      size="small"
      title={
        <Space size={8}>
          <span
            style={{
              display: 'inline-block',
              width: 8,
              height: 8,
              borderRadius: '50%',
              background: tier.color,
            }}
          />
          <Text strong style={{ color: tier.color }}>
            {tier.label}
          </Text>
          <Text type="secondary" style={{ fontSize: 11 }}>
            {tierRules.length} rule{tierRules.length !== 1 ? 's' : ''}
          </Text>
        </Space>
      }
      styles={{ body: { padding: 8 } }}
    >
      <Space direction="vertical" size={4} style={{ width: '100%' }}>
        {tierRules.map((rule) => {
          const status = ruleStatuses[rule.uid] ?? 'no-fire';
          const fireCount = fires.filter((f) => f.ruleUid === rule.uid).length;
          const detail = getActionDetail(rule);
          const isSelected = selectedRuleUid === rule.uid;
          return (
            <button
              type="button"
              key={rule.uid}
              onClick={() => onSelect(rule.uid)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                padding: 8,
                border: `1px solid ${isSelected ? tier.color : token.colorBorderSecondary}`,
                borderRadius: 4,
                background: isSelected ? `${tier.color}14` : token.colorBgContainer,
                cursor: 'pointer',
                textAlign: 'left',
                width: '100%',
              }}
            >
              <StatusIcon status={status} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {rule.name}
                </div>
                <div style={{ fontSize: 11, color: token.colorTextSecondary }}>
                  {detail.label ? `${detail.label}: ${detail.value}` : detail.value || detail.tooltip}
                </div>
              </div>
              {fireCount > 0 && <Tag color="success">{fireCount}×</Tag>}
            </button>
          );
        })}
      </Space>
    </Card>
  );
};

const StatusIcon: React.FC<{ status: TestRuleStatus }> = ({ status }) => {
  if (status === 'executed') return <CheckCircleTwoTone twoToneColor="#52c41a" style={{ fontSize: 16 }} />;
  if (status === 'no-fire') return <CloseCircleTwoTone twoToneColor="#d9d9d9" style={{ fontSize: 16 }} />;
  return <CloseCircleTwoTone twoToneColor="#bfbfbf" style={{ fontSize: 16 }} />;
};

const StatusTag: React.FC<{ status: TestRuleStatus }> = ({ status }) => {
  if (status === 'executed') return <Tag color="success">Executed</Tag>;
  if (status === 'no-fire') return <Tag>No fire</Tag>;
  return <Tag color="default">Skipped</Tag>;
};

export default TestResultsView;
