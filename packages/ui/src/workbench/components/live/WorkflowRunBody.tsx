/**
 * WorkflowRunBody — the workflow tab's Run view (the workflow runs
 * plan, The Run view): the last run of this workflow seen on this page,
 * as its steps in order on the left and the selected step's product on
 * the right.
 *
 * The rows come from the run's step events, never from the cache row or
 * a run report. A workflow that holds a step of an action the model does
 * not know has no run to show: its rows say which steps cannot run.
 */

import {
  applyRunFact,
  isExpectStep,
  isKnownStep,
  isListenStep,
  isSendStep,
  isUnknownStep,
  runFactOf,
  runRefusalEvents,
  runTotals,
  runVerdict,
  unknownStepMessage,
  type WorkflowRunRecord,
  type WorkflowRunStepRow,
  type WorkflowRunVerdict,
} from '@openheaders/core/live';
import type { LiveWorkflow } from '@openheaders/core/types';
import { useT } from '@openheaders/ui/context/LocaleContext';
import { useEnvironments } from '@openheaders/ui/shared/hooks/readers/useEnvironments';
import { useRequests } from '@openheaders/ui/shared/hooks/readers/useRequests';
import { Tag, Typography, theme } from 'antd';
import type React from 'react';
import { useEffect, useMemo, useState } from 'react';
import { readKeptRunProduct } from '../../data/workflow-run-store';
import { formatDurationRolled } from '../request-editor/response/response-meta';
import { METHOD_COLORS, REQUEST_KIND_COLORS } from '../sidebar/icons';
import {
  defaultRunSelection,
  describeRunRow,
  describeRunVerdict,
  type RunRowContext,
  type RunRowTone,
  type RunStepAction,
} from './run-display';
import { useWorkflowRun } from './use-workflow-run';
import WorkflowRunProductPane from './WorkflowRunProductPane';

const { Text } = Typography;

interface Props {
  workflow: LiveWorkflow;
  /** The workflow holds a step of an action the model does not know — it is not run. */
  needsUpdate: boolean;
}

const VERDICT_COLOR: Record<WorkflowRunVerdict, string> = {
  running: 'processing',
  passed: 'success',
  failed: 'error',
  'cannot-run': 'warning',
};

/** What a needs-update workflow shows in place of a run: no step ran, and the steps of an action the model does not know say why. */
function refusedRecord(workflow: LiveWorkflow): WorkflowRunRecord | null {
  const refusals = workflow.steps
    .filter(isUnknownStep)
    .filter((step) => !isKnownStep(step))
    .map((step) => ({ stepId: step.id, reason: unknownStepMessage(step) }));
  return runRefusalEvents(workflow, 0, refusals)
    .map(runFactOf)
    .reduce<WorkflowRunRecord | null>(
      (record, fact) => applyRunFact(record, { runId: '', environmentId: null }, fact),
      null,
    );
}

interface StepTarget {
  /** The step's action; `null` for a step of an action this build does not know. */
  action: RunStepAction | null;
  tag: string;
  tagColor: string;
  name: string;
  muted: boolean;
}

/** How often a wait's elapsed time is redrawn while an `expect` is waiting. */
const WAIT_TICK_MS = 200;

