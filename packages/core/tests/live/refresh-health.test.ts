import { describe, expect, it } from 'vitest';
import type { ChainRunFailure } from '../../src/live/chain-runner';
import { classifyRefreshHealth } from '../../src/live/refresh-health';

/** Minimal ChainRunFailure; override `failedStepId`/phase/statuses per case. */
function failure(overrides: Partial<ChainRunFailure> = {}): ChainRunFailure {
  return {
    ok: false,
    failedStepId: 'fetch-data',
    failedPhase: 'extract',
    failedReason: 'boom',
    partialStepCaptures: new Map(),
    partialStepResponseBytes: new Map(),
    partialStepStatuses: new Map(),
    skippedStepIds: [],
    ...overrides,
  };
}

describe('classifyRefreshHealth (WS-C C7)', () => {
  it('maps a 401 on the failed step to auth-failing — regardless of credential membership', () => {
    const outcome = failure({ failedStepId: 'fetch-data', partialStepStatuses: new Map([['fetch-data', 401]]) });
    expect(classifyRefreshHealth(outcome, new Set())).toBe('auth-failing');
  });

  it('maps a 403 to auth-failing', () => {
    const outcome = failure({ partialStepStatuses: new Map([['fetch-data', 403]]) });
    expect(classifyRefreshHealth(outcome, new Set())).toBe('auth-failing');
  });

  it('maps a non-auth status (e.g. 500) on a non-credential step to source-failing', () => {
    const outcome = failure({ partialStepStatuses: new Map([['fetch-data', 500]]) });
    expect(classifyRefreshHealth(outcome, new Set())).toBe('source-failing');
  });

  it('falls back to credential-step membership when no auth status is present', () => {
    // Fetch-phase failure: the credential/mint step was unreachable, so no
    // status was recorded — membership carries the auth signal.
    const outcome = failure({ failedStepId: 'mint-token', failedPhase: 'fetch', partialStepStatuses: new Map() });
    expect(classifyRefreshHealth(outcome, new Set(['mint-token']))).toBe('auth-failing');
  });

  it('classifies a non-credential fetch failure (no status) as source-failing', () => {
    const outcome = failure({ failedStepId: 'fetch-data', failedPhase: 'fetch', partialStepStatuses: new Map() });
    expect(classifyRefreshHealth(outcome, new Set(['mint-token']))).toBe('source-failing');
  });

  it('prefers the auth status over membership (status-first)', () => {
    // A 200-status extract failure on a credential step is still auth-failing
    // via membership; but a 401 anywhere wins immediately.
    const outcome = failure({ failedStepId: 'fetch-data', partialStepStatuses: new Map([['fetch-data', 401]]) });
    expect(classifyRefreshHealth(outcome, new Set(['mint-token']))).toBe('auth-failing');
  });
});
