/**
 * The issue link: one title and one composed body on the markdown
 * template, the component / version / platform lines from the facts,
 * the facts as one collapsed table; a long link gives up the GPU table,
 * then the displays, then the whole block — never the person's text.
 */

import { describe, expect, it } from 'vitest';
import {
  type DiagnosticsFacts,
  ISSUE_NEW_URL,
  ISSUE_URL_BUDGET,
  type IssueDraft,
  issueLink,
  issuePlatformLine,
  issueVersionLine,
  systemInformationRows,
} from '../../src/diagnostics';

const desktopFacts: DiagnosticsFacts = {
  host: 'desktop',
  appVersion: '2026.10.1',
  channel: 'github-release',
  locale: 'en',
  platform: 'darwin',
  arch: 'arm64',
  osVersion: '27.0.1',
  uptimeSeconds: 120,
  collectedAt: Date.UTC(2026, 9, 19),
  packaged: true,
  runtime: { electron: '44.4.5', chromium: '152.0.0.0', node: '24.21.0', v8: '14.2' },
  runningUnderArm64Translation: false,
  hardwareAccelerationDisabledOnNextLaunch: false,
  previousSessionEndedDirty: true,
  gpuFeatureStatus: { gpu_compositing: 'enabled', webgl: 'enabled' },
  memory: { totalKB: 16_777_216, freeKB: 4_194_304 },
  displays: [{ width: 1728, height: 1117, scaleFactor: 2, internal: true }],
  windows: 1,
};

const extensionFacts: DiagnosticsFacts = {
  host: 'extension',
  appVersion: '2026.10.1',
  channel: 'chrome-store',
  locale: 'en',
  platform: 'mac',
  arch: 'arm64',
  osVersion: '27.0.1',
  uptimeSeconds: 30,
  collectedAt: Date.UTC(2026, 9, 19),
  browser: 'chrome',
  browserVersion: 154,
  manifestVersion: 3,
  storageBytesInUse: 2048,
  dynamicRules: 12,
  sessionRules: 0,
};

const bug: IssueDraft = {
  kind: 'bug',
  title: 'Header not injected',
  description: '1. Create a rule\n2. Reload\n\nExpected: injected. Actual: unmodified.',
};

function params(url: string): URLSearchParams {
  expect(url.startsWith(`${ISSUE_NEW_URL}?`)).toBe(true);
  return new URL(url).searchParams;
}

