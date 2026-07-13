import * as v from 'valibot';
import { describe, expect, it } from 'vitest';
import {
  MAX_RETRY_ATTEMPTS,
  MAX_RETRY_DELAY_MS,
  MAX_STEP_TIMEOUT_MS,
  MIN_RETRY_ATTEMPTS,
  MIN_STEP_TIMEOUT_MS,
  StepRetryPolicySchema,
  StepTimeoutMsSchema,
  WorkflowStepSchema,
} from '../../src/schemas/live';

function baseStep(overrides: Record<string, unknown> = {}) {
  return {
    uid: 'stpaaaa1',
    id: 'step1',
    requestUid: 'reqaaaa1',
    captures: [],
    ...overrides,
  };
}

describe('StepRetryPolicySchema', () => {
  it('accepts the minimal policy (attempts only)', () => {
    expect(() => v.parse(StepRetryPolicySchema, { maxAttempts: 3 })).not.toThrow();
  });

  it('accepts the full policy with class + tuple retryOn forms', () => {
    expect(() =>
      v.parse(StepRetryPolicySchema, { maxAttempts: 5, delayMs: 250, backoff: 'exponential', retryOn: '5xx' }),
    ).not.toThrow();
    expect(() => v.parse(StepRetryPolicySchema, { maxAttempts: 2, retryOn: ['eq', 429] })).not.toThrow();
  });

  it('rejects attempts outside the bounds', () => {
    expect(() => v.parse(StepRetryPolicySchema, { maxAttempts: MIN_RETRY_ATTEMPTS - 1 })).toThrow();
    expect(() => v.parse(StepRetryPolicySchema, { maxAttempts: MAX_RETRY_ATTEMPTS + 1 })).toThrow();
    expect(() => v.parse(StepRetryPolicySchema, { maxAttempts: 2.5 })).toThrow();
  });

  it('rejects delay outside the bounds and unknown backoff', () => {
    expect(() => v.parse(StepRetryPolicySchema, { maxAttempts: 3, delayMs: -1 })).toThrow();
    expect(() => v.parse(StepRetryPolicySchema, { maxAttempts: 3, delayMs: MAX_RETRY_DELAY_MS + 1 })).toThrow();
    expect(() => v.parse(StepRetryPolicySchema, { maxAttempts: 3, backoff: 'linear' })).toThrow();
  });
});

describe('StepTimeoutMsSchema', () => {
  it('accepts the bounds inclusively', () => {
    expect(() => v.parse(StepTimeoutMsSchema, MIN_STEP_TIMEOUT_MS)).not.toThrow();
    expect(() => v.parse(StepTimeoutMsSchema, MAX_STEP_TIMEOUT_MS)).not.toThrow();
  });

  it('rejects out-of-bounds and non-integer values', () => {
    expect(() => v.parse(StepTimeoutMsSchema, MIN_STEP_TIMEOUT_MS - 1)).toThrow();
    expect(() => v.parse(StepTimeoutMsSchema, MAX_STEP_TIMEOUT_MS + 1)).toThrow();
    expect(() => v.parse(StepTimeoutMsSchema, 1000.5)).toThrow();
  });
});

describe('WorkflowStepSchema — runScripts', () => {
  it('stays absent when not set', () => {
    const parsed = v.parse(WorkflowStepSchema, baseStep());
    expect('runScripts' in parsed && parsed.runScripts !== undefined).toBe(false);
  });

  it('round-trips both boolean values', () => {
    expect(v.parse(WorkflowStepSchema, baseStep({ runScripts: true })).runScripts).toBe(true);
    expect(v.parse(WorkflowStepSchema, baseStep({ runScripts: false })).runScripts).toBe(false);
  });

  it('rejects non-boolean values', () => {
    expect(() => v.parse(WorkflowStepSchema, baseStep({ runScripts: 'yes' }))).toThrow();
  });
});

describe('WorkflowStepSchema — retry + timeoutMs', () => {
  it('round-trips a step without either field (both stay absent)', () => {
    const parsed = v.parse(WorkflowStepSchema, baseStep());
    expect(parsed.retry).toBeUndefined();
    expect(parsed.timeoutMs).toBeUndefined();
  });

  it('round-trips a step carrying both fields', () => {
    const parsed = v.parse(
      WorkflowStepSchema,
      baseStep({ retry: { maxAttempts: 3, delayMs: 500, backoff: 'fixed', retryOn: '5xx' }, timeoutMs: 10_000 }),
    );
    expect(parsed.retry).toEqual({ maxAttempts: 3, delayMs: 500, backoff: 'fixed', retryOn: '5xx' });
    expect(parsed.timeoutMs).toBe(10_000);
  });

  it('rejects a step with an out-of-bounds timeout', () => {
    expect(() => v.parse(WorkflowStepSchema, baseStep({ timeoutMs: 50 }))).toThrow();
  });
});
