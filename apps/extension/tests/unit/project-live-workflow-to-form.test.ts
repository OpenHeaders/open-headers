import type { V5 } from '@openheaders/core/types';
import { describe, expect, it } from 'vitest';
import { projectLiveWorkflowToForm } from '@/workbench/components/live/use-live-workflow-conflicts';

const STEP_UID = 's0000001';
const CAP_UID = 'c0000001';

const refreshManual: V5.LiveWorkflow['refresh'] = { kind: 'manual' };

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
    expect(out[`steps.${STEP_UID}.captures.${CAP_UID}.name`]).toBe('token');
    expect(out[`steps.${STEP_UID}.captures.${CAP_UID}.extractor`]).toBe('{"kind":"whole-body"}');
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
    const keys = Object.keys(out).filter((k) => k.startsWith('steps.')).sort();
    expect(keys).toEqual([
      `steps.${STEP_UID}.captures.${CAP_UID}.extractor`,
      `steps.${STEP_UID}.captures.${CAP_UID}.name`,
      `steps.${STEP_UID}.dependsOn`,
      `steps.${STEP_UID}.description`,
      `steps.${STEP_UID}.id`,
      `steps.${STEP_UID}.priorityFrom`,
      `steps.${STEP_UID}.requestUid`,
      `steps.${STEP_UID}.runIf`,
    ]);
  });
});
