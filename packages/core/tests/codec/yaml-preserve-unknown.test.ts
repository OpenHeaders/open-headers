/**
 * Phase 0 invariant #4 — preserve-unknown on every write.
 *
 * Simulates a newer client adding a field the current reader doesn't
 * know about (e.g. a future `notes:` key on a Rule). The reader parses,
 * serializes with no edits, and the unknown key must round-trip
 * unchanged in its original position.
 *
 * Runs once per entity codec so any regression surfaces immediately.
 */

import { describe, expect, it } from 'vitest';
import {
  parseCollection,
  parseEnvironment,
  parseFolder,
  parseLiveVariable,
  parseLiveWorkflow,
  parseRequest,
  parseRule,
  parseTemplate,
  parseVault,
  parseWorkspace,
  parseWorkspaceVariables,
  serializeCollection,
  serializeEnvironment,
  serializeFolder,
  serializeLiveVariable,
  serializeLiveWorkflow,
  serializeRequest,
  serializeRule,
  serializeTemplate,
  serializeVault,
  serializeWorkspace,
  serializeWorkspaceVariables,
} from '../../src/codec/yaml';
import { mergePatch } from '../../src/schemas/document';

// Canonical layout: known fields first in `ordering.ts` sequence, then
// unknown fields in their original order. Serialize reorders to this
// shape deterministically — so the round-trip assertion requires the
// fixture to already be in canonical form.

const WORKSPACE_WITH_UNKNOWN = `schemaVersion: 5
uid: a1b2c3d4
name: OpenHeaders Demo
description: Sample workspace exercising the v5 codec.
teamNotes: from-the-future
`;

const COLLECTION_WITH_UNKNOWN = `schemaVersion: 5
uid: c0ll1111
name: Auth
description: Authentication endpoints.
variables: []
futureHint: preserve-me
`;

const FOLDER_WITH_UNKNOWN = `schemaVersion: 5
uid: f0ld3r12
name: Tokens
futureFlag: keep-around
`;

const RULE_WITH_UNKNOWN = `schemaVersion: 5
uid: rulehdr1
name: Set Authorization header
type: header
enabled: true
conditions:
  - uid: cnd00020
    type: request-domains
    values:
      - api.openheaders.io
action:
  requestHeaders:
    - uid: hmd00020
      operation: override
      headerName: Authorization
      value: Bearer {{env.TOKEN}}
  responseHeaders: []
futureMetadata:
  author: alice
  ticket: OH-4200
`;

const TEMPLATE_WITH_UNKNOWN = `schemaVersion: 5
uid: tmpl0001
name: Bearer Token
ruleType: header
icon: 🔐
description: Pre-filled header rule for bearer-token auth.
includes:
  conditions: true
  formValues: true
conditions: []
formValues: {}
createdAt: 2026-04-19T00:00:00.000Z
updatedAt: 2026-04-19T00:00:00.000Z
newField: still-here
`;

