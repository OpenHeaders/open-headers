/**
 * Write-command table — group/verb lookup, positional/flag → tool-arg
 * mapping (usage errors on shape mistakes), and the `env switch`
 * name → uid pre-resolution against environments_list.
 */

import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Connection } from '../../src/connection';
import { UsageError } from '../../src/exit-codes';
import { findWriteCommand, resolveEnvironmentTarget, WRITE_COMMANDS } from '../../src/write-commands';

const CONN: Connection = { daemonUrl: 'http://127.0.0.1:8137', token: 'oh_secret' };

function spec(group: string, verb: string) {
  const match = findWriteCommand(group, verb);
  if (!match) throw new Error(`missing write command: ${group} ${verb}`);
  return match;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('findWriteCommand', () => {
  it('matches the four Phase 2 verbs', () => {
    expect(findWriteCommand('rules', 'toggle')?.tool).toBe('rules_toggle');
    expect(findWriteCommand('env', 'switch')?.tool).toBe('environments_switch');
    expect(findWriteCommand('vars', 'set')?.tool).toBe('variables_set');
    expect(findWriteCommand('workspace', 'switch')?.tool).toBe('workspaces_switch');
  });

  it('rejects unknown groups and verbs', () => {
    expect(findWriteCommand('rules', 'list')).toBeUndefined();
    expect(findWriteCommand('nope', 'switch')).toBeUndefined();
    expect(findWriteCommand(undefined, undefined)).toBeUndefined();
  });
});

describe('WRITE_COMMANDS table', () => {
  it('maps only onto the shipped write catalog', () => {
    const allowed = new Set(['rules_toggle', 'environments_switch', 'variables_set', 'workspaces_switch']);
    for (const entry of WRITE_COMMANDS) {
      expect(allowed.has(entry.tool), entry.tool).toBe(true);
    }
    expect(new Set(WRITE_COMMANDS.map((entry) => entry.tool)).size).toBe(WRITE_COMMANDS.length);
  });
});

describe('rules toggle args', () => {
  const toggle = spec('rules', 'toggle');

  it('maps <uid> on|off to an explicit enabled boolean', () => {
    expect(toggle.buildArgs(['r-1', 'on'], {})).toEqual({ uid: 'r-1', enabled: true });
    expect(toggle.buildArgs(['r-1', 'off'], {})).toEqual({ uid: 'r-1', enabled: false });
  });

  it('rejects a missing state, a non on/off token, and extra positionals', () => {
    expect(() => toggle.buildArgs(['r-1'], {})).toThrow(UsageError);
    expect(() => toggle.buildArgs(['r-1', 'true'], {})).toThrow(UsageError);
    expect(() => toggle.buildArgs(['r-1', 'on', 'extra'], {})).toThrow(UsageError);
    expect(() => toggle.buildArgs([], {})).toThrow(UsageError);
  });
});

describe('env switch args', () => {
  const envSwitch = spec('env', 'switch');

  it('passes the name-or-uid through for resolution', () => {
    expect(envSwitch.buildArgs(['staging'], {})).toEqual({ environmentId: 'staging' });
  });

  it('maps --none to environmentId null', () => {
    expect(envSwitch.buildArgs([], { none: true })).toEqual({ environmentId: null });
  });

  it('rejects no target, --none combined with a target, and extra positionals', () => {
    expect(() => envSwitch.buildArgs([], {})).toThrow(UsageError);
    expect(() => envSwitch.buildArgs(['staging'], { none: true })).toThrow(UsageError);
    expect(() => envSwitch.buildArgs(['staging', 'extra'], {})).toThrow(UsageError);
  });
});

describe('resolveEnvironmentTarget', () => {
  function environmentsList(environments: { uid: string; name: string }[]): Response {
    return Response.json({
      jsonrpc: '2.0',
      id: 1,
      result: { content: [{ type: 'text', text: JSON.stringify({ environments }) }] },
    });
  }

  it('keeps a uid match verbatim', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(environmentsList([{ uid: 'e-1', name: 'staging' }])));
    expect(await resolveEnvironmentTarget({ environmentId: 'e-1' }, CONN)).toEqual({ environmentId: 'e-1' });
  });

  it('resolves a unique exact name to its uid, forwarding --workspace to the list call', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      environmentsList([
        { uid: 'e-1', name: 'staging' },
        { uid: 'e-2', name: 'prod' },
      ]),
    );
    vi.stubGlobal('fetch', fetchMock);

    const resolved = await resolveEnvironmentTarget({ workspaceId: 'ws-1', environmentId: 'prod' }, CONN);

    expect(resolved).toEqual({ workspaceId: 'ws-1', environmentId: 'e-2' });
    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(JSON.parse(init.body as string).params).toEqual({
      name: 'environments_list',
      arguments: { workspaceId: 'ws-1' },
    });
  });

  it('treats an ambiguous name as a usage error naming the candidate uids', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockImplementation(() =>
        Promise.resolve(
          environmentsList([
            { uid: 'e-1', name: 'staging' },
            { uid: 'e-2', name: 'staging' },
          ]),
        ),
      ),
    );
    await expect(resolveEnvironmentTarget({ environmentId: 'staging' }, CONN)).rejects.toBeInstanceOf(UsageError);
    await expect(resolveEnvironmentTarget({ environmentId: 'staging' }, CONN)).rejects.toThrow('e-1, e-2');
  });

  it('fails plainly (exit 1 class) when nothing matches', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockImplementation(() => Promise.resolve(environmentsList([]))),
    );
    await expect(resolveEnvironmentTarget({ environmentId: 'ghost' }, CONN)).rejects.toThrow(
      "no environment named 'ghost'",
    );
    await expect(resolveEnvironmentTarget({ environmentId: 'ghost' }, CONN)).rejects.not.toBeInstanceOf(UsageError);
  });

  it('skips the lookup entirely for the --none path', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    expect(await resolveEnvironmentTarget({ environmentId: null }, CONN)).toEqual({ environmentId: null });
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe('vars set args', () => {
  const varsSet = spec('vars', 'set');

  it('maps name + value to workspace scope with no type by default', () => {
    expect(varsSet.buildArgs(['region', 'eu'], {})).toEqual({ name: 'region', value: 'eu' });
  });

  it('maps --secret and --collection onto type and collectionId', () => {
    expect(varsSet.buildArgs(['apiKey', 'k-1'], { secret: true, collection: 'c-1' })).toEqual({
      name: 'apiKey',
      value: 'k-1',
      type: 'secret',
      collectionId: 'c-1',
    });
  });

  it('rejects missing value and extra positionals', () => {
    expect(() => varsSet.buildArgs(['region'], {})).toThrow(UsageError);
    expect(() => varsSet.buildArgs(['region', 'eu', 'extra'], {})).toThrow(UsageError);
  });
});

describe('workspace switch args', () => {
  const wsSwitch = spec('workspace', 'switch');

  it('maps the positional id onto workspaceId', () => {
    expect(wsSwitch.buildArgs(['ws-2'], {})).toEqual({ workspaceId: 'ws-2' });
  });

  it('rejects a missing id and extra positionals', () => {
    expect(() => wsSwitch.buildArgs([], {})).toThrow(UsageError);
    expect(() => wsSwitch.buildArgs(['ws-2', 'extra'], {})).toThrow(UsageError);
  });
});
