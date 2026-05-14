/**
 * Workflow Status — per-workflow circuit-breaker dashboard.
 *
 * One row per workflow × environment combination in the active
 * workspace, showing the circuit state (CLOSED / HALF-OPEN / OPEN),
 * consecutive-failure + consecutive-openings counts, last-error
 * message, and a live ticking countdown to `nextAttemptAt` for
 * paused circuits. Per-row actions:
 *   • Refresh now — forces a probe, bypassing both the canSchedule
 *     binding gate AND the circuit's `canAttempt` gate when open.
 *   • Reset circuit — clears failure counters + nextAttemptAt
 *     without running a probe.
 *
 * Intended UX: "the dashboard power users open to see why a workflow
 * isn't refreshing." Matches v4 `CircuitBreakerStatus` semantics
 * (state pill, countdown, manual bypass) but scaled to the extension's
 * per-env cache shape. Polled at 1-second intervals only when at
 * least one row is OPEN with a future `nextAttemptAt` — otherwise no
 * timer runs.
 */

import { ReloadOutlined, UndoOutlined } from '@ant-design/icons';
import { useEnvironments } from '@openheaders/ui/shared/hooks/useEnvironments';
import { useRules } from '@openheaders/ui/shared/hooks/useRules';
import { useAllLiveCaches } from '@openheaders/ui/shared/hooks/useLiveCache';
import { useLiveWorkflows } from '@openheaders/ui/shared/hooks/useLiveWorkflows';
import type { RefreshPolicy } from '@openheaders/core/types';
import type { LiveWorkflowRunSnapshot } from '@utils/bridge';
import { call } from '@utils/bridge';
import { App, Badge, Button, Empty, Space, Tag, Tooltip, Typography, theme } from 'antd';
import type React from 'react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { createPanelHeaderWiring, PanelHeader } from '@openheaders/ui/shared/dock-layout';
import { classifyRun, describeCircuit, describeRunSchedule, formatCountdown, statusColor } from './live-display';

const { Text } = Typography;

interface Props {
  /** Close handler wired by the shell so the X button toggles the tool window. */
  onClose: () => void;
  /** Double-click handler → open the matching Live Workflow editor tab. */
  onOpenWorkflow?: (workflowUid: string) => void;
}

interface Row {
  workflowUid: string;
  workflowName: string;
  /**
   * Refresh policy carried through so the row can word the schedule
   * chunks policy-aware ("auto-refresh in 3h" for interval vs.
   * "expires in 3h" for expires-in/at).
   */
  refreshPolicy: RefreshPolicy;
  environmentId: string | null;
  environmentName: string;
  run: LiveWorkflowRunSnapshot;
}

