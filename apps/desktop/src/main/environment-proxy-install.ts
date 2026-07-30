/**
 * Desktop environment-plane service (docs/REQUEST_ENGINE_PROXY_DESIGN.md):
 * the mode-driven half of the two-plane proxy architecture on this
 * device — Off / System / Manual / PAC — around the P2 resolver
 * registry, plus the settings surface's RPCs.
 *
 * System (the default, FORK A) delegates resolution to Chromium via
 * `resolveProxy` — Windows WinINET/GPO settings, macOS System
 * Settings, PAC files, WPAD discovery, per-URL PAC answers, with zero
 * evaluator code of ours: "works exactly like Chrome on this machine"
 * is the corporate promise, verbatim. PAC points the SAME dedicated
 * resolver session's `setProxy({ pacScript })` at a user-chosen PAC —
 * PAC JS executes inside Chromium's sandboxed network service, never
 * in our process (the static-bundling law), and never touches what the
 * windows browse with. Manual rides the host-neutral resolver
 * (env-var value idiom + NO_PROXY bypass) with credentials resolved
 * per send against THIS device's vault by entry name. Off registers
 * the explicit `null`.
 *
 * Settings are per-DEVICE (`OH.environmentProxy`, the vault posture —
 * machine state, never synced); a set applies live, so the next send
 * resolves under the new mode with no restart. The Chromium adapter
 * answers `null` on any resolution failure — Chromium itself treats an
 * unresolvable answer as DIRECT, and the plane's job is seamlessness,
 * never a new way for a send to fail.
 */

import { pathToFileURL } from 'node:url';
import {
  DESKTOP_ENVIRONMENT_PROXY_MODES,
  EnvironmentProxySettingsSchema,
  parseEntity,
} from '@openheaders/core/schemas';
import type { StorageKey } from '@openheaders/core/storage';
import { OH } from '@openheaders/core/storage';
import type {
  EnvironmentProxyResolution,
  EnvironmentProxyResolvedEntry,
  EnvironmentProxySettings,
} from '@openheaders/core/types';
import { getVault } from '@openheaders/oracle/entity/environment-store';
import type {
  EnvironmentProxyResolver,
  EnvironmentProxySelection,
  EnvironmentProxySource,
} from '@openheaders/oracle-host-node/live/environment-proxy';
import {
  createManualProxyResolver,
  parsePacProxyList,
  registerEnvironmentProxyResolver,
} from '@openheaders/oracle-host-node/live/environment-proxy';
import { session } from 'electron';

/** The desktop tier default: System ON (FORK A) — an unmanaged machine
 *  resolves DIRECT and behaves exactly as before. */
export const DEFAULT_ENVIRONMENT_PROXY_SETTINGS: EnvironmentProxySettings = { version: 1, mode: 'system' };

/** The shared picklist also carries the node tier's `env` — schema-valid
 *  but meaningless where Chromium resolves; this tier refuses it. */
function isDesktopMode(mode: EnvironmentProxySettings['mode']): boolean {
  return (DESKTOP_ENVIRONMENT_PROXY_MODES as readonly string[]).includes(mode);
}

/** The Chromium-backed resolver over an injected `resolveProxy` — the
 *  Electron session stays behind this seam so the mapping is
 *  unit-testable without a browser. `source` distinguishes the OS
 *  delegation (`'system'`) from the explicit PAC mode (`'pac'`) riding
 *  the same session. */
export function chromiumEnvironmentProxyResolver(
  resolveProxy: (url: string) => Promise<string>,
  source: Extract<EnvironmentProxySource, 'system' | 'pac'> = 'system',
): EnvironmentProxyResolver {
  return {
    async resolve(url: string) {
      try {
        const entries = parsePacProxyList(await resolveProxy(url));
        return entries.length === 0 ? null : { entries, source };
      } catch {
        return null;
      }
    },
  };
}

/** Normalize the PAC source input — an `http(s)://` / `file://` URL
 *  rides as-is; anything else is treated as a local file path. */
