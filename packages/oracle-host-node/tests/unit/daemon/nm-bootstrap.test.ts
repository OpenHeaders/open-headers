/**
 * Phase 7 — NM identity bootstrap. Three layers:
 *
 *   - OS-output parsers, both platforms (lsof/Get-NetTCPConnection
 *     owner-pid with direction pinning + self-pid skip,
 *     ps/Win32_Process executable + parent, codesign TeamIdentifier
 *     incl. the ad-hoc `not set` shape, Authenticode status + subject
 *     CN incl. quoted-comma DN values);
 *   - `verifyNmCaller` over an injected command runner — the full
 *     happy chain and every typed refusal link on macOS and Windows;
 *   - the `/nm/bootstrap` HTTP handler over a real loopback server
 *     with an injected verifier — fall-through, POST-only, the
 *     nmSession mint against the real token ledger, predecessor
 *     revocation + live-peer eviction keyed on installId, and the
 *     coarse refused/unsupported wire shapes.
 */

import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { mintDaemonAuthToken, peekDaemonAuthToken } from '@openheaders/core/identity';
import { setHostLogger } from '@openheaders/core/logger';
import { setHostStorage } from '@openheaders/core/storage';
import { logger as consoleLogger } from '@openheaders/core/utils';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createNmBootstrapHttpHandler, NM_BOOTSTRAP_PATH } from '../../../src/daemon/nm/nm-bootstrap-http';
import {
  type CommandResult,
  type CommandRunner,
  type NmCallerVerification,
  parseAuthenticodeIdentity,
  parseCodesignTeamId,
  parseDnCommonName,
  parseLsofOwnerPid,
  parseNetTcpOwnerPid,
  parsePsProcessInfo,
  parseWin32ProcessInfo,
  type VerifyNmCallerOptions,
  verifyNmCaller,
} from '../../../src/daemon/nm/process-identity';

const HOST_PATH = '/Applications/OpenHeaders.app/Contents/Resources/nm-host/oh-nm-host';
const CHROME_PATH = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';

describe('parseLsofOwnerPid', () => {
  const output = ['p777', 'n127.0.0.1:59210->127.0.0.1:53312', 'p888', 'n127.0.0.1:53312->127.0.0.1:59210'].join('\n');

  it('pins the pid whose LOCAL side is the client port, not the daemon mirror row', () => {
    expect(parseLsofOwnerPid(output, 53312, undefined)).toBe(888);
  });

  it('skips the daemon self pid even when its row would match', () => {
    const selfOnly = ['p777', 'n127.0.0.1:53312->127.0.0.1:59210'].join('\n');
    expect(parseLsofOwnerPid(selfOnly, 53312, 777)).toBeNull();
  });

  it('answers null when no local side carries the client port', () => {
    expect(parseLsofOwnerPid(output, 60000, undefined)).toBeNull();
  });
});

describe('parsePsProcessInfo', () => {
  it('splits ppid from a comm path containing spaces', () => {
    expect(parsePsProcessInfo(`  555 ${CHROME_PATH}\n`)).toEqual({ ppid: 555, executablePath: CHROME_PATH });
  });

  it('answers null on empty or malformed output', () => {
    expect(parsePsProcessInfo('')).toBeNull();
    expect(parsePsProcessInfo('   \n')).toBeNull();
    expect(parsePsProcessInfo('notanumber')).toBeNull();
  });
});

describe('parseCodesignTeamId', () => {
  it('extracts the team identifier line', () => {
    expect(parseCodesignTeamId('Identifier=com.google.Chrome\nTeamIdentifier=EQHXZ8M8AV\n')).toBe('EQHXZ8M8AV');
  });

  it('treats the ad-hoc `not set` shape and absence as null', () => {
    expect(parseCodesignTeamId('TeamIdentifier=not set\n')).toBeNull();
    expect(parseCodesignTeamId('Identifier=whatever\n')).toBeNull();
  });
});