const WorkflowRunBody: React.FC<Props> = ({ workflow, needsUpdate }) => {
  const { token } = theme.useToken();
  const t = useT();
  const kept = useWorkflowRun(workflow.uid);
  const { environments } = useEnvironments();
  const requestsApi = useRequests();
  const { requests, graphqlRequests } = requestsApi;
  const [pickedStepId, setPickedStepId] = useState<string | null>(null);

  const refused = useMemo(() => (needsUpdate ? refusedRecord(workflow) : null), [needsUpdate, workflow]);
  const record = refused ?? kept?.record ?? null;

  const waiting = record?.steps.some((row) => row.state === 'running' && row.awaiting !== undefined) === true;
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!waiting) return;
    setNow(Date.now());
    const id = setInterval(() => setNow(Date.now()), WAIT_TICK_MS);
    return () => clearInterval(id);
  }, [waiting]);

  const notFound = (action: RunStepAction): StepTarget => ({
    action,
    tag: '',
    tagColor: token.colorTextTertiary,
    name: t('workbench.editors.live.graph.requestNotFound'),
    muted: true,
  });

  /** The session request a `listen` step names — of the kinds a run opens today. */
  const sessionRequestOf = (listenId: string) => {
    const listen = workflow.steps.find((each) => each.id === listenId);
    if (listen === undefined || !isListenStep(listen)) return undefined;
    return requestsApi.mqttRequests.find((request) => request.uid === listen.sessionRequestUid);
  };

  const targetOf = (stepId: string): StepTarget | null => {
    const step = workflow.steps.find((each) => each.id === stepId);
    if (step === undefined) return null;
    if (isListenStep(step)) {
      const session = sessionRequestOf(step.id);
      if (session === undefined) return notFound('listen');
      return { action: 'listen', tag: 'MQTT', tagColor: REQUEST_KIND_COLORS.mqtt, name: session.name, muted: false };
    }
    if (isSendStep(step)) {
      const saved = sessionRequestOf(step.on)?.savedMessages.find((message) => message.uid === step.messageUid);
      return { action: 'send', tag: '', tagColor: token.colorTextTertiary, name: saved?.name ?? '', muted: false };
    }
    if (isExpectStep(step)) {
      return { action: 'expect', tag: '', tagColor: token.colorTextTertiary, name: step.address ?? '', muted: false };
    }
    if (isUnknownStep(step)) {
      return { action: null, tag: step.action, tagColor: token.colorTextTertiary, name: '', muted: true };
    }
    const http = requests.find((request) => request.uid === step.requestUid);
    if (http) {
      return {
        action: 'call',
        tag: http.method,
        tagColor: METHOD_COLORS[http.method] ?? token.colorText,
        name: http.name,
        muted: false,
      };
    }
    const graphql = graphqlRequests.find((request) => request.uid === step.requestUid);
    if (graphql) {
      return { action: 'call', tag: 'GQL', tagColor: REQUEST_KIND_COLORS.graphql, name: graphql.name, muted: false };
    }
    return notFound('call');
  };

  /** The step whose start opened an `expect`'s window. */
  const triggerOf = (stepId: string): string | undefined => {
    const step = workflow.steps.find((each) => each.id === stepId);
    return step !== undefined && isExpectStep(step) ? step.after : undefined;
  };

  /** A `listen` row's session: open while the run goes, then how it closed. */
  const sessionOf = (row: WorkflowRunStepRow, running: WorkflowRunRecord): RunRowContext['session'] => {
    if (row.state !== 'settled' || row.settlement.state !== 'ready') return undefined;
    if (running.ended === null) return 'open';
    return running.ended.sessions?.find((close) => close.stepId === row.id);
  };

  if (record === null) {
    return (
      <div
        data-testid="wf-run-empty"
        style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}
      >
        <Text type="secondary" style={{ fontSize: 12, textAlign: 'center' }}>
          {t('workbench.editors.live.run.empty', { button: t('workbench.editors.live.workflow.refresh') })}
        </Text>
      </div>
    );
  }

  const verdict = runVerdict(record);
  const totals = runTotals(record);
  const selectedId =
    pickedStepId !== null && record.steps.some((row) => row.id === pickedStepId)
      ? pickedStepId
      : defaultRunSelection(record.steps);
  const summary = [
    t('workbench.editors.live.run.total.passed', { count: totals.passed }),
    t('workbench.editors.live.run.total.failed', { count: totals.failed }),
    ...(totals.skipped > 0 ? [t('workbench.editors.live.run.total.skipped', { count: totals.skipped })] : []),
    ...(totals.cannotRun > 0 ? [t('workbench.editors.live.run.total.cannotRun', { count: totals.cannotRun })] : []),
    ...(totals.notRun > 0 ? [t('workbench.editors.live.run.total.notRun', { count: totals.notRun })] : []),
    ...(refused === null && record.ended !== null ? [formatDurationRolled(record.ended.durationMs)] : []),
    ...(refused === null
      ? [
          record.environmentId === null
            ? t('workbench.editors.live.status.noEnvironment')
            : (environments.find((environment) => environment.uid === record.environmentId)?.name ??
              t('workbench.editors.live.status.unknownEnv')),
        ]
      : []),
  ].join(' · ');
  const footer =
    verdict === 'failed'
      ? t('workbench.editors.live.run.footer.failed')
      : verdict === 'cannot-run'
        ? t('workbench.editors.live.run.footer.cannotRun')
        : null;

  return (
    <div data-testid="wf-run-view" data-run-verdict={verdict} style={{ height: '100%', display: 'flex', minHeight: 0 }}>
      <div
        style={{
          flex: '1 1 0',
          minWidth: 320,
          display: 'flex',
          flexDirection: 'column',
          minHeight: 0,
          borderRight: `1px solid ${token.colorBorderSecondary}`,
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            padding: '8px 12px',
            borderBottom: `1px solid ${token.colorBorderSecondary}`,
            flexShrink: 0,
          }}
        >
          <Tag color={VERDICT_COLOR[verdict]} data-testid="wf-run-verdict" style={{ marginInlineEnd: 0 }}>
            {describeRunVerdict(verdict, t)}
          </Tag>
          <Text type="secondary" ellipsis style={{ fontSize: 12, minWidth: 0 }}>
            {summary}
          </Text>
        </div>
        <div className="oh-persistent-scroll" style={{ flex: 1, minHeight: 0 }}>
          {record.steps.map((row) => (
            <RunRow
              key={row.id}
              row={row}
              target={targetOf(row.id)}
              now={now}
              session={sessionOf(row, record)}
              selected={row.id === selectedId}
              onSelect={() => setPickedStepId(row.id)}
            />
          ))}
          {footer !== null && (
            <div style={{ padding: '6px 12px' }}>
              <Text type="secondary" style={{ fontSize: 12 }}>
                {footer}
              </Text>
            </div>
          )}
        </div>
      </div>
      <div style={{ flex: '1.2 1 0', minWidth: 0, minHeight: 0 }}>
        <WorkflowRunProductPane
          stepId={selectedId}
          state={selectedId === null ? undefined : kept?.products[selectedId]}
          product={selectedId === null || refused !== null ? null : readKeptRunProduct(record.runId, selectedId)}
          trigger={selectedId === null ? undefined : triggerOf(selectedId)}
        />
      </div>
    </div>
  );
};

