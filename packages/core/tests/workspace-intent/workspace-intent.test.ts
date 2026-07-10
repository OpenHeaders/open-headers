/**
 * `WorkspaceIntent` schema + codec coverage.
 *
 * Two axes:
 *   1. Schema accept/reject for every kind — catches payload drift.
 *   2. Round-trip `intentToHash` → `hashToIntent` for every kind —
 *      catches codec drift.
 *
 * Legacy-parity tests live in the companion `legacy-hash-parity.test.ts`
 * so this file stays focused on the contract itself.
 */

import * as v from 'valibot';
import { describe, expect, it } from 'vitest';
import {
  boundIntentToHash,
  hashToBoundIntent,
  hashToIntent,
  intentToHash,
  parseIntent,
  WORKSPACE_INTENT_KINDS,
  type WorkspaceIntent,
  WorkspaceIntentSchema,
} from '../../src/workspace-intent';

const UID_A = 'abcd1234';
const UID_B = 'ef567890';

// ── Schema acceptance — one case per kind ──────────────────────────

describe('WorkspaceIntentSchema — accepts every kind', () => {
  const cases: Array<[string, WorkspaceIntent]> = [
    ['open-workspace', { kind: 'open-workspace' }],
    ['open-docs', { kind: 'open-docs', section: 'doc-system-status' }],
    ['open-notifications', { kind: 'open-notifications' }],
    ['edit-rule', { kind: 'edit-rule', uid: UID_A }],
    ['create-rule (no template/draft)', { kind: 'create-rule', ruleType: 'header' }],
    ['create-rule (template)', { kind: 'create-rule', ruleType: 'response', templateKey: 'my-tpl' }],
    ['create-rule (draft)', { kind: 'create-rule', ruleType: 'inject', draftNonce: 'xyz-123' }],
    [
      'create-rule (context)',
      {
        kind: 'create-rule',
        ruleType: 'redirect',
        context: { collectionId: UID_B, folderPath: 'auth/login' },
      },
    ],
    ['edit-environment', { kind: 'edit-environment', uid: UID_A }],
    ['open-collection-vars', { kind: 'open-collection-vars', uid: UID_A }],
    ['open-request-collection-vars', { kind: 'open-request-collection-vars', uid: UID_A }],
    ['open-template-collection-vars', { kind: 'open-template-collection-vars', uid: UID_A }],
    ['open-request-editor', { kind: 'open-request-editor', uid: UID_A }],
    ['open-settings (bare)', { kind: 'open-settings' }],
    ['open-settings (key)', { kind: 'open-settings', target: { settingKey: 'theme' } }],
    ['open-settings (category)', { kind: 'open-settings', target: { categoryId: 'data' } }],
    ['open-workspace-manager', { kind: 'open-workspace-manager' }],
    ['open-workspace-vars', { kind: 'open-workspace-vars' }],
    ['open-vault', { kind: 'open-vault' }],
    ['open-live-variables', { kind: 'open-live-variables' }],
    ['open-export-modal', { kind: 'open-export-modal' }],
    ['open-import-modal', { kind: 'open-import-modal' }],
    ['create-api-request (bare)', { kind: 'create-api-request' }],
    ['create-api-request (draft)', { kind: 'create-api-request', draftNonce: 'xyz-123' }],
  ];

  it.each(cases)('accepts %s', (_label, intent) => {
    expect(() => v.parse(WorkspaceIntentSchema, intent)).not.toThrow();
  });
});

// ── Schema rejection — schema is the spec at the boundary ──────────

describe('WorkspaceIntentSchema — rejects malformed payloads', () => {
  it('rejects unknown kind', () => {
    expect(v.safeParse(WorkspaceIntentSchema, { kind: 'not-a-real-kind' }).success).toBe(false);
  });

  it('rejects edit-rule with a non-8-char uid', () => {
    expect(v.safeParse(WorkspaceIntentSchema, { kind: 'edit-rule', uid: 'short' }).success).toBe(false);
  });

  it('rejects edit-rule with uppercase uid chars', () => {
    expect(v.safeParse(WorkspaceIntentSchema, { kind: 'edit-rule', uid: 'ABCD1234' }).success).toBe(false);
  });

  it('rejects open-docs with empty section', () => {
    expect(v.safeParse(WorkspaceIntentSchema, { kind: 'open-docs', section: '' }).success).toBe(false);
  });

  it('rejects open-docs with uppercase section', () => {
    expect(v.safeParse(WorkspaceIntentSchema, { kind: 'open-docs', section: 'Docs-Section' }).success).toBe(false);
  });

  it('rejects open-docs with leading hyphen', () => {
    expect(v.safeParse(WorkspaceIntentSchema, { kind: 'open-docs', section: '-bad' }).success).toBe(false);
  });

  it('rejects create-rule with unknown ruleType', () => {
    expect(v.safeParse(WorkspaceIntentSchema, { kind: 'create-rule', ruleType: 'webrequest' }).success).toBe(false);
  });

  it('rejects missing kind', () => {
    expect(v.safeParse(WorkspaceIntentSchema, { section: 'doc-system-status' }).success).toBe(false);
  });
});