interface FakeChainConfig {
  ownerPid?: number;
  hostPath?: string;
  browserPath?: string;
  browserTeamId?: string;
  browserVerifyExit?: number;
}

function fakeRunner(config: FakeChainConfig = {}): CommandRunner {
  const ownerPid = config.ownerPid ?? 888;
  const hostPath = config.hostPath ?? HOST_PATH;
  const browserPath = config.browserPath ?? CHROME_PATH;
  const teamId = config.browserTeamId ?? 'EQHXZ8M8AV';
  return async (file, args): Promise<CommandResult> => {
    if (file === 'lsof') {
      const rows = ['p777', 'n127.0.0.1:59210->127.0.0.1:53312', `p${ownerPid}`, 'n127.0.0.1:53312->127.0.0.1:59210'];
      return { stdout: rows.join('\n'), stderr: '', code: 0 };
    }
    if (file === 'ps') {
      const pid = args[1];
      if (pid === String(ownerPid)) return { stdout: ` 555 ${hostPath}\n`, stderr: '', code: 0 };
      if (pid === '555') return { stdout: `   1 ${browserPath}\n`, stderr: '', code: 0 };
      return { stdout: '', stderr: '', code: 1 };
    }
    if (file === 'codesign' && args[0] === '--verify') {
      return { stdout: '', stderr: '', code: config.browserVerifyExit ?? 0 };
    }
    if (file === 'codesign') {
      return { stdout: '', stderr: `Identifier=x\nTeamIdentifier=${teamId}\n`, code: 0 };
    }
    return { stdout: '', stderr: '', code: 127 };
  };
}

function callerOptions(run: CommandRunner, overrides: Partial<VerifyNmCallerOptions> = {}): VerifyNmCallerOptions {
  return {
    clientAddress: '::ffff:127.0.0.1',
    clientPort: 53312,
    expectedHostPath: HOST_PATH,
    requireHostSignature: false,
    selfPid: 777,
    platform: 'darwin',
    run,
    ...overrides,
  };
}

describe('verifyNmCaller', () => {
  it('walks the full chain: socket owner → host path → browser signer', async () => {
    const verdict = await verifyNmCaller(callerOptions(fakeRunner()));
    expect(verdict).toEqual({
      ok: true,
      browser: { teamId: 'EQHXZ8M8AV', name: 'Google Chrome' },
      browserPath: CHROME_PATH,
    });
  });

  it('refuses platforms without a probe set as unsupported', async () => {
    const verdict = await verifyNmCaller(callerOptions(fakeRunner(), { platform: 'linux' }));
    expect(verdict.ok).toBe(false);
    if (!verdict.ok) expect(verdict.reason).toBe('platform-unsupported');
  });

  it('refuses when no socket owner matches the client port', async () => {
    const verdict = await verifyNmCaller(callerOptions(fakeRunner(), { clientPort: 60000 }));
    expect(verdict.ok).toBe(false);
    if (!verdict.ok) expect(verdict.reason).toBe('owner-not-found');
  });

  it('refuses a socket owner that is not the shipped NM host', async () => {
    const verdict = await verifyNmCaller(callerOptions(fakeRunner({ hostPath: '/tmp/impostor' })));
    expect(verdict.ok).toBe(false);
    if (!verdict.ok) expect(verdict.reason).toBe('host-mismatch');
  });

  it('requires a signed host binary when the packaged posture asks for it', async () => {
    const run: CommandRunner = async (file, args) => {
      if (file === 'codesign' && args[0] === '--verify' && args[1] === HOST_PATH) {
        return { stdout: '', stderr: 'invalid signature', code: 1 };
      }
      return fakeRunner()(file, args);
    };
    const verdict = await verifyNmCaller(callerOptions(run, { requireHostSignature: true }));
    expect(verdict.ok).toBe(false);
    if (!verdict.ok) expect(verdict.reason).toBe('host-unsigned');
  });

  it('refuses an unsigned parent browser', async () => {
    const verdict = await verifyNmCaller(callerOptions(fakeRunner({ browserVerifyExit: 1 })));
    expect(verdict.ok).toBe(false);
    if (!verdict.ok) expect(verdict.reason).toBe('browser-unverified');
  });

  it('refuses a parent signed by an unlisted team', async () => {
    const verdict = await verifyNmCaller(callerOptions(fakeRunner({ browserTeamId: 'ZZZZ99ZZ99' })));
    expect(verdict.ok).toBe(false);
    if (!verdict.ok) expect(verdict.reason).toBe('browser-unverified');
  });
});

