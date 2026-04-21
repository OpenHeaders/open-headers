/**
 * RunReportView — workspace tab that renders a completed test run as
 * a flow pipeline.
 *
 * Layout mirrors `RuleFlow` (same start/end terminus, same priority-tier
 * groups, same `FlowRuleCard` for each rule) so the user reads run reports
 * in the same visual language they edit workbench in. Every card carries a
 * `RuleStatusOverlay` that colors its border / background and adds a
 * status tag:
 *
 *   - **executed**  (green)  — at least one fire was recorded and at least
 *                              one of those fires was NOT shadowed.
 *   - **shadowed**  (amber)  — every recorded fire was marked as shadowed
 *                              by a higher-priority terminal rule. Today
 *                              the arbitrator only models block-shadows-
 *                              everything, so this means a `block` rule
 *                              cancelled the request first.
 *   - **no-fire**  (grey)    — in scope but no request matched it.
 *   - **skipped** (dim grey) — disabled / incomplete / paused at run
 *                              start, so the test never tried to run it.
 *
 * Clicking a card opens a side-panel detail view (selection state lives in
 * this component). Clicking the explicit edit button on the card opens the
 * rule in the workspace editor (delegated to the `onSelectRule` prop).
 */

import {
  CheckCircleTwoTone,
  CloseCircleTwoTone,
  DeleteOutlined,
  ExclamationCircleTwoTone,
  ExperimentOutlined,
  MinusCircleTwoTone,
  WarningOutlined,
} from '@ant-design/icons';
import { useRules } from '@hooks/useRules';
import type { V5 } from '@openheaders/core/types';
import { call } from '@utils/bridge';
import { App, Button, Checkbox, Empty, Space, Spin, Tag, Tooltip, Typography, theme } from 'antd';
import type React from 'react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import type { LoadedTestRun } from '@/background/modules/test-run-store';
import { Connector, Terminus } from './rule-flow/Connector';
import type { RuleStatusOverlay } from './rule-flow/FlowRuleCard';
import PriorityGroup, { PRIORITY_TIERS } from './rule-flow/PriorityGroup';

const { Text, Title } = Typography;

// ── Types (must match background test-run-store) ────────────

type ShadowKind =
  | 'block-terminal'
  | 'redirect-retarget'
  | 'query-param-retarget'
  | 'mock-intercept'
  | 'header-stacking-ambiguous'
  | 'delay-page-intercept';

interface ShadowAttribution {
  uid: string;
  name: string;
  kind: ShadowKind;
}

interface TestFireEvent {
  ruleUid: string;
  url: string;
  /** Evidence tier: 'confirmed' | 'matched' | 'matched-fallback' */
  evidence: string;
  t: number;
  shadowedBy?: ShadowAttribution;
}

/** Loaded from test-run-store — same shape as StoredTestRun + isStale. */
type TestRun = LoadedTestRun;

/**
 * Human-readable explanation for each shadow reason. Keyed on the
 * `kind` field of `ShadowAttribution`. The {name} placeholder is
 * interpolated with the shadower's rule name by the call site — kept
 * out of the map so the copy can be reused across the side panel,
 * the card tooltip, and the fire-row tag without drift.
 */
const SHADOW_REASON_COPY: Record<ShadowKind, { short: string; long: (name: string) => string }> = {
  'block-terminal': {
    short: 'Blocked',
    long: (name) => `${name} blocked this request before this rule could run.`,
  },
  'redirect-retarget': {
    short: 'Redirected',
    long: (name) =>
      `${name} redirected the request to a different URL. This rule's modifications applied to the ` +
      'pre-redirect request, which was discarded.',
  },
  'query-param-retarget': {
    short: 'URL rewritten',
    long: (name) =>
      `${name} rewrote the query string. This rule's modifications applied to the pre-rewrite request, ` +
      'which was discarded.',
  },
  'mock-intercept': {
    short: 'Mocked',
    long: (name) =>
      `${name} fabricated the response. Response-side modifications from this rule operate on the ` +
      'mocked bytes, not the real backend response.',
  },
  'header-stacking-ambiguous': {
    short: 'Ambiguous order',
    long: (name) =>
      `${name} also modifies the same header on the same side. Chrome's evaluation order within a ` +
      'priority tier is undefined, so the effective header value is not deterministic.',
  },
  'delay-page-intercept': {
    short: 'Delayed',
    long: (name) =>
      `${name} redirected the navigation to the extension delay page. This rule's content-script ` +
      'injection targets the real URL, which never committed during the capture window.',
  },
};

