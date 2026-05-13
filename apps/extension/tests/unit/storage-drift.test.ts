import * as v from 'valibot';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { setOracleHostHooks } from '@openheaders/oracle/sync';
import { driftRecorder } from '@openheaders/oracle/sync/storage-drift';
import { __resetStatusForTests, getStatusSnapshot, report as reportStatus } from '@/shared/status';

const recordLogMock = vi.fn();

const SampleSchema = v.object({
  name: v.string(),
});

function runRecorder(recorder: ReturnType<typeof driftRecorder>, raw: unknown): void {
  const result = v.safeParse(SampleSchema, raw);
  if (result.success) return;
  recorder(raw, result.issues);
}

describe('storage-drift / driftRecorder', () => {
  beforeEach(() => {
    recordLogMock.mockClear();
    __resetStatusForTests();
    setOracleHostHooks({
      recordLog: recordLogMock,
      reportStatus: (entry) =>
        reportStatus({
          subsystem: entry.subsystem as Parameters<typeof reportStatus>[0]['subsystem'],
          state: entry.state,
          message: entry.message,
          context: entry.context,
        }),
    });
  });

  afterEach(() => {
    __resetStatusForTests();
    setOracleHostHooks({});
  });

  it('records an observability entry on schema failure', () => {
    const recorder = driftRecorder({ subsystem: 'rule-engine', storageKey: 'oh.ws.abc.rules' });
    runRecorder(recorder, { name: 42 });
    expect(recordLogMock).toHaveBeenCalledTimes(1);
    const call = recordLogMock.mock.calls[0][0];
    expect(call.subsystem).toBe('rule-engine');
    expect(call.op).toBe('hydrate-drift');
    expect(call.level).toBe('warn');
    expect(call.message).toMatch(/oh\.ws\.abc\.rules/);
  });

  it('does NOT raw-log the dropped value (may contain secrets)', () => {
    const recorder = driftRecorder({
      subsystem: 'vault',
      statusSubsystem: 'secrets',
      storageKey: 'oh.ws.abc.vault',
    });
    runRecorder(recorder, { name: 42, secretValue: 'leak-me' });
    const call = recordLogMock.mock.calls[0][0];
    expect(JSON.stringify(call)).not.toContain('leak-me');
  });

  it('does NOT report Status when statusSubsystem is absent', () => {
    const recorder = driftRecorder({ subsystem: 'rule-engine', storageKey: 'oh.ws.abc.rules' });
    runRecorder(recorder, { name: 42 });
    expect(getStatusSnapshot().rules).toBeUndefined();
  });

  it('reports yellow Status when statusSubsystem is set', () => {
    const recorder = driftRecorder({
      subsystem: 'rule-engine',
      statusSubsystem: 'rules',
      storageKey: 'oh.ws.abc.rules',
    });
    runRecorder(recorder, { name: 42 });
    const entry = getStatusSnapshot().rules;
    expect(entry?.state).toBe('yellow');
    expect(entry?.message).toBe('Schema drift: dropped entry from oh.ws.abc.rules');
    expect(entry?.context?.storageKey).toBe('oh.ws.abc.rules');
  });

  it('routes vault drift to the secrets Status subsystem', () => {
    const recorder = driftRecorder({
      subsystem: 'vault',
      statusSubsystem: 'secrets',
      storageKey: 'oh.ws.abc.vault',
    });
    runRecorder(recorder, { name: 42 });
    const snap = getStatusSnapshot();
    expect(snap.secrets?.state).toBe('yellow');
    expect(snap.secrets?.message).toBe('Schema drift: dropped entry from oh.ws.abc.vault');
  });
});