// ── Windows chain ────────────────────────────────────────────────────

const WIN_HOST_PATH = 'C:\\Program Files\\OpenHeaders\\resources\\nm-host\\oh-nm-host.exe';
const WIN_EDGE_PATH = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const WIN_EDGE_SUBJECT = 'CN=Microsoft Corporation, O=Microsoft Corporation, L=Redmond, S=Washington, C=US';

describe('parseNetTcpOwnerPid', () => {
  const rows = JSON.stringify([
    { LocalPort: 8137, OwningProcess: 777 },
    { LocalPort: 53312, OwningProcess: 4242 },
  ]);

  it('pins the pid whose LOCAL port is the client port, not the daemon mirror row', () => {
    expect(parseNetTcpOwnerPid(rows, 53312, undefined)).toBe(4242);
  });

  it('handles the bare-object shape ConvertTo-Json emits for one row', () => {
    expect(parseNetTcpOwnerPid(JSON.stringify({ LocalPort: 53312, OwningProcess: 4242 }), 53312, undefined)).toBe(4242);
  });

  it('skips the daemon self pid even when its row would match', () => {
    expect(parseNetTcpOwnerPid(JSON.stringify({ LocalPort: 53312, OwningProcess: 777 }), 53312, 777)).toBeNull();
  });

  it('answers null on empty, unmatched, or malformed output', () => {
    expect(parseNetTcpOwnerPid('', 53312, undefined)).toBeNull();
    expect(parseNetTcpOwnerPid(rows, 60000, undefined)).toBeNull();
    expect(parseNetTcpOwnerPid('not json', 53312, undefined)).toBeNull();
  });
});

describe('parseWin32ProcessInfo', () => {
  it('reads parent pid and executable path from the projected row', () => {
    const row = JSON.stringify({ ParentProcessId: 555, ExecutablePath: WIN_EDGE_PATH });
    expect(parseWin32ProcessInfo(row)).toEqual({ ppid: 555, executablePath: WIN_EDGE_PATH });
  });

  it('answers null when the path is absent (protected process) or output is empty', () => {
    expect(parseWin32ProcessInfo(JSON.stringify({ ParentProcessId: 555, ExecutablePath: null }))).toBeNull();
    expect(parseWin32ProcessInfo('')).toBeNull();
  });
});

describe('parseDnCommonName', () => {
  it('extracts a plain CN attribute', () => {
    expect(parseDnCommonName(WIN_EDGE_SUBJECT)).toBe('Microsoft Corporation');
  });

  it('unwraps a quoted CN containing commas', () => {
    expect(parseDnCommonName('CN="Brave Software, Inc.", O="Brave Software, Inc.", C=US')).toBe('Brave Software, Inc.');
  });

  it('finds CN when it is not the leading attribute', () => {
    expect(parseDnCommonName('O=Google LLC, CN=Google LLC, C=US')).toBe('Google LLC');
  });

  it('answers null when no CN attribute exists', () => {
    expect(parseDnCommonName('O=Somebody, C=US')).toBeNull();
  });
});