// ── Component ────────────────────────────────────────────────────

interface RunReportViewProps {
  runId: string;
  onSelectRule?: (uid: string) => void;
  /**
   * Called after the user successfully deletes the run. The host
   * (App.tsx) closes this tab and re-focuses the bottom-panel Test
   * Runs list for the same owner — without this hop the user lands on
   * a "run not found" empty state, which is the original UX bug.
   */
  onAfterDelete?: () => void;
}

const RunReportView: React.FC<RunReportViewProps> = ({ runId, onSelectRule, onAfterDelete }) => {
  const { token } = theme.useToken();
  const { rules } = useRules();
  const { message } = App.useApp();
  const [run, setRun] = useState<TestRun | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedRuleUid, setSelectedRuleUid] = useState<string | null>(null);
  // Compact layout matches RuleFlow's default — denser cards, tighter
  // connectors, smaller terminus glyphs. Toggle lives in the toolbar.
  const [compact, setCompact] = useState(true);

  useEffect(() => {
    setLoading(true);
    setError(null);
    call('getTestRun', { runId })
      .then((data) => {
        if (data?.success && data.run) {
          setRun(data.run);
        } else if (data?.success) {
          setError('Run not found — it may have been deleted.');
        } else {
          setError(data?.error ?? 'Failed to load test run');
        }
        setLoading(false);
      })
      .catch((err: Error) => {
        setError(err.message);
        setLoading(false);
      });
  }, [runId]);

  const handleDelete = useCallback(() => {
    call('deleteTestRun', { runId })
      .then((data) => {
        if (data?.success) {
          message.success('Test run deleted');
          onAfterDelete?.();
        } else {
          message.error('Failed to delete test run');
        }
      })
      .catch(() => message.error('Failed to delete test run'));
  }, [runId, message, onAfterDelete]);

  // Resolve scoped workbench from the live rule store. Rules can change between
  // when the test ran and when the user opens the report — we render
  // whatever the rule still looks like now, falling back gracefully if a
  // rule was deleted (it just disappears from the flow).
  const scopedRules = useMemo(() => {
    if (!run) return [];
    const wanted = new Set(run.ruleUids);
    return rules.filter((r) => wanted.has(r.uid));
  }, [run, rules]);

  // Per-rule status overlays driving FlowRuleCard's color/tag treatment.
  // Overlay selection:
  //   - status === 'skipped'                                 → 'skipped'
  //   - status === 'executed' AND every fire has shadowedBy  → 'shadowed'
  //   - status === 'executed' AND ≥1 unshadowed fire         → 'executed'
  //   - status === 'no-fire' AND noFireReasons[uid] present  → 'shadowed'
  //     (static arbitration against observed URLs said the rule would
  //     have been shadowed — catches delay-page interception and any
  //     other case where the per-hop fire record was lost)
  //   - status === 'no-fire' otherwise                       → 'no-fire'
  const overlays = useMemo(() => {
    const map = new Map<string, RuleStatusOverlay>();
    if (!run) return map;
    const noFireReasons = run.noFireReasons ?? {};
    for (const uid of run.ruleUids) {
      const status = run.ruleStatuses[uid] ?? 'no-fire';
      const ruleFires = run.fires.filter((f) => f.ruleUid === uid);
      const fireCount = ruleFires.length;

      if (status === 'skipped') {
        map.set(uid, {
          status: 'skipped',
          fireCount: 0,
          reason: 'Disabled, incomplete, or under a paused group at the start of the test',
        });
        continue;
      }
      if (status === 'no-fire' || ruleFires.length === 0) {
        const predicted = noFireReasons[uid];
        if (predicted) {
          map.set(uid, {
            status: 'shadowed',
            fireCount: 0,
            shadowedBy: predicted,
          });
        } else {
          map.set(uid, { status: 'no-fire', fireCount: 0 });
        }
        continue;
      }
      // status === 'executed' with at least one fire — check shadow state.
      const unshadowedFires = ruleFires.filter((f) => !f.shadowedBy);
      if (unshadowedFires.length === 0) {
        map.set(uid, {
          status: 'shadowed',
          fireCount,
          shadowedBy: ruleFires[0]?.shadowedBy,
        });
      } else {
        map.set(uid, { status: 'executed', fireCount });
      }
    }
    return map;
  }, [run]);

  // Group scoped workbench by tier — same ordering as RuleFlow.
  const rulesByTier = useMemo(() => {
    const map = new Map<string, V5.Rule[]>();
    for (const tier of PRIORITY_TIERS) map.set(tier.key, []);
    for (const rule of scopedRules) {
      const tier = PRIORITY_TIERS.find((t) => t.ruleTypes.includes(rule.type));
      if (tier) map.get(tier.key)!.push(rule);
    }
    return map;
  }, [scopedRules]);

  // Tally counts for the header strip.
  const tally = useMemo(() => {
    let executed = 0;
    let shadowed = 0;
    let noFire = 0;
    let skipped = 0;
    for (const overlay of overlays.values()) {
      if (overlay.status === 'executed') executed += 1;
      else if (overlay.status === 'shadowed') shadowed += 1;
      else if (overlay.status === 'no-fire') noFire += 1;
      else if (overlay.status === 'skipped') skipped += 1;
    }
    return { executed, shadowed, noFire, skipped };
  }, [overlays]);

  const selectedRule = useMemo(
    () => (selectedRuleUid ? rules.find((r) => r.uid === selectedRuleUid) : null),
    [selectedRuleUid, rules],
  );

  const selectedFires = useMemo(
    () => (selectedRuleUid && run ? run.fires.filter((f) => f.ruleUid === selectedRuleUid) : []),
    [selectedRuleUid, run],
  );

  const selectedOverlay = selectedRuleUid ? overlays.get(selectedRuleUid) : null;

  // Open the rule in the workspace editor — distinct from selecting it
  // for the side-panel preview.
  const handleOpenInEditor = useCallback(
    (uid: string) => {
      onSelectRule?.(uid);
    },
    [onSelectRule],
  );

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%' }}>
        <Spin tip="Loading test run…" />
      </div>
    );
  }

  if (error || !run) {
    return (
      <div style={{ padding: 48 }}>
        <Empty
          description={
            <Space direction="vertical" size={8} style={{ maxWidth: 420 }}>
              <Text>{error ?? 'No run loaded'}</Text>
              <Text type="secondary" style={{ fontSize: 12 }}>
                Test runs live under the entity they were run against — open the Test Runs tab in the bottom panel from
                a collection, folder, or rule to see its history.
              </Text>
            </Space>
          }
        />
      </div>
    );
  }

  const visibleTiers = PRIORITY_TIERS.filter((t) => (rulesByTier.get(t.key) ?? []).length > 0);

  return (
    <div className="rule-flow" data-compact={compact} style={{ height: '100%', display: 'flex', minHeight: 0 }}>
      {/* Main pipeline column */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0, minWidth: 0 }}>
        {/* Header / toolbar — mirrors RuleFlow's toolbar styling */}
        <div className="rule-flow-toolbar" style={{ borderBottom: `1px solid ${token.colorBorderSecondary}` }}>
          <Space size={12} align="center" wrap>
            <Space size={6} align="center">
              <ExperimentOutlined style={{ fontSize: 16, color: token.colorPrimary }} />
              <Title level={5} style={{ margin: 0 }}>
                Run Report
              </Title>
            </Space>
            <Text type="secondary" style={{ fontSize: 11 }}>
              {run.url}
            </Text>
            <Text type="secondary" style={{ fontSize: 11 }}>
              · {new Date(run.endedAt).toLocaleString()}
            </Text>
            <Text type="secondary" style={{ fontSize: 11 }}>
              · {run.waitSeconds}s capture
            </Text>
          </Space>
          <Space size={8}>
            <Checkbox checked={compact} onChange={(e) => setCompact(e.target.checked)} style={{ fontSize: 11 }}>
              <span style={{ fontSize: 11, color: token.colorTextSecondary }}>Compact</span>
            </Checkbox>
            {run.isStale && (
              <Tooltip title="The owning rule, folder, or collection has changed since this test ran. The report still reflects the rules as they were at run time.">
                <Tag color="warning" style={{ display: 'inline-flex', alignItems: 'center', gap: 4, margin: 0 }}>
                  <WarningOutlined />
                  Stale
                </Tag>
              </Tooltip>
            )}
            <Tally label="executed" count={tally.executed} color="success" icon="executed" />
            <Tally label="shadowed" count={tally.shadowed} color="warning" icon="shadowed" />
            <Tally label="no fire" count={tally.noFire} color="default" icon="no-fire" />
            {tally.skipped > 0 && <Tally label="skipped" count={tally.skipped} color="default" icon="skipped" />}
            <Tally label="fires" count={run.fires.length} color="blue" />
            <Button size="small" danger icon={<DeleteOutlined />} onClick={handleDelete}>
              Delete
            </Button>
          </Space>
        </div>

        {/* Pipeline canvas — same dot-grid background as RuleFlow */}
        <div className="rule-flow-pipeline" style={{ flex: 1 }}>
          {visibleTiers.length === 0 ? (
            <Empty description="No rules in this run" style={{ marginTop: 48 }} />
          ) : (
            <>
              <Terminus type="start" compact={compact} />
              <Connector label="evaluate conditions" compact={compact} />

              {visibleTiers.map((tier, i) => {
                const tierRules = rulesByTier.get(tier.key) ?? [];
                return (
                  <div
                    key={tier.key}
                    style={{ width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center' }}
                  >
                    <PriorityGroup
                      tier={tier}
                      rules={tierRules}
                      onSelectRule={handleOpenInEditor}
                      onCreateRule={() => {
                        // No-op in read-only mode — PriorityGroup hides the
                        // Add Rule button when readOnly is set.
                      }}
                      compact={compact}
                      readOnly
                      statusOverlays={overlays}
                      selectedRuleUid={selectedRuleUid}
                      onCardClick={(uid) => setSelectedRuleUid(uid)}
                    />
                    {i < visibleTiers.length - 1 && (
                      <Connector label={i === 0 ? 'then' : undefined} compact={compact} />
                    )}
                  </div>
                );
              })}

              <Connector compact={compact} />
              <Terminus type="end" compact={compact} />
            </>
          )}
        </div>
      </div>

      {/* Drill-down side panel for the selected rule */}
      {selectedRule && selectedOverlay && (
        <DrillDownPanel
          rule={selectedRule}
          overlay={selectedOverlay}
          fires={selectedFires}
          onClose={() => setSelectedRuleUid(null)}
          onOpenInEditor={() => handleOpenInEditor(selectedRule.uid)}
        />
      )}
    </div>
  );
};