const WorkflowStatusPanel: React.FC<Props> = ({ onClose, onOpenWorkflow }) => {
  const { token } = theme.useToken();
  const { message } = App.useApp();
  const { workflows } = useLiveWorkflows();
  // Editing-scope workspace: in workbench per-tab mode this is the
  // tab's workspace (RuleProvider's override prop); otherwise it's
  // runtime-Active. Threaded into the SW so refresh + circuit-reset
  // act on the workspace the user is looking at, not runtime-Active
  // (MWPT-FULL session #11).
  const { activeWorkspaceId } = useRules();
  const editingWorkspaceId = activeWorkspaceId ?? undefined;
  const { environments, activeEnvironmentId } = useEnvironments();
  const workflowUids = useMemo(() => workflows.map((w) => w.uid), [workflows]);
  const { byWorkflowUid, isReady } = useAllLiveCaches(workflowUids);

  const envName = useCallback(
    (envId: string | null): string => {
      if (envId === null) return 'No environment';
      return environments.find((e) => e.uid === envId)?.name ?? 'Unknown env';
    },
    [environments],
  );

  // Flatten the nested map into one row per (workflow, env) cache
  // entry. Sort: active env first within each workflow, then by
  // severity (open → half-open → failing closed → healthy).
  const rows = useMemo<Row[]>(() => {
    const out: Row[] = [];
    for (const wf of workflows) {
      const runs = byWorkflowUid[wf.uid] ?? [];
      for (const run of runs) {
        out.push({
          workflowUid: wf.uid,
          workflowName: wf.name,
          refreshPolicy: wf.refresh,
          environmentId: run.environmentId,
          environmentName: envName(run.environmentId),
          run,
        });
      }
    }
    const severity = (r: Row): number => {
      const c = r.run.circuit;
      if (!c) return 3;
      if (c.state === 'open') return 0;
      if (c.state === 'half-open') return 1;
      if (c.consecutiveFailures > 0) return 2;
      return 3;
    };
    return out.sort((a, b) => {
      const byName = a.workflowName.localeCompare(b.workflowName);
      if (byName !== 0) return byName;
      const sev = severity(a) - severity(b);
      if (sev !== 0) return sev;
      // Active env wins ties — first row under a workflow is the one
      // whose env matches the user's current context.
      if (a.environmentId === activeEnvironmentId && b.environmentId !== activeEnvironmentId) return -1;
      if (b.environmentId === activeEnvironmentId && a.environmentId !== activeEnvironmentId) return 1;
      return a.environmentName.localeCompare(b.environmentName);
    });
  }, [workflows, byWorkflowUid, envName, activeEnvironmentId]);

  // 1-second ticker — only lives while at least one row has a future
  // nextAttemptAt countdown to render. No allocation on healthy-only
  // dashboards.
  const needsTick = useMemo(() => {
    const now = Date.now();
    return rows.some((r) => r.run.circuit?.state === 'open' && (r.run.circuit.nextAttemptAt ?? 0) > now);
  }, [rows]);
  const [, setNow] = useState(Date.now());
  useEffect(() => {
    if (!needsTick) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [needsTick]);

  const handleRefresh = useCallback(
    async (workflowUid: string, environmentId: string | null) => {
      const resp = await call('refreshLiveWorkflowNow', {
        workflowUid,
        environmentId,
        workspaceId: editingWorkspaceId,
      });
      if (resp.success) {
        message.success('Refreshed');
      } else {
        message.error(`Refresh failed: ${resp.error}`);
      }
    },
    [message, editingWorkspaceId],
  );

  const handleResetCircuit = useCallback(
    async (workflowUid: string, environmentId: string | null) => {
      const resp = await call('resetLiveWorkflowCircuit', {
        workflowUid,
        environmentId,
        workspaceId: editingWorkspaceId,
      });
      if (resp.success) {
        message.success('Circuit reset');
      } else {
        message.error(`Reset failed: ${resp.error}`);
      }
    },
    [message, editingWorkspaceId],
  );

  // ── Shared panel header (title + summary chip, hide on right) ──
  const headerWiring = useMemo(() => createPanelHeaderWiring({ onHide: onClose }), [onClose]);
  const header = (
    <PanelHeader
      wiring={headerWiring}
      title={
        <>
          <strong>Workflow Status</strong>
          <OverallSummary rows={rows} />
        </>
      }
    />
  );

  // ── Body ────────────────────────────────────────────────────────
  let body: React.ReactNode;
  if (!isReady) {
    body = (
      <div style={{ padding: 20, textAlign: 'center' }}>
        <Text type="secondary" style={{ fontSize: 12 }}>
          Loading…
        </Text>
      </div>
    );
  } else if (rows.length === 0) {
    body = (
      <div style={{ padding: 20, textAlign: 'center' }}>
        <Empty
          image={Empty.PRESENTED_IMAGE_SIMPLE}
          description={
            <Text type="secondary" style={{ fontSize: 12 }}>
              No workflow runs yet. Create a workflow and click Refresh to populate.
            </Text>
          }
        />
      </div>
    );
  } else {
    body = (
      <div style={{ display: 'flex', flexDirection: 'column' }}>
        {rows.map((row) => (
          <WorkflowStatusRow
            key={`${row.workflowUid}:${row.environmentId ?? '__none__'}`}
            row={row}
            isActiveEnv={row.environmentId === activeEnvironmentId}
            onRefresh={() => void handleRefresh(row.workflowUid, row.environmentId)}
            onResetCircuit={() => void handleResetCircuit(row.workflowUid, row.environmentId)}
            onOpenWorkflow={onOpenWorkflow ? () => onOpenWorkflow(row.workflowUid) : undefined}
          />
        ))}
      </div>
    );
  }

  return (
    <div
      className="rules-bottom-panel rules-bottom-panel--workflow-status"
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        background: token.colorBgContainer,
        overflow: 'hidden',
      }}
    >
      {header}
      <div style={{ flex: 1, overflow: 'auto' }}>{body}</div>
    </div>
  );
};

export default WorkflowStatusPanel;

// ── Overall summary (N healthy / M failing / K paused) ─────────────

const OverallSummary: React.FC<{ rows: Row[] }> = ({ rows }) => {
  const counts = useMemo(() => {
    let open = 0;
    let halfOpen = 0;
    let failing = 0;
    let healthy = 0;
    for (const r of rows) {
      const c = r.run.circuit;
      if (c?.state === 'open') open++;
      else if (c?.state === 'half-open') halfOpen++;
      else if (c && c.consecutiveFailures > 0) failing++;
      else healthy++;
    }
    return { open, halfOpen, failing, healthy, total: rows.length };
  }, [rows]);
  if (counts.total === 0) return null;
  return (
    <Space size={4}>
      {counts.healthy > 0 && (
        <Tag color="success" style={{ fontSize: 10, marginInlineEnd: 0 }}>
          {counts.healthy} healthy
        </Tag>
      )}
      {counts.failing > 0 && (
        <Tag color="warning" style={{ fontSize: 10, marginInlineEnd: 0 }}>
          {counts.failing} retrying
        </Tag>
      )}
      {counts.halfOpen > 0 && (
        <Tag color="warning" style={{ fontSize: 10, marginInlineEnd: 0 }}>
          {counts.halfOpen} probing
        </Tag>
      )}
      {counts.open > 0 && (
        <Tag color="error" style={{ fontSize: 10, marginInlineEnd: 0 }}>
          {counts.open} paused
        </Tag>
      )}
    </Space>
  );
};