describe('parseAuthenticodeIdentity', () => {
  it('carries the subject CN only for a Valid verdict', () => {
    const valid = JSON.stringify({ Status: 'Valid', Subject: WIN_EDGE_SUBJECT });
    expect(parseAuthenticodeIdentity(valid)).toEqual({ valid: true, subjectCommonName: 'Microsoft Corporation' });
    const notSigned = JSON.stringify({ Status: 'NotSigned', Subject: null });
    expect(parseAuthenticodeIdentity(notSigned)).toEqual({ valid: false, subjectCommonName: null });
    const hashMismatch = JSON.stringify({ Status: 'HashMismatch', Subject: WIN_EDGE_SUBJECT });
    expect(parseAuthenticodeIdentity(hashMismatch)).toEqual({ valid: false, subjectCommonName: null });
  });

  it('answers null on empty or malformed output', () => {
    expect(parseAuthenticodeIdentity('')).toBeNull();
    expect(parseAuthenticodeIdentity('not json')).toBeNull();
  });
});

interface WindowsChainConfig {
  ownerPid?: number;
  hostPath?: string;
  hostStatus?: string;
  browserPath?: string;
  browserStatus?: string;
  browserSubject?: string;
}

function windowsRunner(config: WindowsChainConfig = {}): CommandRunner {
  const ownerPid = config.ownerPid ?? 4242;
  const hostPath = config.hostPath ?? WIN_HOST_PATH;
  const browserPath = config.browserPath ?? WIN_EDGE_PATH;
  return async (file, args): Promise<CommandResult> => {
    if (file !== 'powershell.exe') return { stdout: '', stderr: '', code: 127 };
    const script = args[3];
    if (script.startsWith('Get-NetTCPConnection')) {
      const rows = [
        { LocalPort: 8137, OwningProcess: 777 },
        { LocalPort: 53312, OwningProcess: ownerPid },
      ];
      return { stdout: JSON.stringify(rows), stderr: '', code: 0 };
    }
    if (script.startsWith('Get-CimInstance')) {
      if (script.includes(`ProcessId = ${ownerPid}`)) {
        return { stdout: JSON.stringify({ ParentProcessId: 555, ExecutablePath: hostPath }), stderr: '', code: 0 };
      }
      if (script.includes('ProcessId = 555')) {
        return { stdout: JSON.stringify({ ParentProcessId: 1, ExecutablePath: browserPath }), stderr: '', code: 0 };
      }
      return { stdout: '', stderr: '', code: 0 };
    }
    if (script.startsWith('$sig = Get-AuthenticodeSignature')) {
      const isHost = script.includes(hostPath.replace(/'/g, "''"));
      const status = isHost ? (config.hostStatus ?? 'Valid') : (config.browserStatus ?? 'Valid');
      const subject = isHost ? 'CN=Open Headers, O=Open Headers, C=US' : (config.browserSubject ?? WIN_EDGE_SUBJECT);
      return { stdout: JSON.stringify({ Status: status, Subject: subject }), stderr: '', code: 0 };
    }
    return { stdout: '', stderr: '', code: 1 };
  };
}

function windowsOptions(run: CommandRunner, overrides: Partial<VerifyNmCallerOptions> = {}): VerifyNmCallerOptions {
  return {
    clientAddress: '::ffff:127.0.0.1',
    clientPort: 53312,
    expectedHostPath: WIN_HOST_PATH,
    requireHostSignature: false,
    selfPid: 777,
    platform: 'win32',
    run,
    ...overrides,
  };
}

describe('verifyNmCaller on win32', () => {
  it('walks the full chain: socket owner → host path → browser Authenticode signer', async () => {
    const verdict = await verifyNmCaller(windowsOptions(windowsRunner()));
    expect(verdict).toEqual({
      ok: true,
      browser: { subjectCommonName: 'Microsoft Corporation', name: 'Microsoft Edge' },
      browserPath: WIN_EDGE_PATH,
    });
  });

  it('compares host paths case-insensitively', async () => {
    const verdict = await verifyNmCaller(
      windowsOptions(windowsRunner({ hostPath: WIN_HOST_PATH.toUpperCase() }), {
        expectedHostPath: WIN_HOST_PATH.toLowerCase(),
      }),
    );
    // The runner keys signature answers off the exact reported path, so
    // only the path-equality leg is under test here.
    expect(verdict.ok).toBe(true);
  });

  it('refuses when no socket owner matches the client port', async () => {
    const verdict = await verifyNmCaller(windowsOptions(windowsRunner(), { clientPort: 60000 }));
    expect(verdict.ok).toBe(false);
    if (!verdict.ok) expect(verdict.reason).toBe('owner-not-found');
  });

  it('refuses a socket owner that is not the shipped NM host', async () => {
    const verdict = await verifyNmCaller(windowsOptions(windowsRunner({ hostPath: 'C:\\Temp\\impostor.exe' })));
    expect(verdict.ok).toBe(false);
    if (!verdict.ok) expect(verdict.reason).toBe('host-mismatch');
  });

  it('requires a Valid Authenticode host signature when the signed posture asks for it', async () => {
    const run = windowsRunner({ hostStatus: 'NotSigned' });
    const refused = await verifyNmCaller(windowsOptions(run, { requireHostSignature: true }));
    expect(refused.ok).toBe(false);
    if (!refused.ok) expect(refused.reason).toBe('host-unsigned');
    // The unsigned-channel posture skips only the host's own check.
    const allowed = await verifyNmCaller(windowsOptions(run, { requireHostSignature: false }));
    expect(allowed.ok).toBe(true);
  });

  it('refuses an unsigned or tampered parent browser', async () => {
    const verdict = await verifyNmCaller(windowsOptions(windowsRunner({ browserStatus: 'HashMismatch' })));
    expect(verdict.ok).toBe(false);
    if (!verdict.ok) expect(verdict.reason).toBe('browser-unverified');
  });

  it('refuses a parent signed by an unlisted vendor', async () => {
    const verdict = await verifyNmCaller(windowsOptions(windowsRunner({ browserSubject: 'CN=Some Other Corp, C=US' })));
    expect(verdict.ok).toBe(false);
    if (!verdict.ok) expect(verdict.reason).toBe('browser-unverified');
  });
});

describe('nm bootstrap HTTP handler', () => {
  let server: Server;
  let baseUrl: string;
  let verdict: NmCallerVerification;
  let seenOptions: VerifyNmCallerOptions | null;
  let closedTokenIds: string[];

  beforeEach(async () => {
    setHostLogger(consoleLogger);
    const { createHostStorageFake } = await import('../_host-storage-fake');
    setHostStorage(createHostStorageFake());
    verdict = { ok: true, browser: { name: 'Google Chrome' }, browserPath: CHROME_PATH };
    seenOptions = null;
    closedTokenIds = [];
    const handler = createNmBootstrapHttpHandler({
      hostBinaryPath: HOST_PATH,
      requireHostSignature: true,
      closePeersByTokenId: (tokenId) => closedTokenIds.push(tokenId),
      verify: async (options) => {
        seenOptions = options;
        return verdict;
      },
    });
    server = createServer((req, res) => {
      if (handler(req, res)) return;
      res.statusCode = 400;
      res.end('fallback');
    });
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
    baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  });

  afterEach(async () => {
    await new Promise<void>((resolve, reject) => {
      server.close((err) => (err ? reject(err) : resolve()));
    });
  });

  it('ignores other paths so the caller chain falls through', async () => {
    const response = await fetch(`${baseUrl}/healthz`);
    expect(response.status).toBe(400);
    expect(await response.text()).toBe('fallback');
  });

  it('405s non-POST methods', async () => {
    const response = await fetch(`${baseUrl}${NM_BOOTSTRAP_PATH}`);
    expect(response.status).toBe(405);
    expect(response.headers.get('allow')).toBe('POST');
  });

  it('mints a labeled nmSession token for a verified caller, passing the socket facts to the chain', async () => {
    const response = await fetch(`${baseUrl}${NM_BOOTSTRAP_PATH}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ installId: 'install-abc' }),
    });
    expect(response.status).toBe(200);
    const body = (await response.json()) as { ok: boolean; secret: string; tokenId: string; browser: string };
    expect(body.ok).toBe(true);
    expect(body.browser).toBe('Google Chrome');
    expect(seenOptions).not.toBeNull();
    expect(seenOptions?.expectedHostPath).toBe(HOST_PATH);
    expect(seenOptions?.requireHostSignature).toBe(true);
    expect(typeof seenOptions?.clientPort).toBe('number');
    const ledger = await peekDaemonAuthToken(body.secret);
    expect(ledger.ok).toBe(true);
    if (ledger.ok) {
      expect(ledger.tokenId).toBe(body.tokenId);
      // Per-profile suffix from the install id (first 4 alphanumerics).
      expect(ledger.label).toBe('NM: Google Chrome · inst');
    }
  });

  it('derives the label suffix from the uuid behind the ext- prefix', async () => {
    const response = await fetch(`${baseUrl}${NM_BOOTSTRAP_PATH}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ installId: 'ext-3f2a91c4-0000-4000-8000-000000000000' }),
    });
    expect(response.status).toBe(200);
    const body = (await response.json()) as { ok: boolean; secret: string };
    const ledger = await peekDaemonAuthToken(body.secret);
    expect(ledger.ok).toBe(true);
    if (ledger.ok) expect(ledger.label).toBe('NM: Google Chrome · 3f2a');
  });

  it('mints a plain vendor label when no install id is supplied', async () => {
    const response = await fetch(`${baseUrl}${NM_BOOTSTRAP_PATH}`, { method: 'POST', body: '{}' });
    expect(response.status).toBe(200);
    const body = (await response.json()) as { ok: boolean; secret: string };
    const ledger = await peekDaemonAuthToken(body.secret);
    expect(ledger.ok).toBe(true);
    if (ledger.ok) expect(ledger.label).toBe('NM: Google Chrome');
  });

  it('revokes the same install predecessor mint and evicts its live sockets', async () => {
    const prior = await mintDaemonAuthToken({
      label: 'NM: Google Chrome',
      kind: 'nmSession',
      nmInstallId: 'install-abc',
      expiresAt: Date.now() + 1000 * 60,
    });
    const sibling = await mintDaemonAuthToken({
      label: 'NM: Google Chrome',
      kind: 'nmSession',
      nmInstallId: 'install-other',
      expiresAt: Date.now() + 1000 * 60,
    });
    const response = await fetch(`${baseUrl}${NM_BOOTSTRAP_PATH}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ installId: 'install-abc' }),
    });
    expect(response.status).toBe(200);
    expect(closedTokenIds).toEqual([prior.record.id]);
    const priorState = await peekDaemonAuthToken(prior.secret);
    expect(priorState).toEqual({ ok: false, reason: 'revoked' });
    // A sibling profile's token is untouched — the rotation is scoped.
    const siblingState = await peekDaemonAuthToken(sibling.secret);
    expect(siblingState.ok).toBe(true);
  });

  it('answers a coarse 403 refused for any broken verification link', async () => {
    verdict = { ok: false, reason: 'host-mismatch', detail: 'socket owner runs /tmp/impostor' };
    const response = await fetch(`${baseUrl}${NM_BOOTSTRAP_PATH}`, { method: 'POST', body: '{}' });
    expect(response.status).toBe(403);
    expect(await response.json()).toEqual({ ok: false, reason: 'refused' });
  });

  it('answers 501 unsupported on platforms without a verification chain', async () => {
    verdict = { ok: false, reason: 'platform-unsupported', detail: 'win32' };
    const response = await fetch(`${baseUrl}${NM_BOOTSTRAP_PATH}`, { method: 'POST', body: '{}' });
    expect(response.status).toBe(501);
    expect(await response.json()).toEqual({ ok: false, reason: 'unsupported' });
  });
});
