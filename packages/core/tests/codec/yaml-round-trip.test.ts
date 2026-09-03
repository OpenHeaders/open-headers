/**
 * Phase 0 verification — byte-exact round-trip for every fixture in
 * `tests/fixtures/format/v1/`.
 *
 * parse(fixture) → serialize(mergePatch(parsed, identity)) should
 * produce the original bytes. This exercises preserve-unknown
 * (invariant #4) and canonical ordering (invariant #6) on a single
 * read/write hop. Any new entity codec must add a fixture + a case
 * here before it's considered landed.
 */

import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
  parseCollection,
  parseEnvironment,
  parseFolder,
  parseLiveVariable,
  parseLiveWorkflow,
  parseRequest,
  parseRule,
  parseTemplate,
  parseVault,
  parseWorkspace,
  parseWorkspaceVariables,
  serializeCollection,
  serializeEnvironment,
  serializeFolder,
  serializeLiveVariable,
  serializeLiveWorkflow,
  serializeRequest,
  serializeRule,
  serializeTemplate,
  serializeVault,
  serializeWorkspace,
  serializeWorkspaceVariables,
} from '../../src/codec/yaml';
import { mergePatch } from '../../src/schemas/document';

const FIXTURE_DIR = resolve(dirname(fileURLToPath(import.meta.url)), '../fixtures/format/v1');

function loadFixture(name: string): string {
  return readFileSync(join(FIXTURE_DIR, name), 'utf8');
}

