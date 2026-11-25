/**
 * An export file whose workflow holds steps this build does not know
 * (the workflow runs plan, Laws — "A tolerant reader ships first").
 *
 * The workflow is not dropped on import and its unknown steps are kept
 * as written: the uid remap rebinds the call step's request and leaves
 * them alone, and the missing-dependency walk looks for the call step's
 * request and no other.
 */

import * as v from 'valibot';
import { describe, expect, it } from 'vitest';
import { LiveWorkflowSchema } from '../../src/schemas/live';
import type { LiveWorkflow, Request, WorkspaceVariables } from '../../src/types/index';
import {
  buildImportPlan,
  buildWorkspaceExport,
  diffWorkspaceExport,
  parseWorkspaceExport,
  serializeWorkspaceExport,
  type TargetWorkspaceState,
  walkMissingDeps,
} from '../../src/workspace-export/index';

const LISTEN = { uid: 'stplistn', id: 'probe', action: 'listen', session: 'mqttreq1' };
const CALL = { uid: 'stpcall0', id: 'reboot', requestUid: 'httpreq1', captures: [] };
const EXPECT = { uid: 'stpexpct', id: 'status', action: 'expect', on: 'probe', after: 'reboot', captures: [] };

const workflow: LiveWorkflow = v.parse(LiveWorkflowSchema, {
  schemaVersion: 5,
  uid: 'wfdevice',
  path: 'live-workflows/reboot-wfdevice',
  name: 'Reboot',
  steps: [LISTEN, CALL, EXPECT],
  refresh: { kind: 'manual' },
  enabled: true,
});

const request: Request = {
  schemaVersion: 5,
  uid: 'httpreq1',
  path: 'requests/devices-coldevic/reboot-httpreq1',
  name: 'Reboot dev-1',
  method: 'POST',
  url: 'https://api.openheaders.io/devices/dev-1/reboot',
  headers: [],
  params: [],
  auth: { type: 'none' },
  body: { type: 'none' },
};

const workspaceVars: WorkspaceVariables = { schemaVersion: 5, variables: [] };

function exportFile(requests: Request[]): string {
  return serializeWorkspaceExport(
    buildWorkspaceExport({
      exportedAt: '2026-11-25T18:30:00.000Z',
      exportId: 'e8a1b2c3',
      source: { app: 'extension', appVersion: '2026.12.0', platform: 'chrome' },
      scope: 'workspace',
      workspace: { uid: '01905000-0000-7000-8000-0000000000aa', name: 'Devices' },
      entities: {
        collections: [],
        folders: [],
        rules: [],
        requests,
        templates: [],
        environments: [],
        workspaceVars,
        liveWorkflows: [workflow],
        liveVariables: [],
        specs: [],
      },
    }),
  );
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

function read(requests: Request[] = [request]) {
  const parsed = parseWorkspaceExport(exportFile(requests));
  if (!parsed.ok) throw new Error(parsed.details);
  return parsed;
}

describe('an export file whose workflow holds steps this build does not know', () => {
  it('is read with the workflow kept and its unknown steps as written', () => {
    const { export: incoming, drops } = read();
    expect(drops).toEqual([]);
    expect(incoming.entities.liveWorkflows.map((imported) => imported.steps)).toEqual([[LISTEN, CALL, EXPECT]]);
  });

  it('is imported as a copy with the call step rebound and the unknown steps untouched', () => {
    const { export: incoming } = read();
    const plan = buildImportPlan(incoming, diffWorkspaceExport(incoming, emptyTarget()), emptyTarget());
    const [entry] = plan.liveWorkflows;
    expect(entry.action).toBe('create');
    expect(plan.uidRemap.httpreq1).toMatch(/^[a-z0-9]{8}$/);
    expect(entry.entity.steps).toEqual([LISTEN, { ...CALL, requestUid: plan.uidRemap.httpreq1 }, EXPECT]);
  });

  it('names the call step’s request as the one missing dependency', () => {
    const { export: incoming } = read([]);
    expect(walkMissingDeps(incoming, emptyTarget())).toEqual([
      { type: 'request', name: 'httpreq1', referencedBy: ['liveWorkflows:wfdevice'] },
    ]);
  });
});
