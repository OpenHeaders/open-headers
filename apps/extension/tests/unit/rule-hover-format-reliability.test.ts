/**
 * `isSnapshotResolutionReliable` — when a fire snapshot's resolved
 * header value is a drift baseline, and when it is not: a literal, a
 * template the compile resolved, a template it could not, and a
 * secret-manager value the worker scrubbed before the fire left it.
 */

import { SECRET_VALUE_PLACEHOLDER } from '@openheaders/core/request-lifecycle';
import type { RuleSnapshotHeaderMod } from '@openheaders/core/types';
import { isSnapshotResolutionReliable } from '@openheaders/ui/panel/components/rule-hover-format';
import { describe, expect, it } from 'vitest';

function mod(overrides: Partial<RuleSnapshotHeaderMod>): RuleSnapshotHeaderMod {
  return { direction: 'request', operation: 'override', headerName: 'Authorization', ...overrides };
}

describe('isSnapshotResolutionReliable', () => {
  it('a literal value and a resolved template are baselines', () => {
    expect(isSnapshotResolutionReliable(mod({ valueTemplate: 'Bearer abc', valueResolved: 'Bearer abc' }))).toBe(true);
    expect(isSnapshotResolutionReliable(mod({ valueTemplate: 'Bearer {{env.T}}', valueResolved: 'Bearer abc' }))).toBe(
      true,
    );
  });

  it('a template the compile could not resolve is not', () => {
    expect(
      isSnapshotResolutionReliable(mod({ valueTemplate: 'Bearer {{env.T}}', valueResolved: 'Bearer {{env.T}}' })),
    ).toBe(false);
  });

  it('a scrubbed secret-manager value is not — this surface holds nothing to compare it against', () => {
    expect(
      isSnapshotResolutionReliable(
        mod({ valueTemplate: 'Bearer {{vault.ApiToken}}', valueResolved: `Bearer ${SECRET_VALUE_PLACEHOLDER}` }),
      ),
    ).toBe(false);
  });
});
