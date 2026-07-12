/**
 * Install detection — the pure probe allowlist + findings interpretation
 * (migration ladder rung 1). The macOS Postman markers are pinned to the
 * S1-verified paths; other tools/platforms are convention-derived and
 * re-verified in Phase 7, but the table shape is contract here.
 */

import { describe, expect, it } from 'vitest';
import {
  type InstallProbe,
  type InstallProbeResult,
  listInstallProbes,
  MIGRATION_TOOL_NAMES,
  MIGRATION_TOOLS,
  resolveInstallFindings,
} from '../../src/import/install-detect';

const HOME = '/Users/dev';

function pathsFor(probes: InstallProbe[], tool: string): string[] {
  return probes.flatMap((probe) => (probe.tool === tool && probe.kind === 'path' ? [probe.path] : []));
}

describe('listInstallProbes', () => {
  it('darwin pins the forensically verified Postman markers', () => {
    const probes = listInstallProbes('darwin', { home: HOME });
    const postman = pathsFor(probes, 'postman');
    expect(postman).toContain('/Applications/Postman.app');
    expect(postman).toContain(`${HOME}/Library/Application Support/Postman`);
  });

  it('darwin covers every tool with at least one probe', () => {
    const probes = listInstallProbes('darwin', { home: HOME });
    for (const tool of MIGRATION_TOOLS) {
      expect(probes.some((probe) => probe.tool === tool)).toBe(true);
    }
  });

  it('darwin probes the versioned editor-extension dir by name prefix only', () => {
    const probes = listInstallProbes('darwin', { home: HOME });
    const prefix = probes.find((probe) => probe.kind === 'dir-entry-prefix');
    expect(prefix).toEqual({
      tool: 'thunder-client',
      kind: 'dir-entry-prefix',
      dir: `${HOME}/.vscode/extensions`,
      namePrefix: 'rangav.vscode-thunder-client-',
    });
  });

  it('win32 skips probes whose root env var is absent', () => {
    const bare = listInstallProbes('win32', { home: 'C:\\Users\\dev' });
    expect(bare.filter((probe) => probe.kind === 'path')).toHaveLength(0);
    expect(bare.filter((probe) => probe.kind === 'dir-entry-prefix')).toHaveLength(1);

    const full = listInstallProbes('win32', {
      home: 'C:\\Users\\dev',
      appData: 'C:\\Users\\dev\\AppData\\Roaming',
      localAppData: 'C:\\Users\\dev\\AppData\\Local',
    });
    expect(pathsFor(full, 'postman')).toEqual([
      'C:\\Users\\dev\\AppData\\Local\\Postman',
      'C:\\Users\\dev\\AppData\\Roaming\\Postman',
    ]);
  });

  it('linux keeps all probes under the home directory', () => {
    const probes = listInstallProbes('linux', { home: '/home/dev' });
    expect(probes.length).toBeGreaterThan(0);
    for (const probe of probes) {
      const root = probe.kind === 'path' ? probe.path : probe.dir;
      expect(root.startsWith('/home/dev/')).toBe(true);
    }
  });

  it('returns no probes for an unknown platform', () => {
    expect(listInstallProbes('freebsd', { home: HOME })).toEqual([]);
  });

  it('never emits a probe reaching into forbidden stores', () => {
    for (const platform of ['darwin', 'win32', 'linux']) {
      const probes = listInstallProbes(platform, {
        home: HOME,
        appData: `${HOME}/AppData/Roaming`,
        localAppData: `${HOME}/AppData/Local`,
      });
      for (const probe of probes) {
        const target = probe.kind === 'path' ? probe.path : probe.dir;
        expect(target).not.toMatch(/userPartitionData|Cookies|Session Storage|Local Storage|IndexedDB/i);
      }
    }
  });
});

describe('resolveInstallFindings', () => {
  const postmanApp: InstallProbe = { tool: 'postman', kind: 'path', path: '/Applications/Postman.app' };
  const postmanSupport: InstallProbe = {
    tool: 'postman',
    kind: 'path',
    path: `${HOME}/Library/Application Support/Postman`,
  };

  it('emits one finding per tool in stable order, even with no results', () => {
    const findings = resolveInstallFindings([]);
    expect(findings.map((finding) => finding.tool)).toEqual([...MIGRATION_TOOLS]);
    for (const finding of findings) {
      expect(finding.detected).toBe(false);
      expect(finding.markers).toEqual([]);
      expect(finding.displayName).toBe(MIGRATION_TOOL_NAMES[finding.tool]);
    }
  });

  it('marks a tool detected when any probe matched and lists markers in probe order', () => {
    const results: InstallProbeResult[] = [
      { probe: postmanApp, matchedPath: null },
      { probe: postmanSupport, matchedPath: postmanSupport.path },
    ];
    const findings = resolveInstallFindings(results);
    const postman = findings.find((finding) => finding.tool === 'postman');
    expect(postman?.detected).toBe(true);
    expect(postman?.markers).toEqual([postmanSupport.path]);
    const insomnia = findings.find((finding) => finding.tool === 'insomnia');
    expect(insomnia?.detected).toBe(false);
  });

  it('carries the resolved entry path for prefix probes', () => {
    const prefixProbe: InstallProbe = {
      tool: 'thunder-client',
      kind: 'dir-entry-prefix',
      dir: `${HOME}/.vscode/extensions`,
      namePrefix: 'rangav.vscode-thunder-client-',
    };
    const matched = `${HOME}/.vscode/extensions/rangav.vscode-thunder-client-2.37.4`;
    const findings = resolveInstallFindings([{ probe: prefixProbe, matchedPath: matched }]);
    const thunder = findings.find((finding) => finding.tool === 'thunder-client');
    expect(thunder?.detected).toBe(true);
    expect(thunder?.markers).toEqual([matched]);
  });
});
