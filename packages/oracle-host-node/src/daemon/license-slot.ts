/**
 * License slot — the host side of the one verification path
 * (LICENSING_PLAN.md §3.3): load the license file, verify through the
 * pure core verifier, watch for external changes, and re-evaluate at
 * the validity/grace boundaries so `licensed → grace → expired`
 * transitions surface without a restart.
 *
 * One slot per host process, installed by the boot spine. The file is
 * plain text holding the compact `oh-license.` artifact; the default
 * location is `<dataDir>/license.key`, and the daemon distribution can
 * point elsewhere (`OH_LICENSE_FILE`). Every consumer — admin RPCs,
 * the `licenseUpdated` broadcast, slice 3's seat gate — reads the same
 * snapshot; nothing verifies twice.
 *
 * The trust ring is the compiled-in `LICENSE_PUBLIC_KEYS` — never a
 * config knob, or any operator could sign their own seats. Tests
 * inject a ring; that parameter does not reach host config.
 */

import { type FSWatcher, promises as fs, watch } from 'node:fs';
import * as path from 'node:path';
import { emitAuditEntry, getIdentitySnapshot } from '@openheaders/core/identity';
import {
  LICENSE_PUBLIC_KEYS,
  type LicenseKeyRing,
  type LicenseSnapshot,
  snapshotFromVerifyResult,
  verifyLicense,
} from '@openheaders/core/licensing';
import { logger as consoleLogger } from '@openheaders/core/utils';

const SCOPE = 'license-slot';

/** Re-check cadence cap — boundaries further out re-arm in day chunks. */
const MAX_TIMER_MS = 24 * 60 * 60 * 1000;
const WATCH_DEBOUNCE_MS = 150;

export interface LicenseSlotOptions {
  /** Plain-text file holding the compact license artifact. */
  filePath: string;
  /** Fired on every snapshot CHANGE (never on a same-state re-evaluation). */
  broadcast(snapshot: LicenseSnapshot): void;
  /** Test seam — production always verifies against the compiled ring. */
  ring?: LicenseKeyRing;
  /** Test seam for boundary-crossing coverage. */
  now?: () => number;
}

/**
 * How an install stamps the audit log: `daemon.license-install` for
 * operator action (admin RPC, offline CLI), `daemon.license-refresh`
 * for the refresh agent's automatic renewal.
 */
export type LicenseInstallAudit = 'daemon.license-install' | 'daemon.license-refresh';

export interface LicenseSlotHandle {
  getSnapshot(): LicenseSnapshot;
  /**
   * The compact artifact currently installed, or null when no file is
   * present. The refresh agent POSTs this as `licenseKey`; the snapshot
   * deliberately never carries the raw text.
   */
  getInstalledText(): Promise<string | null>;
  /**
   * Verify `text`; persist it atomically as the license file when it
   * verifies as `licensed` or `grace`. Refused artifacts never touch
   * the installed file.
   */
  install(
    text: string,
    options?: { auditAs?: LicenseInstallAudit },
  ): Promise<{ ok: true; snapshot: LicenseSnapshot } | { ok: false; error: string }>;
  /** Delete the license file; the host reverts to free-tier limits. */
  remove(): Promise<{ ok: true; snapshot: LicenseSnapshot }>;
  /** Re-read the file now (the watcher's path; exposed for tests). */
  reload(): Promise<LicenseSnapshot>;
  dispose(): void;
}

function describeRefusal(snapshot: LicenseSnapshot): string {
  switch (snapshot.status) {
    case 'invalid':
      switch (snapshot.reason) {
        case 'malformed':
          return 'not a license: expected an oh-license key string';
        case 'schema-mismatch':
          return 'license payload does not match any supported schema';
        case 'unknown-kid':
          return 'license is signed with a key this build does not trust';
        case 'bad-signature':
          return 'license signature does not verify — the text was altered';
      }
      break;
    case 'expired':
      return 'license (including its grace period) has already expired';
    default:
      break;
  }
  return 'license was refused';
}

/**
 * Lifecycle stamp for the audit log (LICENSING_PLAN.md §4 "audit rows
 * for license events"). Every path funnels here — admin RPC and the
 * offline CLI both act as the host operator; peer-plane callers were
 * already stamped by the `daemon.admin` gate.
 */
function auditLicenseEvent(capability: LicenseInstallAudit | 'daemon.license-remove'): void {
  emitAuditEntry({
    actorUserId: getIdentitySnapshot()?.user.id ?? 'operator',
    capability,
    decision: { allow: true },
  });
}