describe('issueLink', () => {
  it('composes the bug body on the template: type, description, component, version, platform, the facts table', () => {
    const link = issueLink(bug, 'desktop', desktopFacts);
    const q = params(link.url);
    expect(link.trimmed).toBe('none');
    expect(link.overBudget).toBe(false);
    expect(q.get('template')).toBe('bug_report.md');
    expect(q.get('title')).toBe('Header not injected');
    expect(q.get('body')).toBe(link.body);
    expect(link.body.startsWith(`Type: Bug\n\n${bug.description}\n\nComponent: `)).toBe(true);
    expect(link.body).toContain(
      'Component: Desktop app\nVersion: desktop 2026.10.1\nPlatform: macOS 27.0.1, Electron 44.4.5',
    );
    expect(link.body).toContain('<details>\n<summary>System information</summary>\n\n| Item | Value |\n|---|---|\n');
    expect(link.body).toContain('| OS | macOS 27.0.1 (arm64) |');
    expect(link.body).toContain('| Memory | 16.0 GB total, 4.0 GB free |');
    expect(link.body).toContain('| Display 1 | 1728×1117 @2x, internal |');
    expect(link.body).toContain('| GPU: webgl | enabled |');
    expect(link.body).toContain('| Previous session ended dirty | yes |');
    expect(link.body.endsWith('</details>')).toBe(true);
    expect([...q.keys()].sort()).toEqual(['body', 'template', 'title']);
  });

  it('names the browser and its host for the extension', () => {
    const link = issueLink(bug, 'extension', extensionFacts);
    expect(link.body).toContain(
      'Component: Browser extension\nVersion: extension 2026.10.1\nPlatform: macOS 27.0.1, Chrome 154',
    );
    expect(link.body).toContain('| Dynamic rules | 12 |');
    expect(issueVersionLine(extensionFacts)).toBe('extension 2026.10.1');
    expect(issuePlatformLine(extensionFacts)).toBe('macOS 27.0.1, Chrome 154');
  });

  it('leaves the version and platform lines blank without facts and names the web app', () => {
    const link = issueLink(bug, 'web', null);
    expect(link.body).toContain('Component: Web app\nVersion: \nPlatform: ');
    expect(link.body).not.toContain('<details>');
    expect(params(link.url).has('title')).toBe(true);
  });

  it('leaves an empty title out and trims the description', () => {
    const link = issueLink({ ...bug, title: '  ', description: '  steps  \n' }, 'desktop', null);
    expect(params(link.url).has('title')).toBe(false);
    expect(link.body.startsWith('Type: Bug\n\nsteps\n\nComponent: ')).toBe(true);
  });

  it('composes the feature body on its template and never carries facts', () => {
    const feature: IssueDraft = { kind: 'feature', title: 'Rule groups', description: 'Too many rules; group them.' };
    const link = issueLink(feature, 'desktop', desktopFacts);
    expect(params(link.url).get('template')).toBe('feature_request.md');
    expect(link.body).toBe('Type: Feature request\n\nToo many rules; group them.');
  });

  it('escapes pipes and folds newlines inside table cells', () => {
    const facts: DiagnosticsFacts = { ...desktopFacts, gpuFeatureStatus: { 'a|b': 'x\ny' } };
    expect(issueLink(bug, 'desktop', facts).body).toContain('| GPU: a\\|b | x y |');
  });

  it('trims the GPU table first, then the displays, then the whole block, and never the text', () => {
    const gpu: Record<string, string> = {};
    for (let i = 0; i < 120; i += 1) gpu[`feature_${i}_with_a_long_name`] = 'disabled_software';
    const displays = Array.from({ length: 40 }, () => ({ width: 1728, height: 1117, scaleFactor: 2, internal: true }));
    const heavy: DiagnosticsFacts = { ...desktopFacts, gpuFeatureStatus: gpu, displays };

    const gpuTrimmed = issueLink(bug, 'desktop', heavy);
    expect(gpuTrimmed.trimmed).toBe('gpu');
    expect(gpuTrimmed.overBudget).toBe(false);
    expect(gpuTrimmed.body).not.toContain('GPU:');
    expect(gpuTrimmed.body).toContain('| Display 1 |');
    expect(gpuTrimmed.body).toContain('The GPU feature table was left out');

    const longText = 'x'.repeat(4000);
    const displaysTrimmed = issueLink({ ...bug, description: longText }, 'desktop', heavy);
    expect(displaysTrimmed.trimmed).toBe('displays');
    expect(displaysTrimmed.body).not.toContain('| Display 1 |');
    expect(displaysTrimmed.body).toContain(longText);

    const factsTrimmed = issueLink({ ...bug, description: 'x'.repeat(5600) }, 'desktop', heavy);
    expect(factsTrimmed.trimmed).toBe('facts');
    expect(factsTrimmed.overBudget).toBe(false);
    expect(factsTrimmed.body).not.toContain('<details>');
    expect(factsTrimmed.body).toContain('Version: desktop 2026.10.1');

    const over = issueLink({ ...bug, description: 'x'.repeat(7000) }, 'desktop', heavy);
    expect(over.overBudget).toBe(true);
    expect(over.body).toContain('x'.repeat(7000));
    expect(new TextEncoder().encode(over.url).length).toBeGreaterThan(ISSUE_URL_BUDGET);
  });

  it('keeps every fitting link under the budget in bytes, non-ASCII included', () => {
    const link = issueLink({ ...bug, description: 'ü'.repeat(600) }, 'desktop', desktopFacts);
    expect(link.overBudget).toBe(false);
    expect(new TextEncoder().encode(link.url).length).toBeLessThanOrEqual(ISSUE_URL_BUDGET);
  });

  it('keeps an unknown OS family raw and marks arm64 translation only when it runs', () => {
    const rows = systemInformationRows({ ...desktopFacts, platform: 'haiku', runningUnderArm64Translation: true });
    expect(rows.find((row) => row.label === 'OS')?.value).toBe('haiku 27.0.1 (arm64)');
    expect(rows.some((row) => row.label === 'Running under arm64 translation')).toBe(true);
    expect(systemInformationRows(desktopFacts).some((row) => row.label === 'Running under arm64 translation')).toBe(
      false,
    );
  });
});
