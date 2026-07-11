/**
 * WorkflowRunStatusStrip — the per-env run summary embedded at the top
 * of `LiveWorkflowEditor` edit mode. Top row carries workflow-level
 * facts that don't vary by env (refresh policy + bound-variable
 * count); below it, one row per env that has a cache, plus the active
 * env row even when no cache exists for it. Distinct from
 * `WorkflowStatusPanel` (the tool-window circuit dashboard across ALL
 * workflows) — this strip is scoped to one workflow's editor.
 */

import type { LiveWorkflowRunSnapshot } from '@openheaders/core/bridge';
import type { RefreshPolicy } from '@openheaders/core/types';
import { useEnvironments } from '@openheaders/ui/shared/hooks/readers/useEnvironments';
import { Tooltip, Typography, theme } from 'antd';
import type React from 'react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  classifyRun,
  describeCircuit,
  describeRefreshPolicy,
  describeRunSchedule,
  formatCountdown,
  statusColor,
  summarizeRunsByEnv,
} from './live-display';

const { Text } = Typography;

interface WorkflowRunStatusStripProps {
  runs: LiveWorkflowRunSnapshot[];
  refresh: RefreshPolicy;
  boundCount: number;
}

const WorkflowRunStatusStrip: React.FC<WorkflowRunStatusStripProps> = ({ runs, refresh, boundCount }) => {
  const { token } = theme.useToken();
  const { environments, activeEnvironmentId } = useEnvironments();

  const perEnvRuns = useMemo(() => summarizeRunsByEnv(runs, activeEnvironmentId ?? null), [runs, activeEnvironmentId]);
  const envName = useCallback(
    (environmentId: string | null) => {
      if (environmentId === null) return 'No environment';
      return environments.find((e) => e.uid === environmentId)?.name ?? 'Unknown env';
    },
    [environments],
  );

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        padding: '6px 10px',
        background: token.colorFillAlter,
        borderRadius: 4,
        marginBottom: 14,
        fontSize: 11,
      }}
    >
      {/* Top row: refresh policy + binding count — workflow-level facts that don't vary by env */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        <Text type="secondary" style={{ fontSize: 11 }}>
          {describeRefreshPolicy(refresh)}
        </Text>
        <div style={{ flex: 1 }} />
        <Text type="secondary" style={{ fontSize: 11 }}>
          bound: {boundCount} variable{boundCount === 1 ? '' : 's'}
        </Text>
      </div>
      {/* Per-env table — one row per env that has a cache, plus the
        active env row even when no cache exists for it. The active
        env row is always first + visually highlighted so the user
        sees "what's resolved RIGHT NOW" at a glance. */}
      <div
        style={{
          marginTop: 6,
          display: 'flex',
          flexDirection: 'column',
          gap: 2,
        }}
      >
        {perEnvRuns.map((entry) => {
          const entryLevel = classifyRun(entry.run);
          return (
            <div
              key={entry.environmentId ?? '__none__'}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                padding: '3px 6px',
                borderRadius: 3,
                background: entry.isActive ? token.colorBgContainer : 'transparent',
                border: entry.isActive ? `1px solid ${token.colorBorderSecondary}` : '1px solid transparent',
              }}
            >
              <span
                style={{
                  width: 6,
                  height: 6,
                  borderRadius: '50%',
                  background: statusColor(entryLevel),
                  flexShrink: 0,
                }}
              />
              <Text
                style={{
                  fontSize: 11,
                  fontWeight: entry.isActive ? 600 : 400,
                  color: entry.isActive ? token.colorText : token.colorTextSecondary,
                }}
              >
                {envName(entry.environmentId)}
                {entry.isActive ? ' (active)' : ''}
              </Text>
              {entry.run ? (
                <>
                  {describeRunSchedule(entry.run, refresh).map((chunk) => (
                    <Text key={chunk.text} type={chunk.tone} style={{ fontSize: 11 }}>
                      · {chunk.text}
                    </Text>
                  ))}
                  <CircuitInlineStatus run={entry.run} />
                  {entry.run.lastErrorMessage && (
                    <Text type="danger" style={{ fontSize: 11 }}>
                      · {entry.run.lastErrorMessage}
                      {entry.run.lastErrorStepId ? ` (${entry.run.lastErrorStepId})` : ''}
                    </Text>
                  )}
                </>
              ) : (
                <Text type="warning" style={{ fontSize: 11 }}>
                  · never run for this env — click Refresh to populate
                </Text>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default WorkflowRunStatusStrip;

// ── CircuitInlineStatus ───────────────────────────────────────────
//
// Per-env circuit pill rendered inline with the "last Xm ago · expires
// Ym" row. Folds four distinct UX states into one small surface:
//   - green healthy: hidden (no label — the green dot upstream
//     already says "fine"; we don't want to spam the row).
//   - yellow pre-breaker: "· retry 2 of 3" + tooltip describing the
//     two-tier retry.
//   - yellow probing: "· probing…" (probe in flight; no countdown —
//     the chain will resolve shortly).
//   - red paused: "· paused · next attempt in 12m" with a live
//     ticking countdown, tooltip explaining the backoff window.
//
// Ticking uses a 1-second interval only when the circuit is OPEN and
// `nextAttemptAt` is in the future — no-op for every other state
// (no React timer, no wasted re-renders on healthy rows).
//
// Exported for the graph view's run summary row — same circuit
// wording on both surfaces, per the shared-vocabulary rule.

export const CircuitInlineStatus: React.FC<{ run: LiveWorkflowRunSnapshot }> = ({ run }) => {
  const [, setNow] = useState(Date.now());
  const descriptor = describeCircuit(run);
  const needsTick = descriptor.nextAttemptAt !== null && descriptor.nextAttemptAt > Date.now();

  useEffect(() => {
    if (!needsTick) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [needsTick]);

  // Healthy — no dedicated pill. The per-env dot already carries the
  // green signal; adding "· healthy" would just be noise.
  if (descriptor.level === 'green' || descriptor.level === 'idle') return null;

  const countdown = descriptor.nextAttemptAt !== null ? formatCountdown(descriptor.nextAttemptAt) : '';
  const labelColor = descriptor.level === 'red' ? 'danger' : descriptor.level === 'yellow' ? 'warning' : 'secondary';

  return (
    <Tooltip title={descriptor.hint}>
      <Text type={labelColor} style={{ fontSize: 11 }}>
        · {descriptor.label}
        {countdown ? ` · next attempt ${countdown}` : ''}
      </Text>
    </Tooltip>
  );
};
