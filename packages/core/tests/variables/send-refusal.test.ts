/**
 * `refusesSend` — the one rule every send gate applies by reason: a
 * secret manager's typed failure refuses the send, every other miss
 * rides as written.
 */

import { buildPostResolveError, type ResolutionErrorReason, refusesSend } from '@openheaders/core/variables';
import { describe, expect, it } from 'vitest';

const error = (reference: string, reason: ResolutionErrorReason) => buildPostResolveError(reference, reason, undefined);

describe('refusesSend', () => {
  it("a secret manager's typed failure refuses the send, whatever the fix", () => {
    expect(refusesSend(error('vault.token', 'secret-authorization-required'))).toBe(true);
    expect(refusesSend(error('vault.token', 'secret-not-found'))).toBe(true);
    expect(refusesSend(error('vault.token', 'secret-unavailable'))).toBe(true);
    expect(refusesSend(error('vault.token', 'secret-broker-unreachable'))).toBe(true);
  });

  it('a plain miss rides as written — nowhere in the chain, an unset scope, a bad namespace, an empty reference, a step outside a run', () => {
    expect(refusesSend(error('waat', 'unresolved'))).toBe(false);
    expect(refusesSend(error('env.HOST', 'unset-in-scope'))).toBe(false);
    expect(refusesSend(error('vault.plain', 'unset-in-scope'))).toBe(false);
    expect(refusesSend(error('foo.X', 'unknown-namespace'))).toBe(false);
    expect(refusesSend(error('', 'empty'))).toBe(false);
    expect(refusesSend(error('step.s1.token', 'step-out-of-context'))).toBe(false);
    expect(refusesSend(error('env.HOST', 'invalid-resolved-value'))).toBe(false);
  });
});
