/**
 * Semantic commit-message composition (the git-sync plan §23.4) — batch
 * intents fold to a one-line draft; per-entity strongest verb wins;
 * empty intents fall back to the generic message.
 */

import { describe, expect, it } from 'vitest';
import { composeCommitMessage } from '../../src/git/commit-message';

describe('composeCommitMessage', () => {
  it('falls back when no intents were recorded', () => {
    expect(composeCommitMessage([])).toBe('Update workspace');
  });

  it('collapses repeated field edits on one entity into a single update', () => {
    const message = composeCommitMessage([
      { kind: 'setField', entityType: 'rule', entityId: 'r1' },
      { kind: 'setField', entityType: 'rule', entityId: 'r1' },
      { kind: 'addToSet', entityType: 'rule', entityId: 'r1' },
    ]);
    expect(message).toBe('Update rule');
  });

  it('create beats update and delete beats create for the same entity', () => {
    expect(
      composeCommitMessage([
        { kind: 'setField', entityType: 'request', entityId: 'q1' },
        { kind: 'create', entityType: 'request', entityId: 'q1' },
      ]),
    ).toBe('Add request');
    expect(
      composeCommitMessage([
        { kind: 'create', entityType: 'request', entityId: 'q1' },
        { kind: 'delete', entityType: 'request', entityId: 'q1' },
      ]),
    ).toBe('Delete request');
  });

  it('groups families with counts and humanizes entity types', () => {
    const message = composeCommitMessage([
      { kind: 'create', entityType: 'request', entityId: 'q1' },
      { kind: 'setField', entityType: 'rule', entityId: 'r1' },
      { kind: 'setField', entityType: 'rule', entityId: 'r2' },
      { kind: 'setField', entityType: 'grpc-request', entityId: 'g1' },
      { kind: 'delete', entityType: 'environment', entityId: 'e1' },
    ]);
    expect(message).toBe('Add request, update gRPC request, update 2 rules, delete environment');
  });
});