export default WorkflowRunBody;

// ── One row ────────────────────────────────────────────────────────

const ACTION_WORD = {
  call: 'workbench.editors.live.run.action.call',
  listen: 'workbench.editors.live.run.action.listen',
  send: 'workbench.editors.live.run.action.send',
  expect: 'workbench.editors.live.run.action.expect',
} as const;

const RunRow: React.FC<{
  row: WorkflowRunStepRow;
  target: StepTarget | null;
  now: number;
  session: RunRowContext['session'];
  selected: boolean;
  onSelect: () => void;
}> = ({ row, target, now, session, selected, onSelect }) => {
  const { token } = theme.useToken();
  const t = useT();
  const action = target?.action ?? null;
  const display = describeRunRow(row, t, {
    now,
    ...(action !== null ? { action } : {}),
    ...(session !== undefined ? { session } : {}),
  });

  return (
    <div
      role="button"
      tabIndex={0}
      data-testid={`wf-run-row-${row.id}`}
      data-run-state={display.tone}
      data-selected={selected ? 'true' : undefined}
      onClick={onSelect}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onSelect();
        }
      }}
      style={{
        display: 'grid',
        gridTemplateColumns: '14px 54px minmax(0, 1fr)',
        columnGap: 10,
        alignItems: 'baseline',
        padding: '6px 12px',
        borderBottom: `1px solid ${token.colorBorderSecondary}`,
        background: selected ? token.controlItemBgActive : 'transparent',
        cursor: 'pointer',
        fontSize: 12,
      }}
    >
      <RunDot tone={display.tone} />
      {action !== null ? (
        <Text strong style={{ fontSize: 12 }}>
          {t(ACTION_WORD[action])}
        </Text>
      ) : (
        <span />
      )}
      {/* The facts sit beside the name where the pane has room and drop under the id, whole, where it has not. */}
      <span style={{ minWidth: 0, display: 'flex', flexWrap: 'wrap', alignItems: 'baseline', columnGap: 10 }}>
        <Text
          type="secondary"
          ellipsis
          style={{ flex: '0 1 96px', minWidth: 60, fontSize: 11, fontFamily: "'SF Mono', monospace" }}
        >
          {row.id}
        </Text>
        <span
          style={{
            flex: '1 1 72px',
            minWidth: 0,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {target !== null && target.tag !== '' && (
            <span style={{ fontSize: 10, fontWeight: 600, marginRight: 6, color: target.tagColor }}>{target.tag}</span>
          )}
          {target !== null && (
            <span style={{ color: target.muted ? token.colorTextTertiary : token.colorText }}>{target.name}</span>
          )}
        </span>
        <Text
          type="secondary"
          data-testid={`wf-run-facts-${row.id}`}
          style={{ fontSize: 12, marginLeft: 'auto', textAlign: 'right', wordBreak: 'normal' }}
        >
          {display.facts.join(' · ')}
        </Text>
      </span>
      {display.sub && (
        <Text type={display.sub.tone} style={{ gridColumn: '3 / -1', fontSize: 12, marginTop: 2 }}>
          {display.sub.text}
        </Text>
      )}
    </div>
  );
};

const RunDot: React.FC<{ tone: RunRowTone }> = ({ tone }) => {
  const { token } = theme.useToken();
  const hollow = tone === 'waiting' || tone === 'not-run' || tone === 'skipped';
  const color =
    tone === 'passed'
      ? token.colorSuccess
      : tone === 'failed'
        ? token.colorError
        : tone === 'running'
          ? token.colorPrimary
          : tone === 'cannot-run' || tone === 'skipped'
            ? token.colorWarning
            : token.colorTextQuaternary;
  return (
    <span
      style={{
        width: 8,
        height: 8,
        alignSelf: 'center',
        boxSizing: 'border-box',
        borderRadius: tone === 'cannot-run' ? 2 : '50%',
        background: hollow ? 'transparent' : color,
        border: hollow ? `1.5px solid ${color}` : undefined,
        boxShadow: tone === 'running' ? `0 0 0 3px ${token.colorPrimaryBg}` : undefined,
      }}
    />
  );
};
