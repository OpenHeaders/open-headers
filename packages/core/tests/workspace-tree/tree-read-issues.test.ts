/**
 * Tree reader edge cases — the issue-reporting seam (GIT_PLAN.md §10
 * Phase 2; quarantine consumes these rows in Phase 4). A broken
 * document must never abort the read of the rest of the tree.
 */

import { describe, expect, it } from 'vitest';
import { readWorkspaceTree, type TreeFile } from '../../src/workspace-tree';

const WORKSPACE_YAML = [
  'schemaVersion: 5',
  'uid: wwwwwwww',
  'name: Probe',
  'orgId: 019637a2-7b9a-7b9a-8b9a-1234567890ab',
  '',
].join('\n');

const RULE_YAML = [
  'schemaVersion: 5',
  'uid: aaaaaaaa',
  'name: Block probes',
  'type: block',
  'enabled: true',
  'conditions: []',
  'action: {}',
  '',
].join('\n');

function file(path: string, content: string): TreeFile {
  return { path, content };
}

describe('readWorkspaceTree edge cases', () => {
  it('parses a minimal tree and merges the environment secret split', () => {
    const result = readWorkspaceTree([
      file('workspace.yaml', WORKSPACE_YAML),
      file('rules/block-probes-aaaaaaaa/rule.yaml', RULE_YAML),
      file(
        'environments/dev-eeeeeeee.yaml',
        ['schemaVersion: 5', 'uid: eeeeeeee', 'name: dev', 'variables: []', ''].join('\n'),
      ),
      file(
        'environments/dev-eeeeeeee.secret.yaml',
        [
          'schemaVersion: 5',
          'variables:',
          '  - uid: ssssssss',
          '    name: API_TOKEN',
          '    value: sekret',
          '    type: secret',
          '',
        ].join('\n'),
      ),
    ]);

    expect(result.issues).toEqual([]);
    expect(result.state.workspace?.uid).toBe('wwwwwwww');
    expect(result.state.rules).toHaveLength(1);
    expect(result.state.rules[0].path).toBe('rules/block-probes-aaaaaaaa');
    expect(result.state.environments[0].variables).toEqual([
      { uid: 'ssssssss', name: 'API_TOKEN', value: 'sekret', type: 'secret' },
    ]);
  });

  it('reports a broken document as an issue without aborting the rest', () => {
    const result = readWorkspaceTree([
      file('workspace.yaml', WORKSPACE_YAML),
      file('rules/bad-bbbbbbbb/rule.yaml', 'schemaVersion: 5\nuid: [not a string\n'),
      file('rules/block-probes-aaaaaaaa/rule.yaml', RULE_YAML),
    ]);

    expect(result.issues).toHaveLength(1);
    expect(result.issues[0].path).toBe('rules/bad-bbbbbbbb/rule.yaml');
    expect(result.state.rules).toHaveLength(1);
    expect(result.state.workspace?.uid).toBe('wwwwwwww');
  });

  it('reports a missing workspace.yaml and returns a null workspace', () => {
    const result = readWorkspaceTree([file('rules/block-probes-aaaaaaaa/rule.yaml', RULE_YAML)]);
    expect(result.state.workspace).toBeNull();
    expect(result.issues.some((issue) => issue.path === 'workspace.yaml')).toBe(true);
    expect(result.state.rules).toHaveLength(1);
  });

  it('skips a duplicate uid and reports it', () => {
    const result = readWorkspaceTree([
      file('workspace.yaml', WORKSPACE_YAML),
      file('rules/block-probes-aaaaaaaa/rule.yaml', RULE_YAML),
      file('rules/copy-aaaaaaaa/rule.yaml', RULE_YAML),
    ]);
    expect(result.state.rules).toHaveLength(1);
    expect(result.issues).toHaveLength(1);
    expect(result.issues[0].message).toContain('duplicate uid');
  });

  it("ignores the user's own files and the sidecar, silently", () => {
    const result = readWorkspaceTree([
      file('workspace.yaml', WORKSPACE_YAML),
      file('README.md', '# my workspace\n'),
      file('.gitignore', '.oh/\n*.secret.yaml\n'),
      file('.oh/lock', '{}'),
      file('.git/HEAD', 'ref: refs/heads/main\n'),
    ]);
    expect(result.issues).toEqual([]);
    expect(result.state.workspace?.uid).toBe('wwwwwwww');
  });

  it('reports a container outside the three tree roots', () => {
    const result = readWorkspaceTree([
      file('workspace.yaml', WORKSPACE_YAML),
      file('misc/stray-cccccccc/_collection.yaml', 'schemaVersion: 5\nuid: cccccccc\nname: Stray\nvariables: []\n'),
    ]);
    expect(result.issues).toHaveLength(1);
    expect(result.issues[0].message).toContain('outside a known tree root');
  });
});
