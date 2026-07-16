/**
 * Spec legs of the workspace-export spine: build (canonical path +
 * counts + verbatim content), YAML round-trip through parse, diff
 * (workspace-wide uid/name match), and importer (flat new-uid, mirror
 * environments).
 */

import type { Collection, Spec } from '@openheaders/core/types';
import {
  buildImportPlan,
  buildWorkspaceExport,
  diffWorkspaceExport,
  parseWorkspaceExport,
  serializeWorkspaceExport,
  type TargetWorkspaceState,
} from '@openheaders/core/workspace-export';
import { describe, expect, it } from 'vitest';

const FIXED_TIMESTAMP = '2026-07-16T10:00:00.000Z';

const ROOT_CONTENT = [
  "openapi: '3.1.0'",
  'info:',
  '  title: OpenHeaders API',
  "  version: '1.0.0'",
  'servers:',
  '  - url: https://api.openheaders.io',
  '',
].join('\n');

function makeSpec(overrides: Partial<Spec> = {}): Spec {
  return {
    schemaVersion: 5,
    uid: 'spc00001',
    path: 'specs/openheaders-api-spc00001',
    name: 'OpenHeaders API',
    format: 'openapi-3.1',
    rootFileUid: 'fil00001',
    files: [{ uid: 'fil00001', fileName: 'index.yaml', content: ROOT_CONTENT }],
    ...overrides,
  };
}

function baseInput(specs: Spec[]): Parameters<typeof buildWorkspaceExport>[0] {
  return {
    exportedAt: FIXED_TIMESTAMP,
    exportId: 'e8a1b2c3',
    source: { app: 'extension', appVersion: '5.0.4', platform: 'chrome' },
    scope: 'workspace',
    workspace: { uid: '01905000-0000-7000-8000-0000000000aa', name: 'Project' },
    entities: {
      collections: [],
      folders: [],
      rules: [],
      requests: [],
      templates: [],
      environments: [],
      workspaceVars: { schemaVersion: 5, variables: [] },
      liveWorkflows: [],
      liveVariables: [],
      specs,
    },
  };
}

function emptyTarget(): TargetWorkspaceState {
  return {
    collections: [],
    folders: [],
    rules: [],
    requests: [],
    templates: [],
    environments: [],
    liveWorkflows: [],
    liveVariables: [],
    specs: [],
  };
}

describe('buildWorkspaceExport — specs', () => {
  it('carries specs with verbatim file content and counts them', () => {
    const exp = buildWorkspaceExport(baseInput([makeSpec()]));
    expect(exp.entities.specs).toHaveLength(1);
    expect(exp.entities.specs[0].files[0].content).toBe(ROOT_CONTENT);
    expect(exp.meta.counts.specs).toBe(1);
  });

  it('canonicalizes the spec path from name + uid', () => {
    const exp = buildWorkspaceExport(baseInput([makeSpec({ path: 'specs/totally-wrong' })]));
    expect(exp.entities.specs[0].path).toBe('specs/openheaders-api-spc00001');
  });
});

describe('workspace-export YAML round-trip — specs', () => {
  it('parses back the spec entity byte-for-byte on content', () => {
    const yaml = serializeWorkspaceExport(buildWorkspaceExport(baseInput([makeSpec()])));
    const parsed = parseWorkspaceExport(yaml);
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.drops).toEqual([]);
    expect(parsed.export.entities.specs).toHaveLength(1);
    const spec = parsed.export.entities.specs[0];
    expect(spec.uid).toBe('spc00001');
    expect(spec.format).toBe('openapi-3.1');
    expect(spec.rootFileUid).toBe('fil00001');
    expect(spec.files[0].content).toBe(ROOT_CONTENT);
  });

  it('drops a malformed spec entity fail-soft, siblings survive', () => {
    const exp = buildWorkspaceExport(baseInput([makeSpec()]));
    const raw = JSON.parse(JSON.stringify(exp)) as { entities: { specs: unknown[] } };
    raw.entities.specs.push({ uid: 'bad', name: '' });
    const parsed = parseWorkspaceExport(JSON.stringify(raw));
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.export.entities.specs).toHaveLength(1);
    expect(parsed.drops).toHaveLength(1);
    expect(parsed.drops[0].path).toBe('entities.specs[1]');
  });
});

