/**
 * Runtime manifest — the file a running daemon leaves for `ohd status`.
 * Covers the write/read round trip, the bind updates, clean removal, and
 * the refusals that keep status honest: a foreign schema version, a
 * malformed record, and a missing file all read as "no manifest" rather
 * than as partial truth.
 */

import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import {
  isProcessAlive,
  RUNTIME_MANIFEST_VERSION,
  type RuntimeConfigSnapshot,
  readRuntimeManifest,
  runtimeManifestPath,
  startRuntimeManifest,
} from '../../src/runtime-manifest';

const tempDirs: string[] = [];

function makeDataDir(): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'oh-runtime-manifest-'));
  tempDirs.push(dir);
  return dir;
}

function makeSnapshot(overrides: Partial<RuntimeConfigSnapshot> = {}): RuntimeConfigSnapshot {
  return {
    dataDir: '/var/lib/openheaders',
    bindAddress: '127.0.0.1',
    bindPort: 8137,
    logLevel: 'info',
    trustedProxy: false,
    allowedHosts: [],
    allowInsecureLan: false,
    webRoot: null,
    useSystemCa: null,
    ...overrides,
  };
}

function start(dataDir: string, config = makeSnapshot()) {
  return startRuntimeManifest({
    dataDir,
    appVersion: '2026.8.5',
    configPath: path.join(dataDir, 'daemon.json'),
    config,
  });
}