// ── Single row ─────────────────────────────────────────────────────

interface RowProps {
  row: Row;
  isActiveEnv: boolean;
  onRefresh: () => void;
  onResetCircuit: () => void;
  onOpenWorkflow?: () => void;
}

const WorkflowStatusRow: React.FC<RowProps> = ({ row, isActiveEnv, onRefresh, onResetCircuit, onOpenWorkflow }) => {
  const { token } = theme.useToken();
  const level = classifyRun(row.run);
  const descriptor = describeCircuit(row.run);
  const c = row.run.circuit;

  const statePillColor = (): 'success' | 'warning' | 'error' | 'default' => {
    if (!c) return 'default';
    if (c.state === 'open') return 'error';
    if (c.state === 'half-open') return 'warning';
    if (c.consecutiveFailures > 0) return 'warning';
    return 'success';
  };

  const stateLabel = (): string => {
    if (!c) return 'idle';
    if (c.state === 'open') return 'PAUSED';
    if (c.state === 'half-open') return 'PROBING';
    if (c.consecutiveFailures > 0) return 'RETRYING';
    return 'HEALTHY';
  };

  // When an `onOpenWorkflow` handler is wired the row becomes a
  // keyboard-navigable button (double-click OR Enter/Space opens the
  // matching Live Workflow editor tab). Without a handler it stays a
  // plain presentational div. Biome's a11y rule requires the role +
  // keydown handler to co-exist with the pointer handler.
  const interactiveProps = onOpenWorkflow
    ? {
        role: 'button' as const,
        tabIndex: 0,
        onDoubleClick: onOpenWorkflow,
        onKeyDown: (e: React.KeyboardEvent<HTMLDivElement>) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            onOpenWorkflow();
          }
        },
      }
    : {};

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 4,
        padding: '8px 10px',
        borderBottom: `1px solid ${token.colorBorderSecondary}`,
        background: isActiveEnv ? token.colorFillAlter : 'transparent',
      }}
      {...interactiveProps}
    >
      {/* Row 1 — workflow name, env, state pill, dot */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span
          style={{
            width: 8,
            height: 8,
            borderRadius: '50%',
            background: statusColor(level),
            flexShrink: 0,
          }}
        />
        <Text strong style={{ fontSize: 12 }}>
          {row.workflowName}
        </Text>
        <Text type="secondary" style={{ fontSize: 11 }}>
          · {row.environmentName}
          {isActiveEnv && ' (active)'}
        </Text>
        <div style={{ flex: 1 }} />
        <Tooltip title={descriptor.hint}>
          <Badge
            status={statePillColor()}
            text={<Text style={{ fontSize: 10, letterSpacing: 0.4 }}>{stateLabel()}</Text>}
          />
        </Tooltip>
      </div>

      {/* Row 2 — meta: counts, schedule chunks, circuit countdown, last-error */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, fontSize: 11, color: token.colorTextSecondary }}>
        {c && c.consecutiveFailures > 0 && (
          <Tooltip title="Consecutive failures since the last successful refresh.">
            <Text type="secondary" style={{ fontSize: 11 }}>
              failures: {c.consecutiveFailures}
            </Text>
          </Tooltip>
        )}
        {c && c.consecutiveOpenings > 0 && (
          <Tooltip title="Number of times the circuit has transitioned OPEN in the current cycle. Halves on a well-aged recovery, decrements by one on a recent recovery.">
            <Text type="secondary" style={{ fontSize: 11 }}>
              openings: {c.consecutiveOpenings}
            </Text>
          </Tooltip>
        )}
        {describeRunSchedule(row.run, row.refreshPolicy).map((chunk) => (
          <Text key={chunk.text} type={chunk.tone} style={{ fontSize: 11 }}>
            {chunk.text}
          </Text>
        ))}
        {c?.state === 'open' && c.nextAttemptAt !== null && (
          <Tooltip title="Wall-clock time at which the next automatic probe will run. Click Refresh now to bypass.">
            <Text type="danger" style={{ fontSize: 11 }}>
              next attempt {formatCountdown(c.nextAttemptAt)}
            </Text>
          </Tooltip>
        )}
        {row.run.lastErrorMessage && (
          <Tooltip title={row.run.lastErrorMessage}>
            <Text type="danger" ellipsis style={{ fontSize: 11, maxWidth: 260 }}>
              {row.run.lastErrorMessage}
              {row.run.lastErrorStepId ? ` (${row.run.lastErrorStepId})` : ''}
            </Text>
          </Tooltip>
        )}
      </div>

      {/* Row 3 — actions */}
      <div style={{ display: 'flex', gap: 6 }}>
        <Button size="small" icon={<ReloadOutlined />} onClick={onRefresh}>
          Refresh now
        </Button>
        {c && (c.state !== 'closed' || c.consecutiveFailures > 0 || c.consecutiveOpenings > 0) && (
          <Tooltip title="Clear failure counters + pending backoff. Does not run a probe.">
            <Button size="small" icon={<UndoOutlined />} onClick={onResetCircuit}>
              Reset circuit
            </Button>
          </Tooltip>
        )}
      </div>
    </div>
  );
};