// ── Kinds registry — catch silent drift ────────────────────────────

describe('WORKSPACE_INTENT_KINDS', () => {
  it('stays in lockstep with the schema variants', () => {
    // Each kind must round-trip through the schema with its minimal
    // payload — guarantees the picklist isn't lying about what the
    // schema actually supports.
    const minimal: Record<string, WorkspaceIntent> = {
      'open-workspace': { kind: 'open-workspace' },
      'open-docs': { kind: 'open-docs', section: 'x' },
      'open-notifications': { kind: 'open-notifications' },
      'edit-rule': { kind: 'edit-rule', uid: UID_A },
      'create-rule': { kind: 'create-rule', ruleType: 'header' },
      'edit-environment': { kind: 'edit-environment', uid: UID_A },
      'create-environment': { kind: 'create-environment' },
      'open-collection-vars': { kind: 'open-collection-vars', uid: UID_A },
      'open-request-collection-vars': { kind: 'open-request-collection-vars', uid: UID_A },
      'open-template-collection-vars': { kind: 'open-template-collection-vars', uid: UID_A },
      'open-request-editor': { kind: 'open-request-editor', uid: UID_A },
      'open-settings': { kind: 'open-settings' },
      'open-workspace-manager': { kind: 'open-workspace-manager' },
      'open-workspace-vars': { kind: 'open-workspace-vars' },
      'open-vault': { kind: 'open-vault' },
      'open-live-variables': { kind: 'open-live-variables' },
      'edit-live-variable': { kind: 'edit-live-variable', uid: UID_A },
      'edit-live-workflow': { kind: 'edit-live-workflow', uid: UID_A },
      'create-live-variable': { kind: 'create-live-variable' },
      'open-export-modal': { kind: 'open-export-modal' },
      'open-import-modal': { kind: 'open-import-modal' },
      'create-api-request': { kind: 'create-api-request' },
    };
    for (const kind of WORKSPACE_INTENT_KINDS) {
      expect(minimal[kind], `missing minimal-case fixture for kind ${kind}`).toBeDefined();
      expect(() => v.parse(WorkspaceIntentSchema, minimal[kind])).not.toThrow();
    }
    // Reverse: no minimal fixture refers to a kind outside the picklist.
    for (const kind of Object.keys(minimal)) {
      expect(WORKSPACE_INTENT_KINDS, `picklist missing ${kind}`).toContain(
        kind as (typeof WORKSPACE_INTENT_KINDS)[number],
      );
    }
  });
});

// ── Codec round-trip — every kind + representative edge cases ──────

describe('intentToHash / hashToIntent — round-trip', () => {
  const roundTripCases: WorkspaceIntent[] = [
    { kind: 'open-workspace' },
    { kind: 'open-docs', section: 'doc-system-status' },
    { kind: 'open-docs', section: 'keyboard-shortcuts' },
    { kind: 'open-notifications' },
    { kind: 'edit-rule', uid: UID_A },
    { kind: 'create-rule', ruleType: 'header' },
    { kind: 'create-rule', ruleType: 'response', templateKey: 'template-abc' },
    { kind: 'create-rule', ruleType: 'inject', draftNonce: 'nonce-xyz' },
    { kind: 'edit-environment', uid: UID_A },
    { kind: 'create-environment' },
    { kind: 'open-collection-vars', uid: UID_B },
    { kind: 'open-request-collection-vars', uid: UID_B },
    { kind: 'open-template-collection-vars', uid: UID_B },
    { kind: 'open-request-editor', uid: UID_A },
    { kind: 'open-settings' },
    { kind: 'open-settings', target: { settingKey: 'theme' } },
    { kind: 'open-settings', target: { categoryId: 'data' } },
    { kind: 'open-workspace-manager' },
    { kind: 'open-workspace-vars' },
    { kind: 'open-vault' },
    { kind: 'open-live-variables' },
    { kind: 'open-export-modal' },
    { kind: 'open-import-modal' },
    { kind: 'edit-live-variable', uid: UID_A },
    { kind: 'edit-live-workflow', uid: UID_B },
    { kind: 'create-live-variable' },
    { kind: 'create-live-variable', seedRequestUid: UID_A },
    { kind: 'create-api-request' },
    { kind: 'create-api-request', draftNonce: 'nonce-xyz' },
  ];

  it.each(roundTripCases)('round-trips %j', (intent) => {
    const hash = intentToHash(intent);
    const parsed = hashToIntent(hash);
    expect(parsed, `round-trip failed for ${JSON.stringify(intent)} → ${hash}`).toEqual(intent);
  });

  it.each(roundTripCases)('hash → intent → hash is idempotent (byte equality) for %j', (intent) => {
    // Stronger form: the serialized hash itself is stable under
    // re-encoding. Any renderer that re-emits an intent pulled from
    // the URL bar will not shift bookmarked URLs by a byte.
    const hash1 = intentToHash(intent);
    const parsed = hashToIntent(hash1);
    expect(parsed).not.toBeNull();
    if (!parsed) return;
    const hash2 = intentToHash(parsed);
    expect(hash2).toBe(hash1);
  });

  it('every WORKSPACE_INTENT_KINDS entry has at least one round-trip case', () => {
    // Keeps the table honest: adding a new intent kind to the schema
    // without a test fixture fails here instead of silently shipping.
    const covered = new Set(roundTripCases.map((i) => i.kind));
    for (const kind of WORKSPACE_INTENT_KINDS) {
      expect(covered, `missing round-trip fixture for kind: ${kind}`).toContain(kind);
    }
  });

  it('empty hash → open-workspace', () => {
    expect(hashToIntent('')).toEqual({ kind: 'open-workspace' });
    expect(hashToIntent('#')).toEqual({ kind: 'open-workspace' });
    expect(hashToIntent('#/')).toEqual({ kind: 'open-workspace' });
  });

  it('unknown route → null', () => {
    expect(hashToIntent('#/not-a-route')).toBeNull();
    expect(hashToIntent('#/docs')).toBeNull(); // missing section
    expect(hashToIntent('#/edit')).toBeNull(); // missing uid
  });

  it('schema-invalid payload → null', () => {
    expect(hashToIntent('#/edit/X'), '2-char uid').toBeNull();
    expect(hashToIntent('#/environment/TOOLONGID1'), '10-char uid').toBeNull();
  });
});

