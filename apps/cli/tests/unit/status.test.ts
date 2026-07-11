/**
 * `oh status` — the two-line human posture (identity + tool count +
 * tier readout) and the `--json` shape. Tiers derive from the
 * tier-filtered catalog: the server hides a gated tier's tools, so one
 * sentinel per tier is the honest probe.
 */

import { afterEach, describe, expect, it, vi } from 'vitest';
import { commandStatus } from '../../src/commands';

const READ_ONLY = ['workspaces_list', 'rules_list', 'rules_get', 'activity_list'];
const WITH_WRITE = [...READ_ONLY, 'rules_toggle', 'variables_set'];
const ALL_TIERS = [...WITH_WRITE, 'requests_send', 'workflows_run', 'variables_reveal_secret'];

function stubDaemon(toolNames: string[]): void {
  vi.stubGlobal(
    'fetch',
    vi.fn().mockImplementation(async (_url: string, init: RequestInit) => {
      const { method } = JSON.parse(init.body as string) as { method: string };
      if (method === 'initialize') {
        return Response.json({
          jsonrpc: '2.0',
          id: 1,
          result: { serverInfo: { name: 'open-headers', version: '2026.7.0' } },
        });
      }
      return Response.json({
        jsonrpc: '2.0',
        id: 1,
        result: { tools: toolNames.map((name) => ({ name })) },
      });
    }),
  );
}

// Flags override env + config, so the resolved connection is fully pinned.
const ARGV = ['--daemon', 'http://127.0.0.1:8137', '--token', 'oh_secret'];

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('commandStatus', () => {
  it('prints identity, tool count, and the read tier alone on a read-only host', async () => {
    stubDaemon(READ_ONLY);
    expect(await commandStatus(ARGV)).toEqual([
      'running — open-headers v2026.7.0 at http://127.0.0.1:8137',
      '4 tools · tiers: read',
    ]);
  });

  it('reads the write tier out of its sentinel tool', async () => {
    stubDaemon(WITH_WRITE);
    const [, tiersLine] = await commandStatus(ARGV);
    expect(tiersLine).toBe('6 tools · tiers: read + write');
  });

  it('reports every enabled tier', async () => {
    stubDaemon(ALL_TIERS);
    const [, tiersLine] = await commandStatus(ARGV);
    expect(tiersLine).toBe('9 tools · tiers: read + write + execute + secrets');
  });

  it('--json carries the daemon URL, server identity, tool count, and tiers', async () => {
    stubDaemon(WITH_WRITE);
    const [payload] = await commandStatus([...ARGV, '--json']);
    expect(JSON.parse(payload)).toEqual({
      daemonUrl: 'http://127.0.0.1:8137',
      server: { name: 'open-headers', version: '2026.7.0' },
      toolCount: 6,
      tiers: ['read', 'write'],
    });
  });
});
