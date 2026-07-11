/**
 * Command-tree lookup — group/verb matching, the verb-less `activity`
 * form, and the 1:1 tool mapping the plan pins (no verbs the catalog
 * doesn't have).
 */

import { describe, expect, it } from 'vitest';
import { commandTokenCount, findReadCommand, READ_COMMANDS } from '../../src/read-commands';

describe('findReadCommand', () => {
  it('matches group + verb', () => {
    expect(findReadCommand('rules', 'list')?.tool).toBe('rules_list');
    expect(findReadCommand('rules', 'get')?.tool).toBe('rules_get');
    expect(findReadCommand('request', 'get')?.tool).toBe('requests_get');
    expect(findReadCommand('workflow', 'history')?.tool).toBe('workflows_history');
  });

  it('matches the verb-less activity form, with and without trailing flags', () => {
    expect(findReadCommand('activity', undefined)?.tool).toBe('activity_list');
    expect(findReadCommand('activity', '--limit')?.tool).toBe('activity_list');
  });

  it('rejects unknown groups and unknown verbs', () => {
    expect(findReadCommand('nope', 'list')).toBeUndefined();
    expect(findReadCommand('rules', 'destroy')).toBeUndefined();
    expect(findReadCommand(undefined, undefined)).toBeUndefined();
  });

  it('consumes one token for verb-less commands, two otherwise', () => {
    const activity = findReadCommand('activity', undefined);
    const rules = findReadCommand('rules', 'list');
    expect(activity && commandTokenCount(activity)).toBe(1);
    expect(rules && commandTokenCount(rules)).toBe(2);
  });
});

describe('READ_COMMANDS table', () => {
  it('maps only onto the shipped read catalog', () => {
    const allowed = new Set([
      'workspaces_list',
      'rules_list',
      'rules_get',
      'environments_list',
      'variables_list',
      'requests_list',
      'requests_get',
      'workflows_list',
      'workflows_history',
      'activity_list',
    ]);
    for (const spec of READ_COMMANDS) {
      expect(allowed.has(spec.tool), spec.tool).toBe(true);
    }
    expect(new Set(READ_COMMANDS.map((spec) => spec.tool)).size).toBe(READ_COMMANDS.length);
  });
});
