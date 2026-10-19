/**
 * The service worker's answer to the `diagnosticsFacts` RPC (the error
 * reports plan §4.5): the build and browser facts the usage envelope
 * already reads, plus what a bug report about an extension needs — the
 * manifest version, how much of `storage.local` is in use and how many
 * DNR rules are installed. Every optional read is guarded on its own:
 * an engine without the API leaves the field out, never the answer.
 */

import type { ExtensionDiagnosticsFacts } from '@openheaders/core/diagnostics';
import { declarativeNetRequest, runtime } from '@utils/browser-api';
import { buildEnvelopeFacts } from './product-telemetry';

declare const browser: typeof chrome | undefined;

async function optional<T>(read: () => Promise<T>): Promise<T | undefined> {
  try {
    return await read();
  } catch {
    return undefined;
  }
}

async function storageBytesInUse(): Promise<number | undefined> {
  const api = typeof browser !== 'undefined' ? browser : chrome;
  const area = api.storage.local as chrome.storage.StorageArea & { getBytesInUse?: () => Promise<number> };
  if (typeof area.getBytesInUse !== 'function') return undefined;
  return optional(() => area.getBytesInUse!());
}

/** One DNR table's size; absent where the engine has no DNR or the read fails. */
async function ruleCount(
  read: (dnr: NonNullable<typeof declarativeNetRequest>) => Promise<ReadonlyArray<unknown>>,
): Promise<number | undefined> {
  const dnr = declarativeNetRequest;
  if (!dnr) return undefined;
  return optional(() => read(dnr).then((rules) => rules.length));
}

export async function buildExtensionDiagnosticsFacts(): Promise<ExtensionDiagnosticsFacts> {
  const api = typeof browser !== 'undefined' ? browser : chrome;
  const manifest = runtime.getManifest();
  const [envelope, info, bytes, dynamicRules, sessionRules] = await Promise.all([
    buildEnvelopeFacts(),
    api.runtime.getPlatformInfo(),
    storageBytesInUse(),
    ruleCount((dnr) => dnr.getDynamicRules()),
    ruleCount((dnr) => dnr.getSessionRules()),
  ]);
  return {
    host: 'extension',
    appVersion: manifest.version,
    channel: envelope.channel,
    locale: envelope.locale,
    platform: info.os,
    arch: info.arch,
    ...(envelope.osVersion !== undefined ? { osVersion: String(envelope.osVersion) } : {}),
    uptimeSeconds: Math.round(performance.now() / 1000),
    collectedAt: Date.now(),
    browser: envelope.browser ?? 'other',
    ...(envelope.browserVersion !== undefined ? { browserVersion: envelope.browserVersion } : {}),
    manifestVersion: manifest.manifest_version,
    ...(bytes !== undefined ? { storageBytesInUse: bytes } : {}),
    ...(dynamicRules !== undefined ? { dynamicRules } : {}),
    ...(sessionRules !== undefined ? { sessionRules } : {}),
  };
}
