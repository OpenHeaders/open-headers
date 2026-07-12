/**
 * Install-detection probe runner — fs behavior over fixture directories.
 * Core owns the allowlist; here we prove the runner answers each probe
 * shape correctly (existence, prefix entry match, error-as-miss) and
 * that the end-to-end helper composes probes → findings.
 */

import { promises as fs } from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import type { InstallProbe } from '@openheaders/core/import';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { detectInstalledTools, runInstallProbes } from '../../../src/migration/install-detect';

let tmpHome: string;

beforeEach(async () => {
  tmpHome = await fs.mkdtemp(path.join(os.tmpdir(), 'oh-install-detect-'));
});

afterEach(async () => {
  await fs.rm(tmpHome, { recursive: true, force: true });
});

describe('runInstallProbes', () => {
  it('answers path probes with existence, files and directories alike', async () => {
    const dir = path.join(tmpHome, '.config', 'Postman');
    await fs.mkdir(dir, { recursive: true });
    const probes: InstallProbe[] = [
      { tool: 'postman', kind: 'path', path: dir },
      { tool: 'insomnia', kind: 'path', path: path.join(tmpHome, '.config', 'Insomnia') },
    ];
    const results = await runInstallProbes(probes);
    expect(results[0]).toEqual({ probe: probes[0], matchedPath: dir });
    expect(results[1]).toEqual({ probe: probes[1], matchedPath: null });
  });

  it('matches a versioned entry by name prefix and returns its full path', async () => {
    const extensions = path.join(tmpHome, '.vscode', 'extensions');
    await fs.mkdir(path.join(extensions, 'rangav.vscode-thunder-client-2.37.4'), { recursive: true });
    await fs.mkdir(path.join(extensions, 'unrelated.extension-1.0.0'), { recursive: true });
    const probe: InstallProbe = {
      tool: 'thunder-client',
      kind: 'dir-entry-prefix',
      dir: extensions,
      namePrefix: 'rangav.vscode-thunder-client-',
    };
    const [result] = await runInstallProbes([probe]);
    expect(result.matchedPath).toBe(path.join(extensions, 'rangav.vscode-thunder-client-2.37.4'));
  });

  it('treats a missing or unreadable probe directory as a miss', async () => {
    const probe: InstallProbe = {
      tool: 'thunder-client',
      kind: 'dir-entry-prefix',
      dir: path.join(tmpHome, 'nope', 'extensions'),
      namePrefix: 'rangav.vscode-thunder-client-',
    };
    const [result] = await runInstallProbes([probe]);
    expect(result.matchedPath).toBeNull();
  });
});

describe('detectInstalledTools', () => {
  it('detects tools from fixture roots and reports the rest as absent', async () => {
    await fs.mkdir(path.join(tmpHome, '.config', 'Postman'), { recursive: true });
    await fs.mkdir(path.join(tmpHome, '.vscode', 'extensions', 'rangav.vscode-thunder-client-2.37.4'), {
      recursive: true,
    });
    const findings = await detectInstalledTools({ platform: 'linux', roots: { home: tmpHome } });

    const byTool = new Map(findings.map((finding) => [finding.tool, finding]));
    expect(byTool.get('postman')?.detected).toBe(true);
    expect(byTool.get('postman')?.markers).toEqual([path.join(tmpHome, '.config', 'Postman')]);
    expect(byTool.get('thunder-client')?.detected).toBe(true);
    expect(byTool.get('insomnia')?.detected).toBe(false);
    expect(byTool.get('bruno')?.detected).toBe(false);
  });

  it('returns all tools undetected on an unknown platform', async () => {
    const findings = await detectInstalledTools({ platform: 'freebsd', roots: { home: tmpHome } });
    expect(findings).toHaveLength(4);
    expect(findings.every((finding) => !finding.detected)).toBe(true);
  });
});