describe('yaml codec — preserve-unknown on identity write', () => {
  it('workspace.yaml retains unknown top-level key', () => {
    const parsed = parseWorkspace(WORKSPACE_WITH_UNKNOWN);
    const write = mergePatch(parsed, () => {});
    expect(serializeWorkspace(write)).toBe(WORKSPACE_WITH_UNKNOWN);
  });

  it('workspace.yaml drops orgId without capturing an unknown row (the git-sync plan §5)', () => {
    const withOrgId = `schemaVersion: 5
uid: a1b2c3d4
name: OpenHeaders Demo
description: Sample workspace exercising the v5 codec.
orgId: 01890000-0000-7000-8000-000000000000
teamNotes: from-the-future
`;
    const parsed = parseWorkspace(withOrgId);
    expect('orgId' in (parsed.value as Record<string, unknown>)).toBe(false);
    const write = mergePatch(parsed, () => {});
    expect(serializeWorkspace(write)).toBe(WORKSPACE_WITH_UNKNOWN);
  });

  it('_collection.yaml retains unknown top-level key', () => {
    const parsed = parseCollection(COLLECTION_WITH_UNKNOWN, { path: 'requests/auth-c0ll1111' });
    const write = mergePatch(parsed, () => {});
    expect(serializeCollection(write).collectionYaml).toBe(COLLECTION_WITH_UNKNOWN);
  });

  it('_folder.yaml retains unknown top-level key', () => {
    const parsed = parseFolder(FOLDER_WITH_UNKNOWN, { path: 'requests/auth-c0ll1111/tokens-f0ld3r12' });
    const write = mergePatch(parsed, () => {});
    expect(serializeFolder(write).folderYaml).toBe(FOLDER_WITH_UNKNOWN);
  });

  it('rule.yaml retains unknown top-level key (including nested map)', () => {
    const parsed = parseRule(RULE_WITH_UNKNOWN, { path: 'rules/auth-rulehdr1' });
    const write = mergePatch(parsed, () => {});
    expect(serializeRule(write)).toBe(RULE_WITH_UNKNOWN);
  });

  it('template.yaml retains unknown top-level key', () => {
    const parsed = parseTemplate(TEMPLATE_WITH_UNKNOWN, { path: 'templates/bearer-tmpl0001' });
    const write = mergePatch(parsed, () => {});
    expect(serializeTemplate(write)).toBe(TEMPLATE_WITH_UNKNOWN);
  });

  it('NESTED unknown fields survive a known-field edit (inside action + inside a row)', () => {
    const raw = `schemaVersion: 5
uid: rulehdr2
name: Set tenant header
type: header
enabled: true
conditions: []
action:
  requestHeaders:
    - uid: hmd00021
      operation: override
      headerName: X-Tenant
      value: acme
      rowHint: from-the-future
  responseHeaders: []
  futureActionFlag: keep-me
`;
    const parsed = parseRule(raw, { path: 'rules/tenant-rulehdr2' });
    const write = mergePatch(parsed, (draft) => {
      draft.name = 'Set tenant header (edited)';
    });
    const out = serializeRule(write);
    expect(out).toContain('name: Set tenant header (edited)');
    expect(out).toContain('rowHint: from-the-future');
    expect(out).toContain('futureActionFlag: keep-me');
    // Identity re-serialization of the edited bytes is a fixpoint.
    const reparsed = parseRule(out, { path: 'rules/tenant-rulehdr2' });
    expect(serializeRule(mergePatch(reparsed, () => {}))).toBe(out);
  });

  it('known-field edit survives with unknown fields untouched', () => {
    const parsed = parseWorkspace(WORKSPACE_WITH_UNKNOWN);
    const write = mergePatch(parsed, (draft) => {
      draft.description = 'Updated description';
    });
    const out = serializeWorkspace(write);
    expect(out).toContain('description: Updated description');
    expect(out).toContain('teamNotes: from-the-future');
  });

  it('workspace-vars.yaml retains unknown top-level key', () => {
    const raw = `schemaVersion: 5
variables: []
futureMeta: keep-me
`;
    const parsed = parseWorkspaceVariables(raw);
    const write = mergePatch(parsed, () => {});
    expect(serializeWorkspaceVariables(write)).toBe(raw);
  });

  it('workspace-vars.secret.yaml (vault) retains unknown top-level key', () => {
    const raw = `schemaVersion: 5
secrets: []
rotationPolicy: monthly
`;
    const parsed = parseVault(raw);
    const write = mergePatch(parsed, () => {});
    expect(serializeVault(write)).toBe(raw);
  });

  it('environment default file retains unknown top-level key', () => {
    const defaultRaw = `schemaVersion: 5
uid: env00001
name: staging
variables: []
futureMeta: retain
`;
    const parsed = parseEnvironment({ default: defaultRaw });
    const write = mergePatch(parsed, () => {});
    const out = serializeEnvironment(write);
    expect(out.default).toBe(defaultRaw);
  });

  it('live-workflow.yaml retains unknown top-level key', () => {
    const raw = `schemaVersion: 5
uid: wflow003
name: Example
enabled: true
refresh:
  kind: interval
  seconds: 300
steps:
  - uid: stponly0
    id: only
    requestUid: reqonly1
    captures:
      - uid: capvalu0
        name: value
        extractor:
          kind: whole-body
ownerTeam: platform
`;
    const parsed = parseLiveWorkflow(raw, { path: 'live-workflows/example-wflow003' });
    const write = mergePatch(parsed, () => {});
    expect(serializeLiveWorkflow(write)).toBe(raw);
  });

  it('live-variable.yaml retains unknown top-level key', () => {
    const raw = `schemaVersion: 5
uid: livvar03
name: exampleValue
enabled: true
workflowUid: wflow003
stepId: only
captureName: value
futureTag: keep-me
`;
    const parsed = parseLiveVariable(raw, { path: 'live-variables/example-livvar03' });
    const write = mergePatch(parsed, () => {});
    expect(serializeLiveVariable(write)).toBe(raw);
  });

  it('request.yaml retains unknown top-level key', () => {
    const raw = `schemaVersion: 5
uid: reqlogin
name: Login
method: POST
url: "{{API_URL}}/auth/login"
headers: []
params: []
auth:
  type: none
body:
  type: none
futureMeta:
  owner: platform-team
`;
    const parsed = parseRequest(raw, { path: 'requests/auth-c0ll1111/login-reqlogin' });
    const write = mergePatch(parsed, () => {});
    const out = serializeRequest(write);
    expect(out.requestYaml).toBe(raw);
  });
});