// ── Subcomponents ────────────────────────────────────────────────

interface TallyProps {
  label: string;
  count: number;
  color: string;
  icon?: 'executed' | 'shadowed' | 'no-fire' | 'skipped';
}

const Tally: React.FC<TallyProps> = ({ label, count, color, icon }) => {
  const iconNode = icon ? <StatusIcon status={icon} /> : null;
  return (
    <Tag color={color} style={{ margin: 0, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
      {iconNode}
      {count} {label}
    </Tag>
  );
};

const StatusIcon: React.FC<{ status: 'executed' | 'shadowed' | 'no-fire' | 'skipped' }> = ({ status }) => {
  if (status === 'executed') return <CheckCircleTwoTone twoToneColor="#52c41a" style={{ fontSize: 12 }} />;
  if (status === 'shadowed') return <ExclamationCircleTwoTone twoToneColor="#faad14" style={{ fontSize: 12 }} />;
  if (status === 'no-fire') return <CloseCircleTwoTone twoToneColor="#bfbfbf" style={{ fontSize: 12 }} />;
  return <MinusCircleTwoTone twoToneColor="#d9d9d9" style={{ fontSize: 12 }} />;
};

interface DrillDownPanelProps {
  rule: V5.Rule;
  overlay: RuleStatusOverlay;
  fires: TestFireEvent[];
  onClose: () => void;
  onOpenInEditor: () => void;
}

const DrillDownPanel: React.FC<DrillDownPanelProps> = ({ rule, overlay, fires, onClose, onOpenInEditor }) => {
  const { token } = theme.useToken();
  return (
    <div
      style={{
        width: 340,
        borderLeft: `1px solid ${token.colorBorderSecondary}`,
        background: token.colorBgContainer,
        padding: 16,
        overflowY: 'auto',
        flexShrink: 0,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <Title level={5} style={{ marginTop: 0, marginBottom: 2, wordBreak: 'break-word' }}>
            {rule.name}
          </Title>
          <Text type="secondary" style={{ fontSize: 11 }}>
            {rule.type}
          </Text>
        </div>
        <Button size="small" type="text" onClick={onClose}>
          Close
        </Button>
      </div>

      <div style={{ marginTop: 12 }}>
        <Text strong style={{ fontSize: 12 }}>
          Outcome
        </Text>
        <div style={{ marginTop: 4 }}>
          <OutcomeTag overlay={overlay} />
        </div>
        {overlay.status === 'shadowed' && overlay.shadowedBy && (
          <Text type="secondary" style={{ fontSize: 11, display: 'block', marginTop: 6 }}>
            {SHADOW_REASON_COPY[(overlay.shadowedBy as ShadowAttribution).kind ?? 'block-terminal'].long(
              overlay.shadowedBy.name,
            )}
          </Text>
        )}
        {overlay.status === 'skipped' && overlay.reason && (
          <Text type="secondary" style={{ fontSize: 11, display: 'block', marginTop: 6 }}>
            {overlay.reason}
          </Text>
        )}
        {overlay.status === 'no-fire' && (
          <Text type="secondary" style={{ fontSize: 11, display: 'block', marginTop: 6 }}>
            No request matched this rule's conditions during the capture window.
          </Text>
        )}
      </div>

      <div style={{ marginTop: 16 }}>
        <Text strong style={{ fontSize: 12 }}>
          Fires ({fires.length})
        </Text>
        {fires.length === 0 ? (
          <div style={{ marginTop: 4 }}>
            <Text type="secondary" style={{ fontSize: 11 }}>
              No requests recorded for this rule.
            </Text>
          </div>
        ) : (
          <div style={{ marginTop: 6, maxHeight: 320, overflowY: 'auto' }}>
            {fires.slice(0, 30).map((fire, i) => (
              <div
                key={`${fire.t}-${i}`}
                style={{
                  fontSize: 11,
                  color: token.colorTextSecondary,
                  marginBottom: 6,
                  padding: '4px 6px',
                  border: `1px solid ${token.colorBorderSecondary}`,
                  borderRadius: 4,
                  wordBreak: 'break-all',
                }}
              >
                <div style={{ display: 'flex', gap: 4, marginBottom: 2, alignItems: 'center' }}>
                  <EvidenceTag evidence={fire.evidence} />
                  {fire.shadowedBy && (
                    <Tooltip title={SHADOW_REASON_COPY[fire.shadowedBy.kind].long(fire.shadowedBy.name)}>
                      <Tag color="warning" style={{ fontSize: 9, margin: 0, lineHeight: '14px' }}>
                        {SHADOW_REASON_COPY[fire.shadowedBy.kind].short.toLowerCase()}
                      </Tag>
                    </Tooltip>
                  )}
                </div>
                {fire.url || <em>(DNR match)</em>}
              </div>
            ))}
            {fires.length > 30 && (
              <Text type="secondary" style={{ fontSize: 10 }}>
                +{fires.length - 30} more
              </Text>
            )}
          </div>
        )}
      </div>

      <div style={{ marginTop: 16 }}>
        <Button size="small" block onClick={onOpenInEditor}>
          Open rule in editor
        </Button>
      </div>
    </div>
  );
};

const OutcomeTag: React.FC<{ overlay: RuleStatusOverlay }> = ({ overlay }) => {
  const { status, fireCount } = overlay;
  if (status === 'executed') {
    return (
      <Tag color="success" style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
        <CheckCircleTwoTone twoToneColor="#52c41a" style={{ fontSize: 12 }} />
        Executed{fireCount > 1 ? ` (${fireCount}×)` : ''}
      </Tag>
    );
  }
  if (status === 'shadowed') {
    return (
      <Tag color="warning" style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
        <ExclamationCircleTwoTone twoToneColor="#faad14" style={{ fontSize: 12 }} />
        Shadowed
      </Tag>
    );
  }
  if (status === 'no-fire') {
    return (
      <Tag style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
        <CloseCircleTwoTone twoToneColor="#bfbfbf" style={{ fontSize: 12 }} />
        No fire
      </Tag>
    );
  }
  return (
    <Tag style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
      <MinusCircleTwoTone twoToneColor="#d9d9d9" style={{ fontSize: 12 }} />
      Skipped
    </Tag>
  );
};

const EvidenceTag: React.FC<{ evidence: string }> = ({ evidence }) => {
  const colorMap: Record<string, string> = {
    confirmed: 'green',
    matched: 'blue',
    'matched-fallback': 'cyan',
  };
  return (
    <Tag color={colorMap[evidence] ?? 'default'} style={{ fontSize: 9, margin: 0, lineHeight: '14px' }}>
      {evidence}
    </Tag>
  );
};

export default RunReportView;
