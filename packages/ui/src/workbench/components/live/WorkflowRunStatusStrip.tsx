/**
 * WorkflowRunStatusStrip — the per-env run summary pinned to the bottom
 * of `LiveWorkflowEditor` edit mode (below both the Editor and Preview
 * panes, above nothing — it IS the editor's floor). Top row carries
 * workflow-level facts that don't vary by env (refresh policy +
 * bound-variable count); below it, one row per env that has a cache,
 * plus the active env row even when no cache exists for it. Distinct
 * from `WorkflowStatusPanel` (the tool-window circuit dashboard across
 * ALL workflows) — this strip is scoped to one workflow's editor.
 */

import type { LiveWorkflowRunSnapshot } from '@openheaders/core/bridge';
import type { RefreshPolicy } from '@openheaders/core/types';
import { useT } from '@openheaders/ui/context/LocaleContext';
import { useEnvironments } from '@openheaders/ui/shared/hooks/readers/useEnvironments';
import { Tooltip, Typography, theme } from 'antd';
import type React from 'react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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

// Resize bounds for the drag divider. Below MIN the strip is useless
// (less than one env row); above MAX it starts eating the editor.
const STRIP_MIN_H = 44;
const STRIP_MAX_H = 320;
// Natural-height cap before the user has ever dragged.
const STRIP_NATURAL_MAX_H = 140;

const WorkflowRunStatusStrip: React.FC<WorkflowRunStatusStripProps> = ({ runs, refresh, boundCount }) => {
  const { token } = theme.useToken();
  const t = useT();
  const { environments, activeEnvironmentId } = useEnvironments();

  // Divider drag — ephemeral UI state. `null` = natural height (capped);
  // set once the user drags, clamped to [MIN, MAX].
  const rootRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{ startY: number; startH: number } | null>(null);
  const [stripHeight, setStripHeight] = useState<number | null>(null);

  const handleResizeDown = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    dragRef.current = { startY: e.clientY, startH: rootRef.current?.offsetHeight ?? STRIP_NATURAL_MAX_H };
  }, []);
  const handleResizeMove = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    if (!drag) return;
    const next = drag.startH + (drag.startY - e.clientY);
    setStripHeight(Math.min(STRIP_MAX_H, Math.max(STRIP_MIN_H, next)));
  }, []);
  const handleResizeUp = useCallback(() => {
    dragRef.current = null;
  }, []);

  const perEnvRuns = useMemo(() => summarizeRunsByEnv(runs, activeEnvironmentId ?? null), [runs, activeEnvironmentId]);
  const envName = useCallback(
    (environmentId: string | null) => {
      if (environmentId === null) return t('workbench.editors.live.status.noEnvironment');
      return environments.find((e) => e.uid === environmentId)?.name ?? t('workbench.editors.live.status.unknownEnv');
    },
    [environments, t],
  );

  return (
    <div
      ref={rootRef}
      data-testid="wf-run-status-strip"
      style={{
        display: 'flex',
        flexDirection: 'column',
        background: token.colorFillAlter,
        borderTop: `1px solid ${token.colorBorderSecondary}`,
        fontSize: 11,
        flexShrink: 0,
        height: stripHeight ?? undefined,
        maxHeight: stripHeight ?? STRIP_NATURAL_MAX_H,
      }}
    >
      {/* Drag divider — resizes the strip between MIN and MAX. */}
      <div
        data-testid="wf-run-status-strip-resize"
        title={t('workbench.editors.live.status.dragToResize')}
        onPointerDown={handleResizeDown}
        onPointerMove={handleResizeMove}
        onPointerUp={handleResizeUp}
        style={{
          height: 8,
          flexShrink: 0,
          cursor: 'row-resize',
          touchAction: 'none',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <span style={{ width: 28, height: 3, borderRadius: 2, background: token.colorBorderSecondary }} />
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0, overflowY: 'auto', overscrollBehavior: 'none', padding: '0 12px 6px' }}>
      {/* Top row: refresh policy + binding count — workflow-level facts that don't vary by env */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        <Text type="secondary" style={{ fontSize: 11 }}>
          {describeRefreshPolicy(refresh, t)}
        </Text>
        <div style={{ flex: 1 }} />
        <Text type="secondary" style={{ fontSize: 11 }}>
          {t('workbench.editors.live.status.boundCount', { count: boundCount })}
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
                {entry.isActive ? ` ${t('workbench.editors.live.status.activeSuffix')}` : ''}
              </Text>
              {entry.run ? (
                <>
                  {describeRunSchedule(entry.run, refresh, t).map((chunk) => (
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
                  {entry.run.definitionallyStale === true && (
                    <Tooltip title={t('workbench.editors.live.status.needsReRunTooltip')}>
                      <Text type="warning" style={{ fontSize: 11 }}>
                        · {t('workbench.editors.live.status.needsReRun')}
                      </Text>
                    </Tooltip>
                  )}
                </>
              ) : (
                <Text type="warning" style={{ fontSize: 11 }}>
                  · {t('workbench.editors.live.status.neverRunForEnv')}
                </Text>
              )}
            </div>
          );
        })}
      </div>
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

const CircuitInlineStatus: React.FC<{ run: LiveWorkflowRunSnapshot }> = ({ run }) => {
  const t = useT();
  const [, setNow] = useState(Date.now());
  const descriptor = describeCircuit(run, t);
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
        {countdown ? ` · ${t('workbench.editors.live.status.nextAttempt', { countdown })}` : ''}
      </Text>
    </Tooltip>
  );
};