export async function installLicenseSlot(options: LicenseSlotOptions): Promise<LicenseSlotHandle> {
  const ring = options.ring ?? LICENSE_PUBLIC_KEYS;
  const now = options.now ?? Date.now;
  const { filePath } = options;

  let snapshot: LicenseSnapshot = { status: 'unlicensed' };
  let boundaryTimer: NodeJS.Timeout | null = null;
  let watchDebounce: NodeJS.Timeout | null = null;
  let watcher: FSWatcher | null = null;
  let disposed = false;

  const evaluate = async (): Promise<LicenseSnapshot> => {
    let text: string | null;
    try {
      text = await fs.readFile(filePath, 'utf8');
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code !== 'ENOENT') {
        consoleLogger.warn(SCOPE, `cannot read license file ${filePath}`, err);
      }
      text = null;
    }
    if (text === null || text.trim() === '') return { status: 'unlicensed' };
    return snapshotFromVerifyResult(await verifyLicense(text, new Date(now()), ring));
  };

  const armBoundaryTimer = (): void => {
    if (boundaryTimer !== null) clearTimeout(boundaryTimer);
    boundaryTimer = null;
    if (disposed) return;
    if (snapshot.status !== 'licensed' && snapshot.status !== 'grace') return;
    const boundary = snapshot.status === 'licensed' ? snapshot.validUntil : snapshot.graceEndsAt;
    const delay = Math.min(Math.max(boundary + 1 - now(), 0), MAX_TIMER_MS);
    boundaryTimer = setTimeout(() => {
      void reload();
    }, delay);
    boundaryTimer.unref?.();
  };

  const apply = (next: LicenseSnapshot): LicenseSnapshot => {
    const changed = JSON.stringify(next) !== JSON.stringify(snapshot);
    snapshot = next;
    armBoundaryTimer();
    if (changed) options.broadcast(snapshot);
    return snapshot;
  };

  const reload = async (): Promise<LicenseSnapshot> => apply(await evaluate());

  snapshot = await evaluate();
  armBoundaryTimer();

  // Watch the parent directory rather than the file: `fs.watch` on a
  // path that does not exist yet throws, and a file watcher goes stale
  // across the delete/rename cycles atomic writers use. The directory
  // may still be absent (OH_LICENSE_FILE pointing somewhere unborn) —
  // degrade to RPC-driven reloads instead of refusing to boot.
  try {
    watcher = watch(path.dirname(filePath), (_event, changed) => {
      if (changed !== null && changed !== path.basename(filePath)) return;
      if (watchDebounce !== null) clearTimeout(watchDebounce);
      watchDebounce = setTimeout(() => {
        watchDebounce = null;
        void reload();
      }, WATCH_DEBOUNCE_MS);
    });
    watcher.unref?.();
  } catch (err) {
    consoleLogger.warn(SCOPE, `cannot watch ${path.dirname(filePath)}; external license changes need a restart`, err);
  }

  return {
    getSnapshot: () => snapshot,

    async getInstalledText() {
      try {
        const text = await fs.readFile(filePath, 'utf8');
        const compact = text.trim();
        return compact === '' ? null : compact;
      } catch (err) {
        if ((err as NodeJS.ErrnoException).code !== 'ENOENT') {
          consoleLogger.warn(SCOPE, `cannot read license file ${filePath}`, err);
        }
        return null;
      }
    },

    async install(text: string, options?: { auditAs?: LicenseInstallAudit }) {
      const candidate = snapshotFromVerifyResult(await verifyLicense(text, new Date(now()), ring));
      if (candidate.status !== 'licensed' && candidate.status !== 'grace') {
        return { ok: false, error: describeRefusal(candidate) };
      }
      // A personal seat admits its one holder at sign-in; installed as
      // the daemon license its seats claim would shrink the pool.
      if (candidate.kind === 'personal-seat') {
        return {
          ok: false,
          error: 'this is a personal-seat license — redeem it when joining a full daemon, not as the daemon license',
        };
      }
      const compact = text.replace(/\s+/g, '');
      const tmpPath = `${filePath}.tmp`;
      await fs.mkdir(path.dirname(filePath), { recursive: true });
      await fs.writeFile(tmpPath, `${compact}\n`, { encoding: 'utf8', mode: 0o600 });
      await fs.rename(tmpPath, filePath);
      auditLicenseEvent(options?.auditAs ?? 'daemon.license-install');
      return { ok: true, snapshot: apply(candidate) };
    },

    async remove() {
      let existed = true;
      try {
        await fs.unlink(filePath);
      } catch (err) {
        if ((err as NodeJS.ErrnoException).code !== 'ENOENT') throw err;
        existed = false;
      }
      if (existed) auditLicenseEvent('daemon.license-remove');
      return { ok: true, snapshot: apply({ status: 'unlicensed' }) };
    },

    reload,

    dispose() {
      disposed = true;
      if (boundaryTimer !== null) clearTimeout(boundaryTimer);
      if (watchDebounce !== null) clearTimeout(watchDebounce);
      boundaryTimer = null;
      watchDebounce = null;
      watcher?.close();
      watcher = null;
    },
  };
}