export function pacScriptUrl(source: string): string {
  if (/^(https?|file):\/\//i.test(source)) return source;
  return pathToFileURL(source).toString();
}

/** Renderer-safe projection of a resolver answer: a chain entry crosses
 *  the bridge with `hasCredential`, never the credential value. */
export function projectSelection(selection: EnvironmentProxySelection): EnvironmentProxyResolution {
  return {
    source: selection.source,
    entries: selection.entries.map((entry): EnvironmentProxyResolvedEntry => {
      if (entry.kind !== 'proxy') return entry;
      return { kind: 'proxy', url: entry.url, ...(entry.credential !== undefined ? { hasCredential: true } : {}) };
    }),
  };
}

/** The slice of `HostStorage` the service actually rides — narrow so
 *  unit rigs hand in a plain map-backed store. */
export interface EnvironmentProxySettingsStore {
  get<T>(spec: StorageKey<T>): Promise<T | undefined>;
  set<T>(spec: StorageKey<T>, value: T): Promise<void>;
}

export interface EnvironmentProxyService {
  getSettings(): EnvironmentProxySettings;
  setSettings(raw: unknown): Promise<{ ok: true; settings: EnvironmentProxySettings } | { ok: false; error: string }>;
  resolve(url: string): Promise<EnvironmentProxyResolution | null>;
}

/**
 * Install the desktop's environment plane: hydrate the per-device
 * settings, register the mode's resolver, and hand back the settings
 * surface's service. Called once from the engine bootstrap, after
 * `app` is ready (sessions need it).
 */
export async function installEnvironmentProxyService(
  hostStorage: EnvironmentProxySettingsStore,
): Promise<EnvironmentProxyService> {
  // Dedicated in-memory partition, never the UI session: PAC JS runs in
  // Chromium's sandboxed network service, and the explicit-PAC mode
  // repoints THIS session without touching what the windows browse with.
  const resolverSession = session.fromPartition('environment-proxy-resolver');
  let active: EnvironmentProxyResolver | null = null;
  let settings = DEFAULT_ENVIRONMENT_PROXY_SETTINGS;

  // A malformed slot — or one carrying another tier's mode — reads as
  // the tier default, never a boot failure.
  const stored = await hostStorage.get(OH.environmentProxy);
  if (stored !== undefined) {
    const parsed = parseEntity(EnvironmentProxySettingsSchema, stored);
    settings = parsed !== null && isDesktopMode(parsed.mode) ? parsed : DEFAULT_ENVIRONMENT_PROXY_SETTINGS;
  }

  async function apply(next: EnvironmentProxySettings): Promise<void> {
    settings = next;
    switch (next.mode) {
      case 'off':
        active = null;
        break;
      case 'system':
        await resolverSession.setProxy({ mode: 'system' });
        active = chromiumEnvironmentProxyResolver((url) => resolverSession.resolveProxy(url), 'system');
        break;
      case 'pac':
        if (next.pacSource === undefined) {
          active = null;
          break;
        }
        await resolverSession.setProxy({ pacScript: pacScriptUrl(next.pacSource) });
        active = chromiumEnvironmentProxyResolver((url) => resolverSession.resolveProxy(url), 'pac');
        break;
      case 'manual':
        if (next.manualProxyUrl === undefined) {
          active = null;
          break;
        }
        active = createManualProxyResolver({
          proxyValue: next.manualProxyUrl,
          ...(next.manualBypassList !== undefined ? { bypassList: next.manualBypassList } : {}),
          ...(next.manualCredentialRef !== undefined
            ? {
                resolveCredential: () => {
                  const ref = next.manualCredentialRef;
                  const entry = getVault().secrets.find((s) => s.kind === 'string' && s.name === ref);
                  return entry !== undefined && entry.kind === 'string' ? entry.value : null;
                },
              }
            : {}),
        });
        break;
    }
    registerEnvironmentProxyResolver(active);
  }

  await apply(settings);

  return {
    getSettings: () => settings,
    async setSettings(raw) {
      const next = parseEntity(EnvironmentProxySettingsSchema, raw);
      if (next === null) {
        return { ok: false, error: 'Invalid environment-proxy settings shape.' };
      }
      if (!isDesktopMode(next.mode)) {
        return {
          ok: false,
          error: `Mode '${next.mode}' is not available on the desktop — use System, Manual, PAC, or Off.`,
        };
      }
      await hostStorage.set(OH.environmentProxy, next);
      await apply(next);
      return { ok: true, settings: next };
    },
    async resolve(url) {
      if (active === null) return null;
      const selection = await active.resolve(url).catch(() => null);
      return selection === null ? null : projectSelection(selection);
    },
  };
}