describe('diffWorkspaceExport — specs', () => {
  it('reports no-collision against an empty target with new-uid default', () => {
    const exp = buildWorkspaceExport(baseInput([makeSpec()]));
    const diff = diffWorkspaceExport(exp, emptyTarget());
    expect(diff.specs).toHaveLength(1);
    expect(diff.specs[0].state).toBe('no-collision');
    expect(diff.specs[0].defaultStrategy).toBe('new-uid');
    expect(diff.specs[0].allowedStrategies).toEqual(['new-uid', 'update', 'skip']);
  });

  it('matches by uid, then by name workspace-wide', () => {
    const exp = buildWorkspaceExport(baseInput([makeSpec()]));
    const byUid = diffWorkspaceExport(exp, { ...emptyTarget(), specs: [makeSpec({ name: 'Renamed' })] });
    expect(byUid.specs[0].state).toBe('collision-uid');
    const byName = diffWorkspaceExport(exp, {
      ...emptyTarget(),
      specs: [makeSpec({ uid: 'spc99999', rootFileUid: 'fil99999' })],
    });
    expect(byName.specs[0].state).toBe('collision-name');
  });
});

describe('buildImportPlan — specs', () => {
  it('creates with a fresh uid and rebuilt path on new-uid', () => {
    const exp = buildWorkspaceExport(baseInput([makeSpec()]));
    const target = emptyTarget();
    const plan = buildImportPlan(exp, diffWorkspaceExport(exp, target), target);
    expect(plan.specs).toHaveLength(1);
    const entry = plan.specs[0];
    expect(entry.action).toBe('create');
    expect(entry.entity.uid).not.toBe('spc00001');
    expect(entry.entity.path).toBe(`specs/openheaders-api-${entry.entity.uid}`);
    // File rows keep their uids — rootFileUid stays consistent.
    expect(entry.entity.rootFileUid).toBe('fil00001');
    expect(entry.entity.files[0].content).toBe(ROOT_CONTENT);
    expect(plan.uidRemap.spc00001).toBe(entry.entity.uid);
  });

  it('updates in place on uid collision when chosen', () => {
    const exp = buildWorkspaceExport(baseInput([makeSpec({ name: 'Renamed API' })]));
    const target: TargetWorkspaceState = { ...emptyTarget(), specs: [makeSpec()] };
    const diff = diffWorkspaceExport(exp, target);
    const plan = buildImportPlan(exp, diff, target, { specs: { spc00001: 'update' } });
    expect(plan.specs[0].action).toBe('update');
    expect(plan.specs[0].targetUid).toBe('spc00001');
    expect(plan.specs[0].entity.name).toBe('Renamed API');
  });

  it('skips when chosen', () => {
    const exp = buildWorkspaceExport(baseInput([makeSpec()]));
    const target: TargetWorkspaceState = { ...emptyTarget(), specs: [makeSpec()] };
    const diff = diffWorkspaceExport(exp, target);
    const plan = buildImportPlan(exp, diff, target, { specs: { spc00001: 'skip' } });
    expect(plan.specs[0].action).toBe('skip');
  });

  it('rebinds a generated collection specLink through the spec uid remap', () => {
    const linked: Collection = {
      schemaVersion: 5,
      uid: 'c0110001',
      path: 'requests/openheaders-api-c0110001',
      name: 'OpenHeaders API',
      variables: [],
      pinnedEnvironmentIds: [],
      defaultEnvironmentId: null,
      specLink: { specUid: 'spc00001', sourceHash: 'sha256:abc' },
    };
    const input = baseInput([makeSpec()]);
    input.entities.collections = [linked];
    const exp = buildWorkspaceExport(input);
    const target = emptyTarget();
    const plan = buildImportPlan(exp, diffWorkspaceExport(exp, target), target);
    const specEntry = plan.specs[0];
    const collEntry = plan.collections[0];
    expect(collEntry.action).toBe('create');
    expect(collEntry.entity.specLink?.specUid).toBe(specEntry.entity.uid);
    expect(collEntry.entity.specLink?.sourceHash).toBe('sha256:abc');
  });
});
