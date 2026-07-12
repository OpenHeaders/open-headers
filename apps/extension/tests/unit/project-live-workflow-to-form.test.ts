import type { LiveWorkflow } from '@openheaders/core/types';
import { projectLiveWorkflowToForm } from '@openheaders/ui/workbench/components/live/use-live-workflow-conflicts';
import { describe, expect, it } from 'vitest';

const STEP_UID = 's0000001';
const CAP_UID = 'c0000001';

const refreshManual: LiveWorkflow['refresh'] = { kind: 'manual' };

describe('projectLiveWorkflowToForm', () => {
  it('emits scalar workflow leaves + refresh discriminator only when steps absent', () => {
    const out = projectLiveWorkflowToForm({
      name: 'Login',
      description: 'desc',
      enabled: true,
      refresh: refreshManual,
    });
    expect(out).toEqual({
      name: 'Login',
      description: 'desc',
      enabled: 'true',
      'refresh.kind': 'manual',
    });
  });

  it('emits per-step + per-capture leaves when steps are passed', () => {
    const out = projectLiveWorkflowToForm({
      name: 'Login',
      description: 'desc',
      enabled: true,
      refresh: refreshManual,
      steps: [
        {
          uid: STEP_UID,
          id: 'login',
          requestUid: 'req-aaaa',
          captures: [{ uid: CAP_UID, name: 'token', extractor: { kind: 'whole-body' } }],
        },
      ],
    });
    expect(out[`steps.${STEP_UID}.id`]).toBe('login');
    expect(out[`steps.${STEP_UID}.requestUid`]).toBe('req-aaaa');
    expect(out[`steps.${STEP_UID}.dependsOn`]).toBe('[]');
    expect(out[`steps.${STEP_UID}.runIf`]).toBe('');
    expect(out[`steps.${STEP_UID}.priorityFrom`]).toBe('');
    expect(out[`steps.${STEP_UID}.retry`]).toBe('');
    expect(out[`steps.${STEP_UID}.timeoutMs`]).toBe('');
    expect(out[`steps.${STEP_UID}.captures.${CAP_UID}.name`]).toBe('token');
    expect(out[`steps.${STEP_UID}.captures.${CAP_UID}.extractor`]).toBe('{"kind":"whole-body"}');
  });

  it('encodes opaque leaves canonically — key order never distinguishes equal values', () => {
    // chrome.storage alphabetizes object keys on round-trip while the
    // form builds retry / gate / priority objects in edit-insertion
    // order; the leaf encoding must erase that difference or the
    // tracker reads every saved edit as an external conflict.
    const step = {
      uid: STEP_UID,
      id: 'login',
      requestUid: 'req-aaaa',
      captures: [],
      retry: { maxAttempts: 4, delayMs: 2000, backoff: 'exponential' as const, retryOn: ['eq', 429] as ['eq', number] },
      timeoutMs: 1500,
      priorityFrom: { stepId: 'a', captureName: 'token' },
    };
    const sortedStep = {
      uid: STEP_UID,
      id: 'login',
      requestUid: 'req-aaaa',
      captures: [],
      retry: { backoff: 'exponential' as const, delayMs: 2000, maxAttempts: 4, retryOn: ['eq', 429] as ['eq', number] },
      timeoutMs: 1500,
      priorityFrom: { captureName: 'token', stepId: 'a' },
    };
    const base = { name: 'X', description: '', enabled: true, refresh: refreshManual };
    const a = projectLiveWorkflowToForm({ ...base, steps: [step] });
    const b = projectLiveWorkflowToForm({ ...base, steps: [sortedStep] });
    expect(a[`steps.${STEP_UID}.retry`]).toBe(b[`steps.${STEP_UID}.retry`]);
    expect(a[`steps.${STEP_UID}.priorityFrom`]).toBe(b[`steps.${STEP_UID}.priorityFrom`]);
    expect(a[`steps.${STEP_UID}.timeoutMs`]).toBe('1500');
  });

  it('mirrors the adapter baseline shape so per-leaf conflict detection works symmetrically', () => {
    // Independence check: this projection's per-step leaf names + the
    // adapter's extractBaseline path keys must not drift apart, or the
    // tracker silently falls back to baseline for the local value
    // (peer-only step changes never auto-rebase, edit-vs-edit
    // conflicts stay invisible). Asserting key parity here is a
    // regression guard against that drift.
    const out = projectLiveWorkflowToForm({
      name: 'X',
      description: '',
      enabled: false,
      refresh: refreshManual,
      steps: [
        {
          uid: STEP_UID,
          id: 'login',
          requestUid: 'req-aaaa',
          captures: [{ uid: CAP_UID, name: 'token', extractor: { kind: 'whole-body' } }],
        },
      ],
    });
    const keys = Object.keys(out)
      .filter((k) => k.startsWith('steps.'))
      .sort();
    expect(keys).toEqual([
      `steps.${STEP_UID}.captures.${CAP_UID}.extractor`,
      `steps.${STEP_UID}.captures.${CAP_UID}.name`,
      `steps.${STEP_UID}.dependsOn`,
      `steps.${STEP_UID}.description`,
      `steps.${STEP_UID}.id`,
      `steps.${STEP_UID}.priorityFrom`,
      `steps.${STEP_UID}.requestUid`,
      `steps.${STEP_UID}.retry`,
      `steps.${STEP_UID}.runIf`,
      `steps.${STEP_UID}.timeoutMs`,
    ]);
  });
});
