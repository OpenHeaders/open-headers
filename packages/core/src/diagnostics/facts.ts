/**
 * System facts for the diagnostic bundle (the error reports plan §4.5)
 * — what a bug report needs beside the logs: the build, the runtime,
 * the machine class. The host that owns the long-lived process answers
 * them over the `diagnosticsFacts` RPC; the document that composes the
 * bundle never reads them itself.
 *
 * The bundle is the person's own file and ships nowhere, so these facts
 * may be strings. One law still holds from Firefox's about:support:
 * no filesystem path, home directory or user name appears here — a
 * bundle pasted into a public issue must not name the machine's owner.
 */

import type { TelemetryBrowserKind, TelemetryChannelId } from '../telemetry/vocabulary';

export interface DiagnosticsFactsBase {
  /** The host's CalVer version as its package states it. */
  appVersion: string;
  /** The build's distribution channel — the usage channel's own vocabulary. */
  channel: TelemetryChannelId;
  /** The resolved interface language. */
  locale: string;
  /** The OS family as the runtime names it (`darwin` / `win32` / `linux`; `mac` / `win` / … in a browser). */
  platform: string;
  /** The process architecture as the runtime names it. */
  arch: string;
  /** The OS version as far as the host can read it honestly; absent where it cannot. */
  osVersion?: string;
  /** Seconds since the answering process started. */
  uptimeSeconds: number;
  /** ms since epoch when the facts were read. */
  collectedAt: number;
}

export interface DesktopDisplayFacts {
  width: number;
  height: number;
  scaleFactor: number;
  internal: boolean;
}

export interface DesktopDiagnosticsFacts extends DiagnosticsFactsBase {
  host: 'desktop';
  packaged: boolean;
  runtime: { electron: string; chromium: string; node: string; v8: string };
  runningUnderArm64Translation: boolean;
  /** The marker the crash dialog and the graphics watch write — the NEXT launch's policy, not the running state. */
  hardwareAccelerationDisabledOnNextLaunch: boolean;
  /** The clean-exit sentinel's verdict about the run before this one. */
  previousSessionEndedDirty: boolean;
  /** Chromium's GPU feature table (`enabled`, `disabled_software`, …) — the grey-window hypothesis in one map. */
  gpuFeatureStatus: Record<string, string>;
  memory: { totalKB: number; freeKB: number };
  displays: DesktopDisplayFacts[];
  /** Open BrowserWindows at read time. */
  windows: number;
}

export interface ExtensionDiagnosticsFacts extends DiagnosticsFactsBase {
  host: 'extension';
  browser: TelemetryBrowserKind;
  browserVersion?: number;
  manifestVersion: number;
  /** `storage.local` bytes in use; absent on engines without the read. */
  storageBytesInUse?: number;
  /** Installed dynamic / session DNR rule counts; absent where the engine has no such table. */
  dynamicRules?: number;
  sessionRules?: number;
}

export type DiagnosticsFacts = DesktopDiagnosticsFacts | ExtensionDiagnosticsFacts;
