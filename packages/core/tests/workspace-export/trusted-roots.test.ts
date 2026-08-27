import { describe, expect, it } from 'vitest';
import type { TrustedRoot, TrustedRoots } from '../../src/types/index';
import {
  buildImportPlan,
  buildWorkspaceExport,
  diffWorkspaceExport,
  parseWorkspaceExport,
  serializeWorkspaceExport,
} from '../../src/workspace-export/index';

const PEM_A = '-----BEGIN CERTIFICATE-----\nAAAA\n-----END CERTIFICATE-----\n';
const PEM_B = '-----BEGIN CERTIFICATE-----\nBBBB\n-----END CERTIFICATE-----\n';
const root = (uid: string, name: string, certPem: string): TrustedRoot => ({
  uid,
  name,
  certPem,
  addedAt: '2026-08-27T00:00:00.000Z',
});

function baseInput(trustedRoots?: TrustedRoots): Parameters<typeof buildWorkspaceExport>[0] {
  return {
    exportedAt: '2026-08-27T18:30:00.000Z',
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
      specs: [],
      ...(trustedRoots ? { trustedRoots } : {}),
    },
  };
}

const emptyTarget = () => ({
  collections: [],
  folders: [],
  rules: [],
  requests: [],
  templates: [],
  environments: [],
  liveWorkflows: [],
  liveVariables: [],
  specs: [],
});

describe('trusted roots ride the workspace export', () => {
  it('round-trips the list verbatim through serialize → parse, ordered after the vault slot', () => {
    const trustedRoots: TrustedRoots = { schemaVersion: 5, roots: [root('root0001', 'Corp Root', PEM_A)] };
    const yaml = serializeWorkspaceExport(buildWorkspaceExport(baseInput(trustedRoots)));
    expect(yaml.indexOf('trustedRoots:')).toBeGreaterThan(yaml.indexOf('workspaceVars:'));
    expect(yaml.indexOf('trustedRoots:')).toBeLessThan(yaml.indexOf('templates:'));
    const parsed = parseWorkspaceExport(yaml);
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.drops).toEqual([]);
    expect(parsed.export.entities.trustedRoots).toEqual(trustedRoots);
  });

  it('an envelope without the slot still parses with no trusted roots', () => {
    const parsed = parseWorkspaceExport(serializeWorkspaceExport(buildWorkspaceExport(baseInput())));
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.export.entities.trustedRoots).toBeUndefined();
  });

  it('a malformed slot drops with a reason instead of failing the parse', () => {
    const yaml = serializeWorkspaceExport(buildWorkspaceExport(baseInput())).replace(
      'workspaceVars:',
      'trustedRoots:\n    schemaVersion: 5\n    roots: nope\n  workspaceVars:',
    );
    const parsed = parseWorkspaceExport(yaml);
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.drops.map((d) => d.path)).toEqual(['entities.trustedRoots']);
    expect(parsed.export.entities.trustedRoots).toBeUndefined();
  });
});

describe('trusted roots import plan', () => {
  it('merge-by-name folds the same certificate onto the target row and adds the new one', () => {
    const incoming = buildWorkspaceExport(
      baseInput({
        schemaVersion: 5,
        roots: [root('inc00001', 'Corp Root (renamed)', PEM_A), root('inc00002', 'Lab', PEM_B)],
      }),
    );
    const target = {
      ...emptyTarget(),
      trustedRoots: { schemaVersion: 5, roots: [root('tgt00001', 'Corp Root', PEM_A)] },
    };
    const diff = diffWorkspaceExport(incoming, target);
    expect(diff.trustedRoots.state).toBe('collision-name');
    expect(diff.trustedRoots.defaultStrategy).toBe('merge-by-name');
    const plan = buildImportPlan(incoming, diff, target);
    expect(plan.trustedRoots.action).toBe('merge-by-name');
    expect(plan.trustedRoots.roots.map((r) => [r.uid, r.name])).toEqual([
      ['tgt00001', 'Corp Root (renamed)'],
      ['inc00002', 'Lab'],
    ]);
  });

  it('replace takes the incoming list, skip keeps the target, an absent slot skips', () => {
    const incoming = buildWorkspaceExport(baseInput({ schemaVersion: 5, roots: [root('inc00001', 'Corp', PEM_A)] }));
    const target = { ...emptyTarget(), trustedRoots: { schemaVersion: 5, roots: [root('tgt00001', 'Old', PEM_B)] } };
    const diff = diffWorkspaceExport(incoming, target);
    expect(
      buildImportPlan(incoming, diff, target, { trustedRoots: 'replace' }).trustedRoots.roots.map((r) => r.uid),
    ).toEqual(['inc00001']);
    expect(
      buildImportPlan(incoming, diff, target, { trustedRoots: 'skip' }).trustedRoots.roots.map((r) => r.uid),
    ).toEqual(['tgt00001']);
    const bare = buildWorkspaceExport(baseInput());
    const bareDiff = diffWorkspaceExport(bare, target);
    expect(bareDiff.trustedRoots.state).toBe('collision-name');
    expect(buildImportPlan(bare, bareDiff, target).trustedRoots).toEqual({
      action: 'skip',
      roots: target.trustedRoots.roots,
    });
  });
});