describe('yaml codec — round-trip parity', () => {
  it('workspace.yaml', () => {
    const raw = loadFixture('workspace.yaml');
    const parsed = parseWorkspace(raw);
    expect(parsed.value.uid).toBe('a1b2c3d4');
    const write = mergePatch(parsed, () => {});
    expect(serializeWorkspace(write)).toBe(raw);
  });

  it('_collection.yaml', () => {
    const raw = loadFixture('_collection.yaml');
    const parsed = parseCollection(raw, { path: 'requests/auth-c0ll1111' });
    expect(parsed.value.uid).toBe('c0ll1111');
    expect(parsed.value.path).toBe('requests/auth-c0ll1111');
    const write = mergePatch(parsed, () => {});
    const out = serializeCollection(write);
    expect(out.collectionYaml).toBe(raw);
    expect(out.scriptFiles).toEqual([]);
  });

  it('_collection.yaml + pre-request.js + post-response.js siblings', () => {
    const raw = loadFixture('_collection.yaml');
    const pre = 'await oh.variables.set("token", "abc");\n';
    const post = 'await oh.test("status ok", oh.response.status === 200);\n';
    const parsed = parseCollection(raw, {
      path: 'requests/auth-c0ll1111',
      siblings: [
        { fileName: 'pre-request.js', content: pre },
        { fileName: 'post-response.js', content: post },
      ],
    });
    expect(parsed.value.preRequestScript).toBe(pre);
    expect(parsed.value.postResponseScript).toBe(post);
    const write = mergePatch(parsed, () => {});
    const out = serializeCollection(write);
    // Scripts never land in the manifest — the YAML stays byte-identical
    // while the source fans back out to the sibling files.
    expect(out.collectionYaml).toBe(raw);
    expect(out.scriptFiles).toEqual([
      { fileName: 'pre-request.js', content: pre },
      { fileName: 'post-response.js', content: post },
    ]);
  });

  it('_collection.yaml + session script siblings — every kind, one file per slot, the manifest untouched', () => {
    const raw = loadFixture('_collection.yaml');
    const connect = 'oh.session.attempt = (oh.session.attempt ?? 0) + 1;\n';
    const publish = 'oh.setTopic("telemetry/" + oh.message.topic);\n';
    const invoke = 'oh.setMetadata("x-trace", "1");\n';
    const parsed = parseCollection(raw, {
      path: 'requests/auth-c0ll1111',
      siblings: [
        { fileName: 'mqtt-before-publish.js', content: publish },
        { fileName: 'ws-before-connect.js', content: connect },
        { fileName: 'grpc-before-invoke.js', content: invoke },
        { fileName: 'before-connect.js', content: 'ignored();' },
      ],
    });
    expect(parsed.value.scripts).toEqual({
      'mqtt-before-publish': publish,
      'ws-before-connect': connect,
      'grpc-before-invoke': invoke,
    });
    expect(parsed.value.preRequestScript).toBeUndefined();
    const out = serializeCollection(mergePatch(parsed, () => {}));
    expect(out.collectionYaml).toBe(raw);
    // Fan-out in kind order, whatever order the siblings were listed in.
    expect(out.scriptFiles).toEqual([
      { fileName: 'grpc-before-invoke.js', content: invoke },
      { fileName: 'ws-before-connect.js', content: connect },
      { fileName: 'mqtt-before-publish.js', content: publish },
    ]);
  });

  it('_collection.yaml with ancestor auth — inline in the manifest, round-trips', () => {
    const raw = loadFixture('_collection.yaml');
    const parsed = parseCollection(raw, { path: 'requests/auth-c0ll1111' });
    const write = mergePatch(parsed, (draft) => {
      draft.auth = { type: 'bearer', token: '{{auth_token}}' };
    });
    const out = serializeCollection(write);
    // Auth is data, not script source — it lands in the YAML itself,
    // never in a sibling file.
    expect(out.collectionYaml).toContain('auth:');
    expect(out.scriptFiles).toEqual([]);
    const reparsed = parseCollection(out.collectionYaml, { path: 'requests/auth-c0ll1111' });
    expect(reparsed.value.auth).toEqual({ type: 'bearer', token: '{{auth_token}}' });
    // Clearing the field removes the key — field absent ↔ transparent level.
    const cleared = serializeCollection(
      mergePatch(reparsed, (draft) => {
        delete draft.auth;
      }),
    );
    expect(cleared.collectionYaml).toBe(raw);
  });

  it('_collection.yaml with an auth pool — entries and default inline, round-trips', () => {
    const raw = loadFixture('_collection.yaml');
    const parsed = parseCollection(raw, { path: 'requests/auth-c0ll1111' });
    const write = mergePatch(parsed, (draft) => {
      draft.auths = [
        { uid: 'auth0001', name: 'Admin token', config: { type: 'bearer', token: '{{admin}}' } },
        {
          uid: 'auth0002',
          name: 'Partner key',
          config: { type: 'api-key', key: 'X-Key', value: '{{partner}}', in: 'header' },
          appliesTo: '*.partner.openheaders.io',
        },
      ];
      draft.defaultAuthUid = 'auth0002';
    });
    const out = serializeCollection(write);
    expect(out.collectionYaml).toContain('auths:');
    expect(out.collectionYaml).toContain('defaultAuthUid: auth0002');
    const reparsed = parseCollection(out.collectionYaml, { path: 'requests/auth-c0ll1111' });
    expect(reparsed.value.auths).toEqual(write.value.auths);
    expect(reparsed.value.defaultAuthUid).toBe('auth0002');
    // Clearing the pool removes both keys — no pool ↔ transparent level.
    const cleared = serializeCollection(
      mergePatch(reparsed, (draft) => {
        delete draft.auths;
        delete draft.defaultAuthUid;
      }),
    );
    expect(cleared.collectionYaml).toBe(raw);
  });

  it('_collection.yaml with inheritable settings — one slice per kind, round-trips; an empty record is the absent key', () => {
    const raw = loadFixture('_collection.yaml');
    const parsed = parseCollection(raw, { path: 'requests/auth-c0ll1111' });
    const write = mergePatch(parsed, (draft) => {
      draft.settings = {
        mqtt: { keepAlive: 30 },
        http: { timeoutMs: 30_000, sslVerification: false, proxyMode: 'direct' },
      };
    });
    const out = serializeCollection(write);
    // Nested keys emit in the schema's order — the kinds, then each
    // slice's knobs — whatever the write's.
    expect(out.collectionYaml).toContain(
      'settings:\n  http:\n    proxyMode: direct\n    sslVerification: false\n    timeoutMs: 30000\n  mqtt:\n    keepAlive: 30',
    );
    const reparsed = parseCollection(out.collectionYaml, { path: 'requests/auth-c0ll1111' });
    expect(reparsed.value.settings).toEqual({
      http: { timeoutMs: 30_000, sslVerification: false, proxyMode: 'direct' },
      mqtt: { keepAlive: 30 },
    });
    const cleared = serializeCollection(
      mergePatch(reparsed, (draft) => {
        draft.settings = {};
      }),
    );
    expect(cleared.collectionYaml).toBe(raw);
  });

  it('_collection.yaml with specLink — inline generation bookkeeping, round-trips', () => {
    const raw = loadFixture('_collection.yaml');
    const parsed = parseCollection(raw, { path: 'requests/auth-c0ll1111' });
    const write = mergePatch(parsed, (draft) => {
      draft.specLink = { specUid: 'spec1234', sourceHash: 'sha256:0123abcd' };
    });
    const out = serializeCollection(write);
    expect(out.collectionYaml).toContain('specLink:');
    const reparsed = parseCollection(out.collectionYaml, { path: 'requests/auth-c0ll1111' });
    expect(reparsed.value.specLink).toEqual({ specUid: 'spec1234', sourceHash: 'sha256:0123abcd' });
    // Clearing removes the key — field absent ↔ not spec-generated.
    const cleared = serializeCollection(
      mergePatch(reparsed, (draft) => {
        delete draft.specLink;
      }),
    );
    expect(cleared.collectionYaml).toBe(raw);
  });

  it('_folder.yaml', () => {
    const raw = loadFixture('_folder.yaml');
    const parsed = parseFolder(raw, { path: 'requests/auth-c0ll1111/tokens-f0ld3r12' });
    expect(parsed.value.uid).toBe('f0ld3r12');
    const write = mergePatch(parsed, () => {});
    const out = serializeFolder(write);
    expect(out.folderYaml).toBe(raw);
    expect(out.scriptFiles).toEqual([]);
  });

  it('_folder.yaml + pre-request.js sibling', () => {
    const raw = loadFixture('_folder.yaml');
    const pre = 'oh.request.headers.set("X-Team", "tokens");\n';
    const parsed = parseFolder(raw, {
      path: 'requests/auth-c0ll1111/tokens-f0ld3r12',
      siblings: [{ fileName: 'pre-request.js', content: pre }],
    });
    expect(parsed.value.preRequestScript).toBe(pre);
    expect(parsed.value.postResponseScript).toBeUndefined();
    const write = mergePatch(parsed, () => {});
    const out = serializeFolder(write);
    expect(out.folderYaml).toBe(raw);
    expect(out.scriptFiles).toEqual([{ fileName: 'pre-request.js', content: pre }]);
  });

  it('_folder.yaml + an HTTP and a session script sibling side by side', () => {
    const raw = loadFixture('_folder.yaml');
    const pre = 'oh.setHeader("X-Team", "tokens");\n';
    const close = 'oh.test("clean close", () => oh.expect(oh.close.code).toBe(1000));\n';
    const parsed = parseFolder(raw, {
      path: 'requests/auth-c0ll1111/tokens-f0ld3r12',
      siblings: [
        { fileName: 'ws-after-close.js', content: close },
        { fileName: 'pre-request.js', content: pre },
      ],
    });
    expect(parsed.value.preRequestScript).toBe(pre);
    expect(parsed.value.scripts).toEqual({ 'ws-after-close': close });
    const out = serializeFolder(mergePatch(parsed, () => {}));
    expect(out.folderYaml).toBe(raw);
    expect(out.scriptFiles).toEqual([
      { fileName: 'pre-request.js', content: pre },
      { fileName: 'ws-after-close.js', content: close },
    ]);
  });

  it('_folder.yaml with ancestor auth — inline in the manifest, round-trips', () => {
    const raw = loadFixture('_folder.yaml');
    const parsed = parseFolder(raw, { path: 'requests/auth-c0ll1111/tokens-f0ld3r12' });
    const write = mergePatch(parsed, (draft) => {
      draft.auth = { type: 'api-key', key: 'X-Api-Key', value: '{{vault.api_key}}', in: 'header' };
    });
    const out = serializeFolder(write);
    expect(out.folderYaml).toContain('auth:');
    const reparsed = parseFolder(out.folderYaml, { path: 'requests/auth-c0ll1111/tokens-f0ld3r12' });
    expect(reparsed.value.auth).toEqual({
      type: 'api-key',
      key: 'X-Api-Key',
      value: '{{vault.api_key}}',
      in: 'header',
    });
    const cleared = serializeFolder(
      mergePatch(reparsed, (draft) => {
        delete draft.auth;
      }),
    );
    expect(cleared.folderYaml).toBe(raw);
  });

  it('_folder.yaml with inheritable settings — the collection contract, round-trips', () => {
    const raw = loadFixture('_folder.yaml');
    const parsed = parseFolder(raw, { path: 'requests/auth-c0ll1111/tokens-f0ld3r12' });
    const write = mergePatch(parsed, (draft) => {
      draft.settings = { websocket: { timeoutMs: 5_000, maxMessageBytes: 4_096 } };
    });
    const out = serializeFolder(write);
    expect(out.folderYaml).toContain('settings:\n  websocket:\n    timeoutMs: 5000\n    maxMessageBytes: 4096');
    const reparsed = parseFolder(out.folderYaml, { path: 'requests/auth-c0ll1111/tokens-f0ld3r12' });
    expect(reparsed.value.settings).toEqual({ websocket: { timeoutMs: 5_000, maxMessageBytes: 4_096 } });
    const cleared = serializeFolder(
      mergePatch(reparsed, (draft) => {
        delete draft.settings;
      }),
    );
    expect(cleared.folderYaml).toBe(raw);
  });

  const ruleFixtures = readdirSync(FIXTURE_DIR).filter((f) => f.startsWith('rule-') && f.endsWith('.yaml'));

  for (const fixture of ruleFixtures) {
    it(fixture, () => {
      const raw = loadFixture(fixture);
      const parsed = parseRule(raw, { path: `rules/demo-rule000${ruleFixtures.indexOf(fixture)}` });
      const write = mergePatch(parsed, () => {});
      expect(serializeRule(write)).toBe(raw);
    });
  }

  it('template.yaml', () => {
    const raw = loadFixture('template.yaml');
    const parsed = parseTemplate(raw, { path: 'templates/bearer-tmpl0001' });
    expect(parsed.value.uid).toBe('tmpl0001');
    const write = mergePatch(parsed, () => {});
    expect(serializeTemplate(write)).toBe(raw);
  });

  it('workspace-vars.yaml', () => {
    const raw = loadFixture('workspace-vars.yaml');
    const parsed = parseWorkspaceVariables(raw);
    expect(parsed.value.variables).toHaveLength(2);
    const write = mergePatch(parsed, () => {});
    expect(serializeWorkspaceVariables(write)).toBe(raw);
  });

  it('workspace-vars.secret.yaml (vault)', () => {
    const raw = loadFixture('workspace-vars.secret.yaml');
    const parsed = parseVault(raw);
    expect(parsed.value.secrets).toHaveLength(2);
    const write = mergePatch(parsed, () => {});
    expect(serializeVault(write)).toBe(raw);
  });

  it('environment — default + secret merge + round-trip', () => {
    const defaultYaml = loadFixture('environment-default.yaml');
    const secretYaml = loadFixture('environment-secret.yaml');
    const parsed = parseEnvironment({ default: defaultYaml, secret: secretYaml });
    expect(parsed.value.uid).toBe('env00001');
    expect(parsed.value.variables.map((x) => x.type).sort()).toEqual(['default', 'default', 'secret', 'secret']);
    const write = mergePatch(parsed, () => {});
    const out = serializeEnvironment(write);
    expect(out.default).toBe(defaultYaml);
    expect(out.secret).toBe(secretYaml);
    expect(out.template).toContain('value: ""'); // template has blanked values
  });

  it('live-workflow-single.yaml', () => {
    const raw = loadFixture('live-workflow-single.yaml');
    const parsed = parseLiveWorkflow(raw, { path: 'live-workflows/debug-auth-wflow001' });
    expect(parsed.value.uid).toBe('wflow001');
    expect(parsed.value.steps).toHaveLength(1);
    expect(parsed.value.refresh.kind).toBe('expires-in');
    const write = mergePatch(parsed, () => {});
    expect(serializeLiveWorkflow(write)).toBe(raw);
  });

  it('live-workflow-chain.yaml', () => {
    const raw = loadFixture('live-workflow-chain.yaml');
    const parsed = parseLiveWorkflow(raw, { path: 'live-workflows/csrf-chain-wflow002' });
    expect(parsed.value.uid).toBe('wflow002');
    expect(parsed.value.steps).toHaveLength(3);
    expect(parsed.value.steps.map((s) => s.id)).toEqual(['login', 'csrf', 'finalize']);
    const write = mergePatch(parsed, () => {});
    expect(serializeLiveWorkflow(write)).toBe(raw);
  });

  // ── Phase I — DAG fixtures ───────────────────────────────────────
  it('live-workflow-dag-linear.yaml (explicit dependsOn reproduces linear semantics)', () => {
    const raw = loadFixture('live-workflow-dag-linear.yaml');
    const parsed = parseLiveWorkflow(raw, { path: 'live-workflows/explicit-linear-wfdaglin' });
    expect(parsed.value.uid).toBe('wfdaglin');
    expect(parsed.value.steps).toHaveLength(3);
    expect(parsed.value.steps[1].dependsOn).toEqual(['probe']);
    expect(parsed.value.steps[2].dependsOn).toEqual(['introspect']);
    const write = mergePatch(parsed, () => {});
    expect(serializeLiveWorkflow(write)).toBe(raw);
  });

  it('live-workflow-dag-branching.yaml (probe + two conditional siblings)', () => {
    const raw = loadFixture('live-workflow-dag-branching.yaml');
    const parsed = parseLiveWorkflow(raw, { path: 'live-workflows/probe-branching-wfdagbrn' });
    expect(parsed.value.uid).toBe('wfdagbrn');
    expect(parsed.value.steps).toHaveLength(3);
    expect(parsed.value.steps[1].runIf?.all).toHaveLength(2);
    expect(parsed.value.steps[1].runIf?.all[0].kind).toBe('status');
    expect(parsed.value.steps[2].runIf?.all[1].kind).toBe('capture-equals');
    const write = mergePatch(parsed, () => {});
    expect(serializeLiveWorkflow(write)).toBe(raw);
  });

  it('live-workflow-dag-priority.yaml (priorityFrom reorders ready-set)', () => {
    const raw = loadFixture('live-workflow-dag-priority.yaml');
    const parsed = parseLiveWorkflow(raw, { path: 'live-workflows/priority-refresh-wfdagprt' });
    expect(parsed.value.uid).toBe('wfdagprt');
    expect(parsed.value.steps).toHaveLength(3);
    expect(parsed.value.steps[1].priorityFrom?.captureName).toBe('tokenStaleness');
    expect(parsed.value.steps[2].priorityFrom?.captureName).toBe('sessionStaleness');
    const write = mergePatch(parsed, () => {});
    expect(serializeLiveWorkflow(write)).toBe(raw);
  });

  it('live-workflow-dag-fan-in.yaml (two roots + one descendant)', () => {
    const raw = loadFixture('live-workflow-dag-fan-in.yaml');
    const parsed = parseLiveWorkflow(raw, { path: 'live-workflows/fan-in-wfdagfan' });
    expect(parsed.value.uid).toBe('wfdagfan');
    expect(parsed.value.steps).toHaveLength(3);
    expect(parsed.value.steps[0].dependsOn).toEqual([]);
    expect(parsed.value.steps[1].dependsOn).toEqual([]);
    expect(parsed.value.steps[2].dependsOn).toEqual(['fetchUser', 'fetchTeam']);
    const write = mergePatch(parsed, () => {});
    expect(serializeLiveWorkflow(write)).toBe(raw);
  });

  it('live-variable-primary.yaml (bound to single-step workflow)', () => {
    const raw = loadFixture('live-variable-primary.yaml');
    const parsed = parseLiveVariable(raw, { path: 'live-variables/debug-auth-livvar01' });
    expect(parsed.value.uid).toBe('livvar01');
    expect(parsed.value.name).toBe('debugAuth');
    expect(parsed.value.workflowUid).toBe('wflow001');
    expect(parsed.value.stepId).toBe('fetch-token');
    expect(parsed.value.captureName).toBe('access_token');
    const write = mergePatch(parsed, () => {});
    expect(serializeLiveVariable(write)).toBe(raw);
  });

  it('live-variable-with-override.yaml (sync-warm + manual override)', () => {
    const raw = loadFixture('live-variable-with-override.yaml');
    const parsed = parseLiveVariable(raw, { path: 'live-variables/final-auth-livvar02' });
    expect(parsed.value.uid).toBe('livvar02');
    expect(parsed.value.requireFreshOnRuleBuild).toBe(true);
    expect(parsed.value.manualOverride?.value).toBe('repro-token-for-issue-4242');
    expect(parsed.value.manualOverride?.until).toBe(1780272000000);
    const write = mergePatch(parsed, () => {});
    expect(serializeLiveVariable(write)).toBe(raw);
  });

  it('request.yaml + body.json + pre-request.js + post-response.js', () => {
    const raw = loadFixture('request.yaml');
    const bodyJson = loadFixture('request-body.json');
    const preScript = loadFixture('request-pre-request.js');
    const postResponseScript = loadFixture('request-post-response.js');
    const parsed = parseRequest(raw, {
      path: 'requests/auth-c0ll1111/login-reqlogin',
      siblings: [
        { fileName: 'body.json', content: bodyJson },
        { fileName: 'pre-request.js', content: preScript },
        { fileName: 'post-response.js', content: postResponseScript },
      ],
    });
    expect(parsed.value.body.type).toBe('json');
    expect(parsed.value.specLink).toEqual({ specUid: 'spec0001' });
    if (parsed.value.body.type !== 'json') throw new Error('expected json body');
    expect(parsed.value.body.content).toBe(bodyJson);
    expect(parsed.value.sslVerification).toBe(false);
    expect(parsed.value.tlsMinVersion).toBe('1.1');
    expect(parsed.value.tlsMaxVersion).toBe('1.2');
    expect(parsed.value.tlsCipherSuites).toBe('TLS_AES_128_GCM_SHA256:ECDHE-RSA-AES128-GCM-SHA256');
    expect(parsed.value.httpVersion).toBe('2');
    expect(parsed.value.resolveToAddress).toBe('10.0.0.7');
    expect(parsed.value.clientCertificateRef).toBe('gateway-mtls');
    expect(parsed.value.proxyMode).toBe('url');
    expect(parsed.value.proxyUrl).toBe('http://proxy.openheaders.io:3128');
    expect(parsed.value.proxyCredentialRef).toBe('corp-proxy');
    expect(parsed.value.unixSocketPath).toBe('/var/run/openheaders/api.sock');
    expect(parsed.value.cookieJar).toBe(true);
    expect(parsed.value.timeoutMs).toBe(15000);
    expect(parsed.value.maxResponseBytes).toBe(4096);
    expect(parsed.value.maxRedirects).toBe(5);
    expect(parsed.value.followOriginalHttpMethod).toBe(true);
    expect(parsed.value.followAuthorizationHeader).toBe(true);
    expect(parsed.value.preRequestScript).toBe(preScript);
    expect(parsed.value.postResponseScript).toBe(postResponseScript);

    const write = mergePatch(parsed, () => {});
    const out = serializeRequest(write);
    expect(out.requestYaml).toBe(raw);
    expect(out.bodyFile).toEqual({ fileName: 'body.json', content: bodyJson });
    expect(out.preRequestScript).toEqual({ fileName: 'pre-request.js', content: preScript });
    expect(out.postResponseScript).toEqual({ fileName: 'post-response.js', content: postResponseScript });
    expect(out.variablesFile).toBeNull();
  });
});
