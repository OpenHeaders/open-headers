/**
 * The gates' shared wording and rule — one line per reference with its
 * hint, the batch refusing only on a secret manager's typed failure,
 * every other miss riding as the snapshot's `sentAsWritten` notes.
 */

import { buildPostResolveError, type ResolutionError, type ResolutionErrorReason } from '@openheaders/core/variables';
import { describe, expect, it } from 'vitest';
import {
  batchRefusesSend,
  sentAsWrittenOf,
  UNRESOLVED_MESSAGE_LEAD,
  unresolvedReferenceLines,
  unresolvedReferencesMessage,
} from '../../../src/live/request-exec/unresolved-references';

const error = (reference: string, reason: ResolutionErrorReason): ResolutionError =>
  buildPostResolveError(reference, reason, undefined);

const MISS_HINT = 'Not found in vault, environment, collection, or workspace. Define it in one of those scopes.';

describe('unresolvedReferenceLines', () => {
  it('writes one line per reference with its hint, in order', () => {
    expect(unresolvedReferenceLines([error('waat', 'unresolved'), error('vault.token', 'secret-not-found')])).toEqual([
      `{{waat}}: ${MISS_HINT}`,
      '{{vault.token}}: The secret manager could not find a secret at this reference. Check the reference fields in the Vault entry.',
    ]);
  });

  it('names a secret-manager entry a copy path kept unresolved for what it is, never as a miss', () => {
    expect(unresolvedReferenceLines([error('vault.opToken', 'unset-in-scope')], new Set(['opToken']))).toEqual([
      "{{vault.opToken}}: a secret manager's value is resolved only when sending and never enters a copied command.",
    ]);
  });

  it('composes the lead and every collected line', () => {
    const unresolved = new Map<string, ResolutionError>([['nope', error('nope', 'unresolved')]]);
    expect(unresolvedReferencesMessage(UNRESOLVED_MESSAGE_LEAD, unresolved)).toBe(
      `Message has unresolved variables. {{nope}}: ${MISS_HINT}`,
    );
  });
});

describe('batchRefusesSend', () => {
  it('a batch of plain misses never refuses', () => {
    expect(batchRefusesSend([error('a', 'unresolved'), error('env.B', 'unset-in-scope')])).toBe(false);
    expect(batchRefusesSend([])).toBe(false);
  });

  it("one secret manager's typed failure refuses the whole batch", () => {
    expect(batchRefusesSend([error('a', 'unresolved'), error('vault.t', 'secret-authorization-required')])).toBe(true);
  });

  it('reads a collector map by its values', () => {
    const unresolved = new Map<string, ResolutionError>([['vault.t', error('vault.t', 'secret-unavailable')]]);
    expect(batchRefusesSend(unresolved.values())).toBe(true);
  });
});

describe('sentAsWrittenOf', () => {
  it("keeps the reference and the resolver's hint — the snapshot's attribution shape", () => {
    expect(sentAsWrittenOf([error('waat', 'unresolved'), error('env.HOST', 'unset-in-scope')])).toEqual([
      { reference: 'waat', hint: MISS_HINT },
      {
        reference: 'env.HOST',
        hint: 'No active environment is selected. Select one in Environments, or set a default environment.',
      },
    ]);
  });
});
