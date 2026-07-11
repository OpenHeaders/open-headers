/**
 * Catalog contract — the CLI's command tables map 1:1 onto the shipped
 * MCP tool catalog (MCP_SERVER_PLAN.md §5), pinned here as the client's
 * copy of that contract: a server-side rename or removal lands as a
 * visible diff in this list, never a silent drift. The desktop e2e
 * (mcp.spec.ts) pins the same catalog from the server side.
 */

import { describe, expect, it } from 'vitest';
import { EXEC_COMMANDS } from '../../src/exec-commands';
import { READ_COMMANDS } from '../../src/read-commands';
import { WRITE_COMMANDS } from '../../src/write-commands';

const CATALOG = [
  'workspaces_list',
  'rules_list',
  'rules_get',
  'requests_list',
  'requests_get',
  'environments_list',
  'variables_list',
  'workflows_list',
  'workflows_history',
  'activity_list',
  'workspaces_diff',
  'rules_toggle',
  'rules_create',
  'rules_update',
  'rules_delete',
  'environments_create',
  'environments_edit',
  'variables_set',
  'requests_save',
  'workflows_save',
  'requests_import',
  'workspaces_create',
  'workspaces_switch',
  'environments_switch',
  'requests_send',
  'workflows_run',
  'variables_reveal_secret',
];

const ALL_SPECS = [...READ_COMMANDS, ...WRITE_COMMANDS, ...EXEC_COMMANDS];

describe('catalog contract', () => {
  it('every command maps onto a catalog tool — the CLI invents no verbs', () => {
    for (const spec of ALL_SPECS) {
      expect(CATALOG, `oh ${spec.group} ${spec.verb} → ${spec.tool}`).toContain(spec.tool);
    }
  });

  it('no command name collides across the three dispatch tables', () => {
    const names = ALL_SPECS.map((spec) => `${spec.group} ${spec.verb}`);
    expect(new Set(names).size).toBe(names.length);
  });

  it('the deliberate non-goals stay out: no authoring, no secrets reveal', () => {
    const tools = new Set(ALL_SPECS.map((spec) => spec.tool));
    for (const excluded of [
      'rules_create',
      'rules_update',
      'rules_delete',
      'environments_create',
      'environments_edit',
      'requests_save',
      'workflows_save',
      'requests_import',
      'workspaces_create',
      'variables_reveal_secret',
    ]) {
      expect(tools).not.toContain(excluded);
    }
  });
});
