/**
 * The desktop's answer to the `diagnosticsFacts` RPC (the error reports
 * plan §4.5): what a bug report needs beside `main.log` — the build and
 * its runtime, the machine class, the graphics state the grey-window
 * hypotheses turn on, and the two markers main keeps about itself (the
 * acceleration policy, the sentinel's verdict). No path, no user name:
 * the bundle may land in a public issue.
 *
 * Every Electron read is a dependency so the shape is testable outside
 * the runtime; `desktopDiagnosticsDeps` is the production binding.
 */

import type { DesktopDiagnosticsFacts, DesktopDisplayFacts } from '@openheaders/core/diagnostics';
import type { TelemetryChannelId } from '@openheaders/core/telemetry';
import { app, BrowserWindow, screen } from 'electron';
import { isHardwareAccelerationDisabled } from './bootstrap/hardware-acceleration';
import { wasPreviousSessionDirty } from './bootstrap/session-sentinel';
import type { ProductTelemetryHostDeps } from './product-telemetry';

export interface DesktopDiagnosticsDeps {
  appVersion: string;
  packaged: boolean;
  channel: TelemetryChannelId;
  locale(): string;
  platform: NodeJS.Platform;
  arch: string;
  systemVersion: string;
  runningUnderArm64Translation: boolean;
  versions: { electron: string; chromium: string; node: string; v8: string };
  hardwareAccelerationDisabled(): boolean;
  previousSessionDirty(): boolean;
  gpuFeatureStatus(): Record<string, string>;
  memory(): { totalKB: number; freeKB: number };
  displays(): DesktopDisplayFacts[];
  windowCount(): number;
  uptimeSeconds(): number;
  now(): number;
}

export function buildDesktopDiagnosticsFacts(deps: DesktopDiagnosticsDeps): DesktopDiagnosticsFacts {
  return {
    host: 'desktop',
    appVersion: deps.appVersion,
    channel: deps.channel,
    locale: deps.locale(),
    platform: deps.platform,
    arch: deps.arch,
    osVersion: deps.systemVersion,
    uptimeSeconds: deps.uptimeSeconds(),
    collectedAt: deps.now(),
    packaged: deps.packaged,
    runtime: deps.versions,
    runningUnderArm64Translation: deps.runningUnderArm64Translation,
    hardwareAccelerationDisabledOnNextLaunch: deps.hardwareAccelerationDisabled(),
    previousSessionEndedDirty: deps.previousSessionDirty(),
    gpuFeatureStatus: deps.gpuFeatureStatus(),
    memory: deps.memory(),
    displays: deps.displays(),
    windows: deps.windowCount(),
  };
}

/** The production binding over the usage channel's host deps (the same build, platform and locale facts). */
export function desktopDiagnosticsDeps(telemetry: ProductTelemetryHostDeps): DesktopDiagnosticsDeps {
  return {
    appVersion: telemetry.appVersion,
    packaged: app.isPackaged,
    channel: telemetry.channel,
    locale: telemetry.locale,
    platform: telemetry.platform,
    arch: telemetry.arch,
    systemVersion: telemetry.systemVersion,
    runningUnderArm64Translation: telemetry.runningUnderArm64Translation,
    versions: {
      electron: process.versions.electron ?? '',
      chromium: process.versions.chrome ?? '',
      node: process.versions.node,
      v8: process.versions.v8,
    },
    hardwareAccelerationDisabled: isHardwareAccelerationDisabled,
    previousSessionDirty: wasPreviousSessionDirty,
    gpuFeatureStatus: () => ({ ...app.getGPUFeatureStatus() }),
    memory: () => {
      const info = process.getSystemMemoryInfo();
      return { totalKB: info.total, freeKB: info.free };
    },
    displays: () =>
      screen.getAllDisplays().map((display) => ({
        width: display.size.width,
        height: display.size.height,
        scaleFactor: display.scaleFactor,
        internal: display.internal,
      })),
    windowCount: () => BrowserWindow.getAllWindows().length,
    uptimeSeconds: () => Math.round(process.uptime()),
    now: Date.now,
  };
}