afterEach(() => {
  for (const dir of tempDirs.splice(0)) {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

describe('startRuntimeManifest', () => {
  it('records the process and its boot configuration before any bind resolves', () => {
    const dataDir = makeDataDir();
    start(dataDir, makeSnapshot({ bindAddress: '0.0.0.0', allowInsecureLan: true }));

    const manifest = readRuntimeManifest(dataDir);
    expect(manifest).not.toBeNull();
    expect(manifest?.version).toBe(RUNTIME_MANIFEST_VERSION);
    expect(manifest?.pid).toBe(process.pid);
    expect(manifest?.appVersion).toBe('2026.8.5');
    expect(manifest?.config.bindAddress).toBe('0.0.0.0');
    expect(manifest?.config.allowInsecureLan).toBe(true);
    // The bind is unknown until the supervisor speaks — never guessed
    // from the configuration.
    expect(manifest?.bind).toBeNull();
  });

  it('overwrites the bind on every lifecycle transition', () => {
    const dataDir = makeDataDir();
    const writer = start(dataDir);

    writer.setBind({ state: 'binding', host: '0.0.0.0', port: 8137 });
    expect(readRuntimeManifest(dataDir)?.bind).toEqual({ state: 'binding', host: '0.0.0.0', port: 8137 });

    writer.setBind({ state: 'bound', host: '0.0.0.0', port: 8137 });
    expect(readRuntimeManifest(dataDir)?.bind).toEqual({ state: 'bound', host: '0.0.0.0', port: 8137 });

    writer.setBind({ state: 'failed', host: '0.0.0.0', port: 8137 });
    expect(readRuntimeManifest(dataDir)?.bind).toEqual({ state: 'failed', host: '0.0.0.0', port: 8137 });
  });

  it("carries this boot's setup code and drops it the moment the server is claimed", () => {
    const dataDir = makeDataDir();
    const writer = start(dataDir);
    // Nothing is claimable until the spine says so.
    expect(readRuntimeManifest(dataDir)?.setup).toBeNull();

    writer.setSetupCode('4KFP-9QW2-XM31');
    expect(readRuntimeManifest(dataDir)?.setup).toEqual({ code: '4KFP-9QW2-XM31' });

    writer.setSetupCode(null);
    expect(readRuntimeManifest(dataDir)?.setup).toBeNull();
  });

  it('removes the file on dispose and ignores writes afterwards', () => {
    const dataDir = makeDataDir();
    const writer = start(dataDir);
    writer.dispose();

    expect(fs.existsSync(runtimeManifestPath(dataDir))).toBe(false);
    writer.setBind({ state: 'bound', host: '127.0.0.1', port: 8137 });
    expect(fs.existsSync(runtimeManifestPath(dataDir))).toBe(false);
  });

  it('writes owner-only, like everything else in the data dir', () => {
    const dataDir = makeDataDir();
    start(dataDir);
    const mode = fs.statSync(runtimeManifestPath(dataDir)).mode & 0o777;
    expect(mode).toBe(0o600);
  });

  it('reports write failures instead of throwing into the boot path', () => {
    const errors: unknown[] = [];
    // A data dir that is a FILE — every write attempt fails.
    const blocked = path.join(makeDataDir(), 'not-a-dir');
    fs.writeFileSync(blocked, 'x');

    const writer = startRuntimeManifest({
      dataDir: blocked,
      appVersion: '2026.8.5',
      configPath: '/etc/openheaders/daemon.json',
      config: makeSnapshot(),
      onError: (err) => errors.push(err),
    });
    writer.setBind({ state: 'bound', host: '127.0.0.1', port: 8137 });

    expect(errors.length).toBeGreaterThan(0);
  });
});

describe('readRuntimeManifest', () => {
  it('reads absent, malformed and foreign-version files as no manifest', () => {
    const dataDir = makeDataDir();
    expect(readRuntimeManifest(dataDir)).toBeNull();

    fs.writeFileSync(runtimeManifestPath(dataDir), 'not json');
    expect(readRuntimeManifest(dataDir)).toBeNull();

    fs.writeFileSync(runtimeManifestPath(dataDir), JSON.stringify({ version: 99, pid: 1 }));
    expect(readRuntimeManifest(dataDir)).toBeNull();
  });

  it('refuses a record whose fields do not hold the shape status relies on', () => {
    const dataDir = makeDataDir();
    start(dataDir);
    const raw = JSON.parse(fs.readFileSync(runtimeManifestPath(dataDir), 'utf8')) as Record<string, unknown>;

    fs.writeFileSync(runtimeManifestPath(dataDir), JSON.stringify({ ...raw, pid: 'seven' }));
    expect(readRuntimeManifest(dataDir)).toBeNull();

    fs.writeFileSync(runtimeManifestPath(dataDir), JSON.stringify({ ...raw, startedAt: 'whenever' }));
    expect(readRuntimeManifest(dataDir)).toBeNull();

    fs.writeFileSync(runtimeManifestPath(dataDir), JSON.stringify({ ...raw, config: { bindPort: 8137 } }));
    expect(readRuntimeManifest(dataDir)).toBeNull();

    fs.writeFileSync(runtimeManifestPath(dataDir), JSON.stringify({ ...raw, bind: { state: 'wandering' } }));
    expect(readRuntimeManifest(dataDir)).toBeNull();
  });

  it('reads a manifest written before the claim block as nothing to claim', () => {
    const dataDir = makeDataDir();
    start(dataDir);
    const raw = JSON.parse(fs.readFileSync(runtimeManifestPath(dataDir), 'utf8')) as Record<string, unknown>;
    const { setup: _absent, ...older } = raw;

    // An added optional field is not a breaking shape change: the older
    // manifest still parses, at the same version, with no claim on offer.
    fs.writeFileSync(runtimeManifestPath(dataDir), JSON.stringify(older));
    expect(readRuntimeManifest(dataDir)?.setup).toBeNull();

    // A block that carries no usable code is no block either.
    fs.writeFileSync(runtimeManifestPath(dataDir), JSON.stringify({ ...raw, setup: { code: '' } }));
    expect(readRuntimeManifest(dataDir)?.setup).toBeNull();
  });
});

describe('isProcessAlive', () => {
  it('knows this process is alive and a freed pid is not', () => {
    expect(isProcessAlive(process.pid)).toBe(true);
    // Above the maximum pid on every platform the daemon ships to, so
    // it can never name a live process.
    expect(isProcessAlive(0x7fffffff)).toBe(false);
  });
});
