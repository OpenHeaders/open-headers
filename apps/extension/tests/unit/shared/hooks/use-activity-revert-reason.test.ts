/**
 * Phase C F8 — `humanizeRevertReason`.
 *
 * Tiny pure mapping from oracle/RPC reason codes to user-facing toast
 * copy. Pins that every wire reason has a sentence-cased explanation
 * and that unknown codes fall through to the raw string (so a future
 * reason code never surfaces as "Revert failed: undefined").
 */

import { humanizeRevertReason } from '@openheaders/ui/shared/hooks/activity/useActivityRevert';
import { describe, expect, it } from 'vitest';

describe('humanizeRevertReason', () => {
  it.each([
    ['delete-irreversible'],
    ['already-tombstoned'],
    ['set-item-missing'],
    ['no-op'],
    ['no-inverse-recorded'],
    ['no-oracle-for-workspace'],
    ['no-workspace'],
    ['malformed-payload'],
  ])('returns a human sentence for known reason %s', (code) => {
    const message = humanizeRevertReason(code);
    expect(message).not.toBe(code);
    expect(message.length).toBeGreaterThan(0);
    expect(message).toMatch(/\.$/);
  });

  it('falls through to the raw reason for unknown codes', () => {
    expect(humanizeRevertReason('some-future-error')).toBe('some-future-error');
  });
});