// ── URL-segment encoding — preserves special chars ─────────────────

describe('codec encoding', () => {
  it('handles a malformed percent-escape by returning null', () => {
    // `%ZZ` is not a valid escape — the segment parser catches the
    // TypeError, returns the raw segment, schema rejects it.
    expect(hashToIntent('#/docs/bad%ZZ')).toBeNull();
  });
});

// ── parseIntent (structured-data variant) ───────────────────────────

describe('parseIntent', () => {
  it('accepts a valid intent object', () => {
    expect(parseIntent({ kind: 'open-docs', section: 'x' })).toEqual({
      kind: 'open-docs',
      section: 'x',
    });
  });

  it('rejects an invalid intent', () => {
    expect(parseIntent({ kind: 'not-a-kind' })).toBeNull();
    expect(parseIntent({ kind: 'edit-rule' })).toBeNull();
    expect(parseIntent(null)).toBeNull();
    expect(parseIntent('not an object')).toBeNull();
  });
});

// ── boundIntentToHash / hashToBoundIntent — workspace-pinned hash ──

describe('boundIntentToHash / hashToBoundIntent', () => {
  const WS_ID = 'ws-abc123';

  it('encodes a bound open-workspace as #/ws/<wsId>', () => {
    expect(boundIntentToHash({ workspaceId: WS_ID, intent: { kind: 'open-workspace' } })).toBe(`#/ws/${WS_ID}`);
  });

  it('prepends /ws/<wsId>/ to a non-empty intent hash', () => {
    expect(boundIntentToHash({ workspaceId: WS_ID, intent: { kind: 'edit-rule', uid: UID_A } })).toBe(
      `#/ws/${WS_ID}/edit/${UID_A}`,
    );
  });

  it('returns the bare intent hash when workspaceId is omitted', () => {
    expect(boundIntentToHash({ intent: { kind: 'edit-rule', uid: UID_A } })).toBe(`#/edit/${UID_A}`);
    expect(boundIntentToHash({ intent: { kind: 'open-workspace' } })).toBe('');
  });

  it('round-trips with workspaceId', () => {
    const bound = { workspaceId: WS_ID, intent: { kind: 'edit-rule', uid: UID_A } as WorkspaceIntent };
    expect(hashToBoundIntent(boundIntentToHash(bound))).toEqual(bound);
  });

  it('round-trips a bare hash (no workspace prefix) into { intent } only', () => {
    const intent: WorkspaceIntent = { kind: 'edit-rule', uid: UID_A };
    expect(hashToBoundIntent(intentToHash(intent))).toEqual({ intent });
  });

  it('parses the workspace-only #/ws/<wsId> form as bound open-workspace', () => {
    expect(hashToBoundIntent(`#/ws/${WS_ID}`)).toEqual({
      workspaceId: WS_ID,
      intent: { kind: 'open-workspace' },
    });
  });

  it('parses #/ws/<wsId>/<intent> back into both halves', () => {
    expect(hashToBoundIntent(`#/ws/${WS_ID}/environment/${UID_B}`)).toEqual({
      workspaceId: WS_ID,
      intent: { kind: 'edit-environment', uid: UID_B },
    });
  });

  it('returns null when the inner intent fails to parse', () => {
    expect(hashToBoundIntent(`#/ws/${WS_ID}/not-a-route`)).toBeNull();
  });

  it('treats a hash with /ws/ but no id as a bare unknown route (null)', () => {
    // `#/ws` is a bare unknown route — only one segment, doesn't trip
    // the prefix matcher (which requires a wsId after the `ws` head).
    expect(hashToBoundIntent('#/ws')).toBeNull();
  });
});
