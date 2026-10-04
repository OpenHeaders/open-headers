/**
 * Behavior of `scripts/update-feed-redirect.mjs` — the sweep step that
 * keeps the feed zone's Redirect Rule naming the kept tags. Run as a
 * child process against a stub of the Cloudflare rulesets API so the
 * create, update, unchanged and dry-run branches are each observed as
 * the requests they make.
 */

import { execFile } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { createServer, type Server } from 'node:http';
import { tmpdir } from 'node:os';
import * as path from 'node:path';
import { promisify } from 'node:util';
import { afterEach, describe, expect, it } from 'vitest';

const SCRIPT = path.resolve(__dirname, '../../../../../scripts/update-feed-redirect.mjs');
const DESCRIPTION = 'feed: dl/ downloads outside retention go to the GitHub release page';
const EXPRESSION =
  'starts_with(http.request.uri.path, "/dl/") and not starts_with(http.request.uri.path, "/dl/v2026.10.0/")';
const TARGET = `wildcard_replace(http.request.uri.path, "/dl/*", "https://github.com/OpenHeaders/open-headers/releases/download/\${1}")`;

type Request = { method: string; url: string; body: unknown };

let workDir: string;
let server: Server | undefined;

function ourRule(expression = EXPRESSION, target = TARGET) {
  return {
    id: 'rule-1',
    description: DESCRIPTION,
    expression,
    action: 'redirect',
    enabled: true,
    action_parameters: {
      from_value: { status_code: 302, target_url: { expression: target }, preserve_query_string: false },
    },
  };
}

async function stub(
  entrypoint: { id: string; rules: unknown[] } | undefined,
): Promise<{ base: string; requests: Request[] }> {
  const requests: Request[] = [];
  server = createServer((request, response) => {
    let raw = '';
    request.on('data', (chunk) => {
      raw += chunk;
    });
    request.on('end', () => {
      requests.push({ method: request.method ?? '', url: request.url ?? '', body: raw ? JSON.parse(raw) : undefined });
      const isEntrypoint = request.method === 'GET' && request.url?.endsWith('/entrypoint');
      if (isEntrypoint && !entrypoint) {
        response.writeHead(404, { 'content-type': 'application/json' });
        response.end(JSON.stringify({ success: false, errors: [{ code: 10000, message: 'not found' }] }));
        return;
      }
      response.writeHead(200, { 'content-type': 'application/json' });
      const result = isEntrypoint ? entrypoint : { id: 'ruleset-new', rules: [{ ...ourRule(), id: 'rule-new' }] };
      response.end(JSON.stringify({ success: true, result }));
    });
  });
  await new Promise<void>((resolve) => server?.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('stub did not bind');
  return { base: `http://127.0.0.1:${address.port}`, requests };
}

const execFileAsync = promisify(execFile);

/**
 * The script is spawned asynchronously on purpose: the stub API lives
 * in this process, and a blocking spawn would never let it answer.
 */
async function run(base: string, flags: string[] = []): Promise<string> {
  workDir = mkdtempSync(path.join(tmpdir(), 'oh-feed-redirect-'));
  const planFile = path.join(workDir, 'plan.json');
  writeFileSync(
    planFile,
    JSON.stringify({ redirect: { expression: EXPRESSION, targetExpression: TARGET, statusCode: 302 } }),
  );
  const { stdout } = await execFileAsync(process.execPath, [SCRIPT, '--plan', planFile, ...flags], {
    encoding: 'utf8',
    env: { ...process.env, CF_ZONE_ID: 'zone-1', CF_API_TOKEN: 'token', CF_API_BASE: base },
  });
  return stdout;
}

afterEach(async () => {
  rmSync(workDir, { recursive: true, force: true });
  await new Promise<void>((resolve) => (server ? server.close(() => resolve()) : resolve()));
  server = undefined;
});

describe('update-feed-redirect', () => {
  it('creates the phase ruleset with the rule when the zone has none', async () => {
    const { base, requests } = await stub(undefined);
    const out = await run(base);

    expect(requests.map((r) => `${r.method} ${r.url}`)).toEqual([
      'GET /zones/zone-1/rulesets/phases/http_request_dynamic_redirect/entrypoint',
      'POST /zones/zone-1/rulesets',
    ]);
    const body = requests[1].body as { phase: string; rules: Array<{ description: string; expression: string }> };
    expect(body.phase).toBe('http_request_dynamic_redirect');
    expect(body.rules).toHaveLength(1);
    expect(body.rules[0].description).toBe(DESCRIPTION);
    expect(body.rules[0].expression).toBe(EXPRESSION);
    expect(out).toContain('created in new ruleset ruleset-new');
  });

  it('adds the rule beside the existing ones when the phase has no rule of ours', async () => {
    const other = {
      id: 'rule-other',
      description: 'root to the website',
      expression: 'http.request.uri.path eq "/"',
      action: 'redirect',
    };
    const { base, requests } = await stub({ id: 'ruleset-1', rules: [other] });
    await run(base);

    expect(requests.map((r) => `${r.method} ${r.url}`)).toEqual([
      'GET /zones/zone-1/rulesets/phases/http_request_dynamic_redirect/entrypoint',
      'POST /zones/zone-1/rulesets/ruleset-1/rules',
    ]);
    const body = requests[1].body as {
      description: string;
      action_parameters: { from_value: { target_url: { expression: string } } };
    };
    expect(body.description).toBe(DESCRIPTION);
    expect(body.action_parameters.from_value.target_url.expression).toBe(TARGET);
  });

  it('patches only our rule when the kept tags changed', async () => {
    const stale = ourRule(
      'starts_with(http.request.uri.path, "/dl/") and not starts_with(http.request.uri.path, "/dl/v2026.9.2/")',
    );
    const { base, requests } = await stub({
      id: 'ruleset-1',
      rules: [{ id: 'rule-other', description: 'root' }, stale],
    });
    const out = await run(base);

    expect(requests.map((r) => `${r.method} ${r.url}`)).toEqual([
      'GET /zones/zone-1/rulesets/phases/http_request_dynamic_redirect/entrypoint',
      'PATCH /zones/zone-1/rulesets/ruleset-1/rules/rule-1',
    ]);
    expect((requests[1].body as { expression: string }).expression).toBe(EXPRESSION);
    expect(out).toContain('updated (rule-1)');
  });

  it('writes nothing when the live rule already matches', async () => {
    const { base, requests } = await stub({ id: 'ruleset-1', rules: [ourRule()] });
    const out = await run(base);

    expect(requests).toHaveLength(1);
    expect(out).toContain('unchanged (rule-1)');
  });

  it('only reads under --dry-run', async () => {
    const { base, requests } = await stub({ id: 'ruleset-1', rules: [ourRule('http.request.uri.path eq "/stale"')] });
    const out = await run(base, ['--dry-run']);

    expect(requests).toHaveLength(1);
    expect(out).toContain('dry run: would update rule rule-1');
    expect(out).toContain(EXPRESSION);
  });

  it('fails on an API error instead of continuing', async () => {
    const failing = createServer((_request, response) => {
      response.writeHead(400, { 'content-type': 'application/json' });
      response.end(JSON.stringify({ success: false, errors: [{ code: 20002, message: 'invalid expression' }] }));
    });
    server = failing;
    await new Promise<void>((resolve) => failing.listen(0, '127.0.0.1', resolve));
    const address = failing.address();
    if (!address || typeof address === 'string') throw new Error('stub did not bind');

    await expect(run(`http://127.0.0.1:${address.port}`)).rejects.toThrow(/20002: invalid expression/);
  });
});
