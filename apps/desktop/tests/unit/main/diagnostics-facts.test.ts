/**
 * The desktop's diagnostic facts (the error reports plan §4.5): every
 * dependency lands in its named field, the OS version rides whole (not
 * the usage channel's major), and nothing in the shape is a path.
 */

import { describe, expect, it } from 'vitest';
import { buildDesktopDiagnosticsFacts, type DesktopDiagnosticsDeps } from '@/main/diagnostics-facts';

function deps(overrides: Partial<DesktopDiagnosticsDeps> = {}): DesktopDiagnosticsDeps {
  return {
    appVersion: '2026.10.1',
    packaged: true,
    channel: 'github-release',
    locale: () => 'ro',
    platform: 'darwin',
    arch: 'arm64',
    systemVersion: '26.0.1',
    runningUnderArm64Translation: false,
    versions: { electron: '44.4.5', chromium: '144.0.7559.0', node: '24.1.0', v8: '14.4.1' },
    hardwareAccelerationDisabled: () => true,
    previousSessionDirty: () => true,
    gpuFeatureStatus: () => ({ gpu_compositing: 'enabled', webgl: 'disabled_software' }),
    memory: () => ({ totalKB: 33_554_432, freeKB: 1_048_576 }),
    displays: () => [{ width: 1728, height: 1117, scaleFactor: 2, internal: true }],
    windowCount: () => 2,
    uptimeSeconds: () => 4210,
    now: () => 1_760_000_000_000,
    ...overrides,
  };
}

describe('buildDesktopDiagnosticsFacts', () => {
  it('lays every dependency into its field', () => {
    expect(buildDesktopDiagnosticsFacts(deps())).toEqual({
      host: 'desktop',
      appVersion: '2026.10.1',
      channel: 'github-release',
      locale: 'ro',
      platform: 'darwin',
      arch: 'arm64',
      osVersion: '26.0.1',
      uptimeSeconds: 4210,
      collectedAt: 1_760_000_000_000,
      packaged: true,
      runtime: { electron: '44.4.5', chromium: '144.0.7559.0', node: '24.1.0', v8: '14.4.1' },
      runningUnderArm64Translation: false,
      hardwareAccelerationDisabledOnNextLaunch: true,
      previousSessionEndedDirty: true,
      gpuFeatureStatus: { gpu_compositing: 'enabled', webgl: 'disabled_software' },
      memory: { totalKB: 33_554_432, freeKB: 1_048_576 },
      displays: [{ width: 1728, height: 1117, scaleFactor: 2, internal: true }],
      windows: 2,
    });
  });

  it('reads the markers and the locale at call time, not at binding', () => {
    let disabled = false;
    let locale = 'en';
    const d = deps({ hardwareAccelerationDisabled: () => disabled, locale: () => locale });
    expect(buildDesktopDiagnosticsFacts(d)).toMatchObject({
      hardwareAccelerationDisabledOnNextLaunch: false,
      locale: 'en',
    });
    disabled = true;
    locale = 'de';
    expect(buildDesktopDiagnosticsFacts(d)).toMatchObject({
      hardwareAccelerationDisabledOnNextLaunch: true,
      locale: 'de',
    });
  });

  it('carries no filesystem path in any field', () => {
    const text = JSON.stringify(buildDesktopDiagnosticsFacts(deps()));
    expect(text).not.toMatch(/\/Users\/|\/home\/|[A-Z]:\\/);
  });
});
