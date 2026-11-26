/**
 * Display helpers for the workflow Run view (the workflow runs plan,
 * The Run view — the row vocabulary). Pure: a row's facts and its one
 * sentence derive here from the run record alone.
 */

import type { SessionClose, SessionOpenFacts, WorkflowRunStepRow, WorkflowRunVerdict } from '@openheaders/core/live';
import type { Translate } from '@openheaders/ui/context/LocaleContext';
import { formatDurationRolled } from '../request-editor/response/response-meta';

export type RunRowTone = 'waiting' | 'running' | 'passed' | 'failed' | 'skipped' | 'not-run' | 'cannot-run';

export type RunStepAction = 'call' | 'listen' | 'send' | 'expect';

export interface RunRowDisplay {
  tone: RunRowTone;
  /** Short facts, shown joined on the row's right. */
  facts: string[];
  /** The line under the row — a failure's sentence, a skip's reason, how a session opened. */
  sub?: { text: string; tone: 'secondary' | 'danger' | 'warning' };
}

/** What a row's words need beyond the row itself. */
export interface RunRowContext {
  /** The step's action, where the workflow still holds the step. */
  action?: RunStepAction;
  /** The clock, for a wait that says how far into its deadline it is. */
  now?: number;
  /** A `listen`'s session: open while the run goes, then how it closed. */
  session?: 'open' | SessionClose;
}

export function describeRunRow(row: WorkflowRunStepRow, t: Translate, context: RunRowContext = {}): RunRowDisplay {
  if (row.state === 'waiting') return { tone: 'waiting', facts: [t('workbench.editors.live.run.row.waiting')] };
  if (row.state === 'running') {
    const attempt =
      row.maxAttempts > 1
        ? [t('workbench.editors.live.run.row.attempt', { attempt: row.attempt, max: row.maxAttempts })]
        : [];
    if (row.held === true) {
      return { tone: 'running', facts: [t('workbench.editors.live.run.row.heldByRateLimit'), ...attempt] };
    }
    if (row.awaiting !== undefined) {
      const { address, since, timeoutMs } = row.awaiting;
      return {
        tone: 'running',
        facts: [
          address === null
            ? t('workbench.editors.live.run.row.waitingForMessage')
            : t('workbench.editors.live.run.row.waitingFor', { address }),
          ...(context.now !== undefined
            ? [
                t('workbench.editors.live.run.row.elapsedOf', {
                  elapsed: formatDurationRolled(Math.min(context.now - since, timeoutMs)),
                  deadline: formatDurationRolled(timeoutMs),
                }),
              ]
            : []),
        ],
      };
    }
    if (context.action === 'listen') {
      return { tone: 'running', facts: [t('workbench.editors.live.run.row.connecting')] };
    }
    return { tone: 'running', facts: [t('workbench.editors.live.run.row.sending'), ...attempt] };
  }
  const { settlement } = row;
  const captures = (names: readonly string[]): string[] =>
    names.length > 0 ? [t('workbench.editors.live.run.row.captures', { count: names.length })] : [];
  switch (settlement.state) {
    case 'ready': {
      const { session } = context;
      const opened = settlement.facts === undefined ? [] : describeOpenFacts(settlement.facts, t);
      return {
        tone: 'passed',
        facts: [
          t('workbench.editors.live.run.row.readyIn', { duration: formatDurationRolled(settlement.readyMs) }),
          ...(session === undefined
            ? []
            : session === 'open'
              ? [t('workbench.editors.live.run.row.open')]
              : [
                  t('workbench.editors.live.run.row.closedAfter', {
                    duration: formatDurationRolled(session.openForMs),
                  }),
                ]),
        ],
        ...(session !== undefined && session !== 'open' && session.warning !== undefined
          ? { sub: { text: session.warning, tone: 'warning' } }
          : opened.length > 0
            ? { sub: { text: opened.join(' · '), tone: 'secondary' } }
            : {}),
      };
    }
    case 'sent':
      return {
        tone: 'passed',
        facts: [
          t('workbench.editors.live.run.row.sent'),
          ...(settlement.ackMs !== undefined
            ? [t('workbench.editors.live.run.row.acknowledgedIn', { duration: formatDurationRolled(settlement.ackMs) })]
            : []),
          ...captures(settlement.captureNames),
        ],
      };
    case 'matched':
      return {
        tone: 'passed',
        facts: [
          t('workbench.editors.live.run.row.matchedAfter', { duration: formatDurationRolled(settlement.afterMs) }),
          ...captures(settlement.captureNames),
        ],
      };
    case 'passed':
      return {
        tone: 'passed',
        facts: [
          String(settlement.status),
          ...(settlement.durationMs !== undefined ? [formatDurationRolled(settlement.durationMs)] : []),
          ...captures(settlement.captureNames),
          ...(settlement.attempts > 1
            ? [
                t('workbench.editors.live.run.row.passedOnAttempt', {
                  attempt: settlement.attempts,
                  max: settlement.maxAttempts,
                }),
              ]
            : []),
        ],
      };
    case 'failed': {
      const facts = [
        ...(settlement.status !== undefined ? [String(settlement.status)] : []),
        ...(settlement.durationMs !== undefined ? [formatDurationRolled(settlement.durationMs)] : []),
      ];
      return {
        tone: 'failed',
        facts: facts.length > 0 ? facts : [t('workbench.editors.live.run.row.failed')],
        sub: { text: settlement.reason, tone: 'danger' },
      };
    }
    case 'skipped':
      return {
        tone: 'skipped',
        facts: [t('workbench.editors.live.run.row.skipped')],
        sub: { text: t('workbench.editors.live.run.row.skippedReason'), tone: 'secondary' },
      };
    case 'not-run':
      return { tone: 'not-run', facts: [t('workbench.editors.live.run.row.notRun')] };
    case 'cannot-run':
      return {
        tone: 'cannot-run',
        facts: [t('workbench.editors.live.run.row.cannotRun')],
        sub: { text: settlement.reason, tone: 'warning' },
      };
  }
}

/** How a session opened, in the order a person reads it: who it is, what it started from, what it was granted. */
function describeOpenFacts(facts: SessionOpenFacts, t: Translate): string[] {
  return [
    ...(facts.identityGenerated === undefined
      ? []
      : [
          t(
            facts.identityGenerated
              ? 'workbench.editors.live.run.row.identityGenerated'
              : 'workbench.editors.live.run.row.identityOwn',
          ),
        ]),
    ...(facts.resumed === true
      ? [t('workbench.editors.live.run.row.resumed')]
      : facts.cleanStart === true
        ? [t('workbench.editors.live.run.row.cleanStart')]
        : []),
    ...(facts.granted !== undefined && facts.granted > 0
      ? [t('workbench.editors.live.run.row.granted', { count: facts.granted })]
      : []),
  ];
}

export function describeRunVerdict(verdict: WorkflowRunVerdict, t: Translate): string {
  switch (verdict) {
    case 'running':
      return t('workbench.editors.live.run.verdict.running');
    case 'passed':
      return t('workbench.editors.live.run.verdict.passed');
    case 'failed':
      return t('workbench.editors.live.run.verdict.failed');
    case 'cannot-run':
      return t('workbench.editors.live.run.verdict.cannotRun');
  }
}

/** The step a view opens on when none was picked: where the run stopped, else nothing. */
export function defaultRunSelection(rows: readonly WorkflowRunStepRow[]): string | null {
  const stopped = rows.find(
    (row) => row.state === 'settled' && (row.settlement.state === 'failed' || row.settlement.state === 'cannot-run'),
  );
  return stopped?.id ?? null;
}
