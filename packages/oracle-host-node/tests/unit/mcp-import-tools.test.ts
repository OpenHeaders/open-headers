/**
 * Coverage for `requests_import` — parser reuse (curl + HAR through the
 * canonical `@openheaders/core/import` surface) committed through the
 * same create path as `requests_save`: real sync service, real batch
 * apply, assertions through the read tier so what the agent imports is
 * what every surface sees. The HAR cap contract is explicit: entries
 * beyond the ceiling are counted, never silently dropped.
 */

import { setHostLogger } from '@openheaders/core/logger';
import { setHostStorage } from '@openheaders/core/storage';
import { logger as consoleLogger } from '@openheaders/core/utils';
import { __initSyncServiceForTests, dispose as disposeSyncService } from '@openheaders/oracle/sync/service';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { McpToolDefinition } from '../../src/mcp/registry';
import { createImportToolDefinitions } from '../../src/mcp/tools/import-tools';
import { createReadToolDefinitions } from '../../src/mcp/tools/read-tools';
import { createHostStorageFake } from './_host-storage-fake';

const wsId = 'ws-mcp-import';
const CTX = { tokenId: 'token-1', userId: 'user-1' };

const tools = new Map<string, McpToolDefinition>(
  [...createReadToolDefinitions(), ...createImportToolDefinitions()].map((t) => [t.name, t]),
);

function call(name: string, args: Record<string, unknown>): Promise<Record<string, unknown>> {
  const tool = tools.get(name);
  if (!tool) throw new Error(`missing tool ${name}`);
  return tool.handler({ workspaceId: wsId, ...args }, CTX) as Promise<Record<string, unknown>>;
}

function harEntry(url: string, method = 'GET', extra: Record<string, unknown> = {}): Record<string, unknown> {
  return { request: { method, url, headers: [], queryString: [], ...extra } };
}

function har(entries: unknown[]): string {
  return JSON.stringify({ log: { version: '1.2', entries } });
}

beforeEach(() => {
  setHostLogger(consoleLogger);
  setHostStorage(createHostStorageFake());
  __initSyncServiceForTests(wsId);
});

afterEach(() => {
  disposeSyncService();
});

describe('requests_import (curl)', () => {
  it('imports a curl command through the canonical create path', async () => {
    const result = await call('requests_import', {
      format: 'curl',
      content:
        "curl -X POST 'https://api.openheaders.io/v1/things?tag=a' -H 'content-type: application/json' --data-raw '{\"name\":\"hello\"}'",
    });

    const created = result.created as Array<{ uid: string; method: string; url: string }>;
    expect(created).toHaveLength(1);
    expect(created[0].method).toBe('POST');

    const fetched = (await call('requests_get', { uid: created[0].uid })) as { request: Record<string, unknown> };
    expect(fetched.request.method).toBe('POST');
    expect((fetched.request.body as { type: string }).type).toBe('json');
  });

  it('surfaces auth-header promotion in the notes', async () => {
    const result = await call('requests_import', {
      format: 'curl',
      content: "curl 'https://api.openheaders.io/v1/me' -H 'authorization: Bearer xyz'",
    });

    expect((result.notes as string[]).join('\n')).toMatch(/auth/i);
  });

  it('rejects an unparsable command with an agent-readable error', async () => {
    await expect(call('requests_import', { format: 'curl', content: 'curl -H' })).rejects.toThrow(
      /could not parse curl command/,
    );
  });

  it("rejects 'entryIndices' outside HAR imports", async () => {
    await expect(
      call('requests_import', { format: 'curl', content: 'curl https://openheaders.io', entryIndices: [0] }),
    ).rejects.toThrow(/only applies to format: 'har'/);
  });
});

describe('requests_import (har)', () => {
  it('imports every well-formed entry and notes the malformed ones', async () => {
    const result = await call('requests_import', {
      format: 'har',
      content: har([
        harEntry('https://api.openheaders.io/v1/a'),
        { comment: 'no request field' },
        harEntry('https://api.openheaders.io/v1/b', 'POST'),
      ]),
    });

    const created = result.created as Array<{ url: string; method: string }>;
    expect(created.map((r) => r.url)).toEqual(['https://api.openheaders.io/v1/a', 'https://api.openheaders.io/v1/b']);
    expect((result.notes as string[]).join('\n')).toContain('log.entries[1]');
  });

  it('imports only the selected entryIndices', async () => {
    const result = await call('requests_import', {
      format: 'har',
      content: har([
        harEntry('https://api.openheaders.io/v1/a'),
        harEntry('https://api.openheaders.io/v1/b'),
        harEntry('https://api.openheaders.io/v1/c'),
      ]),
      entryIndices: [2],
    });

    const created = result.created as Array<{ url: string }>;
    expect(created.map((r) => r.url)).toEqual(['https://api.openheaders.io/v1/c']);
  });

  it('caps oversized captures explicitly, never silently', async () => {
    const entries = Array.from({ length: 55 }, (_, i) => harEntry(`https://api.openheaders.io/v1/item/${i}`));
    const result = await call('requests_import', { format: 'har', content: har(entries) });

    expect(result.created).toHaveLength(50);
    expect(result.skippedOverCap).toBe(5);
    expect(result.hint).toMatch(/entryIndices/);
  });

  it('errors when no entry is importable', async () => {
    await expect(call('requests_import', { format: 'har', content: har([]) })).rejects.toThrow(/no importable entries/);
    await expect(
      call('requests_import', {
        format: 'har',
        content: har([harEntry('https://api.openheaders.io/v1/a')]),
        entryIndices: [7],
      }),
    ).rejects.toThrow(/matched no entries/);
  });

  it('rejects non-HAR JSON with the parser error', async () => {
    await expect(call('requests_import', { format: 'har', content: '{"nope":true}' })).rejects.toThrow(
      /could not parse HAR/,
    );
  });
});
