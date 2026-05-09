import { describe, expect, it } from 'vitest';
import { parseLiveWorkflow } from '../../src/codec/yaml/live-workflow';

const PATH = 'live-workflows/legacy-wflow001';

const UID_RE = /^[a-z0-9]{8}$/;

describe('parseLiveWorkflow — auto-uid-assign for legacy / hand-authored YAML', () => {
  it('mints step.uid when missing on every step', () => {
    const yaml = `schemaVersion: 5
uid: wflow001
name: Legacy
enabled: true
refresh:
  kind: manual
steps:
  - id: fetch
    requestUid: reqaaaa1
    captures: []
  - id: parse
    requestUid: reqbbbb1
    captures: []
`;
    const parsed = parseLiveWorkflow(yaml, { path: PATH });
    expect(parsed.value.steps).toHaveLength(2);
    for (const step of parsed.value.steps) {
      expect(step.uid).toMatch(UID_RE);
    }
    // Independent steps get independent uids.
    expect(parsed.value.steps[0].uid).not.toBe(parsed.value.steps[1].uid);
  });

  it('mints capture.uid when missing on every capture', () => {
    const yaml = `schemaVersion: 5
uid: wflow001
name: Legacy
enabled: true
refresh:
  kind: manual
steps:
  - uid: stepfix1
    id: fetch
    requestUid: reqaaaa1
    captures:
      - name: token
        extractor:
          kind: whole-body
      - name: status
        extractor:
          kind: status-code
`;
    const parsed = parseLiveWorkflow(yaml, { path: PATH });
    const captures = parsed.value.steps[0].captures;
    expect(captures).toHaveLength(2);
    for (const c of captures) expect(c.uid).toMatch(UID_RE);
    expect(captures[0].uid).not.toBe(captures[1].uid);
  });

  it('mints gate-clause uid on every clause shape', () => {
    const yaml = `schemaVersion: 5
uid: wflow001
name: Legacy
enabled: true
refresh:
  kind: manual
steps:
  - uid: stepfix1
    id: login
    requestUid: reqaaaa1
    captures:
      - uid: capfix01
        name: token
        extractor:
          kind: whole-body
  - uid: stepfix2
    id: fetch
    requestUid: reqbbbb1
    captures: []
    dependsOn: [login]
    runIf:
      all:
        - kind: status
          stepId: login
          match: 2xx
        - kind: capture-exists
          stepId: login
          captureName: token
        - kind: capture-equals
          stepId: login
          captureName: token
          value: ok
        - kind: capture-matches
          stepId: login
          captureName: token
          pattern: ^[a-z]+$
`;
    const parsed = parseLiveWorkflow(yaml, { path: PATH });
    const clauses = parsed.value.steps[1].runIf?.all ?? [];
    expect(clauses).toHaveLength(4);
    for (const cl of clauses) expect(cl.uid).toMatch(UID_RE);
  });

  it('preserves existing uids verbatim — only fills gaps', () => {
    const yaml = `schemaVersion: 5
uid: wflow001
name: Mixed
enabled: true
refresh:
  kind: manual
steps:
  - uid: stepkeep
    id: fetch
    requestUid: reqaaaa1
    captures:
      - uid: capkeep1
        name: token
        extractor:
          kind: whole-body
      - name: status
        extractor:
          kind: status-code
`;
    const parsed = parseLiveWorkflow(yaml, { path: PATH });
    expect(parsed.value.steps[0].uid).toBe('stepkeep');
    expect(parsed.value.steps[0].captures[0].uid).toBe('capkeep1');
    // Capture with no uid gets one minted.
    expect(parsed.value.steps[0].captures[1].uid).toMatch(UID_RE);
    expect(parsed.value.steps[0].captures[1].uid).not.toBe('capkeep1');
  });
});
