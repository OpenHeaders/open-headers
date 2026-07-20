/**
 * Proxy trust service — the `oh.daemon.proxy.trust.*` backing
 * (PROXY_SECURITY.md §6). Composes the CA store, the per-store
 * install/remove/probe modules, and the durable change record into the
 * three surface operations: live status, consented install, verified
 * teardown.
 *
 * Laws enforced here:
 *  - status is re-derived by probing on every call — never a cached
 *    flag (§2.8);
 *  - install writes the change-record row BEFORE the store command
 *    runs, so a crash can never orphan trust (§5 crash-safe teardown);
 *  - teardown undoes exactly the recorded rows, drops each only on
 *    verified removal, and reports partial failure exactly (§2.5, §5);
 *  - the sealed CA outlives teardown while any row remains — its cert
 *    is what a later removal retry needs;
 *  - responses carry public material only (§2.2).
 */

import * as os from 'node:os';
import type {
  ProxyCaPublicInfo,
  ProxyCaRecord,
  ProxyTrustChange,
  ProxyTrustStoreId,
  ProxyTrustStoreState,
} from '@openheaders/core/types';
import {
  certFingerprints,
  dropProxyCa,
  ensureProxyCa,
  PROXY_CA_COMMON_NAME,
  proxyCaPublicInfo,
  readProxyCa,
} from './ca-store';
import { defaultExec, type ExecFn } from './exec';
import {
  createSystemTrustHelper,
  type SystemTrustHelper,
  type SystemTrustHelperRegistration,
  type SystemTrustHelperRegistrationReply,
} from './trust-helper';
import {
  installCaInKeychain,
  installCaViaHelper,
  loginKeychainPath,
  probeKeychain,
  removeCaFromKeychain,
  removeCaViaHelper,
  SYSTEM_KEYCHAIN_PATH,
  type TrustStoreOpResult,
} from './trust-macos';
import { discoverFirefoxProfiles, installCaInNssProfile, probeNssProfile, removeCaFromNssProfile } from './trust-nss';
import { dropTrustChange, listTrustChanges, upsertTrustChange } from './trust-record';

export interface ProxyTrustStatus {
  ca: ProxyCaPublicInfo | null;
  stores: ProxyTrustStoreState[];
  changes: ProxyTrustChange[];
  systemKeychainTrustSupported: boolean;
}

export interface ProxyTrustStoreResult {
  store: ProxyTrustStoreId;
  ref: string;
  ok: boolean;
  error?: string;
  elevationRequired?: boolean;
  /** The cert imported but could not be trusted — kept, not "unchanged". */
  residue?: boolean;
}

export type ProxyTrustInstallResult =
  | { ok: true; ca: ProxyCaPublicInfo; results: ProxyTrustStoreResult[] }
  | { ok: false; error: string };

export interface ProxyTrustRemoveResult {
  ok: boolean;
  results: ProxyTrustStoreResult[];
}

export interface ProxyTrustHelperState {
  /** The helper binary ships in this build (macOS packaged app). */
  present: boolean;
  /** Live XPC reachability of the registered daemon. */
  available: boolean;
  reason?: string;
  /** SMAppService registration state; null when no binary answers. */
  registration: SystemTrustHelperRegistration | null;
}

export interface ProxyTrustService {
  status(): Promise<ProxyTrustStatus>;
  install(stores: readonly ProxyTrustStoreId[]): Promise<ProxyTrustInstallResult>;
  remove(dropCa?: boolean): Promise<ProxyTrustRemoveResult>;
  helperState(): Promise<ProxyTrustHelperState>;
  helperRegister(): Promise<SystemTrustHelperRegistrationReply>;
  helperUnregister(): Promise<SystemTrustHelperRegistrationReply>;
  helperOpenLoginItems(): Promise<{ ok: boolean; error?: string }>;
}

export interface ProxyTrustDeps {
  /** Test seams — default to the real process/host values. */
  exec?: ExecFn;
  homedir?: string;
  platform?: string;
  tmpdir?: string;
  now?: () => number;
  /**
   * Admin-domain (System-keychain) trust rides the signed SMAppService
   * privileged helper (§2.6 amendment). The default client probes the
   * embedded helper binary live on every ask — unsigned/dev builds
   * have none and stay honestly unsupported.
   */
  systemHelper?: SystemTrustHelper;
}

export function createProxyTrustService(deps: ProxyTrustDeps = {}): ProxyTrustService {
  const exec = deps.exec ?? defaultExec;
  const homedir = deps.homedir ?? os.homedir();
  const platform = deps.platform ?? process.platform;
  const now = deps.now ?? Date.now;
  const systemHelper = deps.systemHelper ?? createSystemTrustHelper();
  const keychainDeps = { exec, ...(deps.tmpdir !== undefined ? { tmpdir: deps.tmpdir } : {}) };

  function keychainPath(store: 'macos-login-keychain' | 'macos-system-keychain'): string {
    return store === 'macos-login-keychain' ? loginKeychainPath(homedir) : SYSTEM_KEYCHAIN_PATH;
  }

  async function probeStore(
    store: ProxyTrustStoreId,
    ref: string,
    expectedFingerprintSha256: string | null,
  ): Promise<ProxyTrustStoreState> {
    if (store === 'nss-firefox') return probeNssProfile(expectedFingerprintSha256, ref, exec);
    return probeKeychain(PROXY_CA_COMMON_NAME, expectedFingerprintSha256, store, ref, exec);
  }

  async function status(): Promise<ProxyTrustStatus> {
    const caRead = await readProxyCa();
    const caRecord = caRead === 'undecryptable' || caRead === null ? null : caRead;
    const caFingerprint = caRecord !== null ? certFingerprints(caRecord.certPem).sha256 : null;
    const changes = await listTrustChanges();
    // Expected stores on this machine, then any recorded ref not already
    // covered (a profile deleted since install still gets probed so the
    // record's row can be reasoned about).
    const targets: Array<{ store: ProxyTrustStoreId; ref: string }> = [];
    if (platform === 'darwin') {
      targets.push({ store: 'macos-login-keychain', ref: keychainPath('macos-login-keychain') });
      targets.push({ store: 'macos-system-keychain', ref: SYSTEM_KEYCHAIN_PATH });
    }
    for (const profile of await discoverFirefoxProfiles(homedir, platform)) {
      targets.push({ store: 'nss-firefox', ref: profile });
    }
    for (const change of changes) {
      if (!targets.some((t) => t.store === change.store && t.ref === change.ref)) {
        targets.push({ store: change.store, ref: change.ref });
      }
    }
    const stores: ProxyTrustStoreState[] = [];
    for (const target of targets) {
      const recorded = changes.find((c) => c.store === target.store && c.ref === target.ref);
      const expected = caFingerprint ?? recorded?.fingerprintSha256 ?? null;
      stores.push(await probeStore(target.store, target.ref, expected));
    }
    return {
      ca: caRecord !== null ? proxyCaPublicInfo(caRecord) : null,
      stores,
      changes,
      systemKeychainTrustSupported: (await systemHelper.probe()).available,
    };
  }

  async function installOne(ca: ProxyCaRecord, store: ProxyTrustStoreId, ref: string): Promise<ProxyTrustStoreResult> {
    const prints = certFingerprints(ca.certPem);
    const hadRow = (await listTrustChanges()).some((c) => c.store === store && c.ref === ref);
    // Record-before-change: a crash between here and the command leaves
    // a row teardown will re-verify, never trust the record misses.
    await upsertTrustChange({ store, ref, fingerprintSha256: prints.sha256, fingerprintSha1: prints.sha1, at: now() });
    const result: TrustStoreOpResult =
      store === 'nss-firefox'
        ? await installCaInNssProfile(ca.certPem, ref, exec, deps.tmpdir)
        : store === 'macos-system-keychain'
          ? await installCaViaHelper(ca.certPem, systemHelper)
          : await installCaInKeychain(ca.certPem, keychainPath(store), keychainDeps);
    if (!result.ok) {
      if (result.toolMissing === true) {
        // The tool never ran, so THIS attempt cannot have changed the
        // store — a first-time row retracts (nothing to guard); a
        // pre-existing row may guard real earlier content and stays.
        if (!hadRow) await dropTrustChange(store, ref);
        return { store, ref, ok: false, ...(result.error !== undefined ? { error: result.error } : {}) };
      }
      // The command refused. Re-probe to see what actually landed: only a
      // store that verifiably holds nothing of ours retracts the row; a
      // cert that imported but could not be trusted (`untrusted`) is
      // residue — keep the row so teardown covers it, and never report it
      // as "elevation declined / left unchanged" (the store DID change).
      const probed = await probeStore(store, ref, prints.sha256);
      if (probed.state === 'absent') await dropTrustChange(store, ref);
      const cleanlyRefused = probed.state === 'absent';
      return {
        store,
        ref,
        ok: false,
        ...(result.error !== undefined ? { error: result.error } : {}),
        ...(cleanlyRefused && result.elevationRequired === true ? { elevationRequired: true } : {}),
        ...(probed.state === 'untrusted' ? { residue: true } : {}),
      };
    }
    return { store, ref, ok: true };
  }

  async function install(storeIds: readonly ProxyTrustStoreId[]): Promise<ProxyTrustInstallResult> {
    if (storeIds.length === 0) {
      return { ok: false, error: 'no trust stores named — consent must pick explicit stores' };
    }
    let ca: ProxyCaRecord;
    try {
      ca = await ensureProxyCa(now);
    } catch (err) {
      return { ok: false, error: (err as Error).message };
    }
    const results: ProxyTrustStoreResult[] = [];
    for (const store of [...new Set(storeIds)]) {
      if (store !== 'nss-firefox' && platform !== 'darwin') {
        results.push({ store, ref: '', ok: false, error: `${store} is not available on this platform` });
        continue;
      }
      if (store === 'macos-system-keychain' && !(await systemHelper.probe()).available) {
        // Refuse rather than half-install: without a reachable privileged
        // helper nothing can write (or undo) admin-domain trust, so an
        // attempt could only leave an un-removable residue. No row is
        // written; the wizard disables this option while unsupported.
        results.push({
          store,
          ref: SYSTEM_KEYCHAIN_PATH,
          ok: false,
          error: 'System-keychain trust is not available in this build — it requires the OpenHeaders privileged helper',
        });
        continue;
      }
      if (store === 'nss-firefox') {
        const profiles = await discoverFirefoxProfiles(homedir, platform);
        if (profiles.length === 0) {
          results.push({ store, ref: '', ok: false, error: 'no Firefox profiles found' });
          continue;
        }
        for (const profile of profiles) {
          results.push(await installOne(ca, store, profile));
        }
        continue;
      }
      results.push(await installOne(ca, store, keychainPath(store)));
    }
    return { ok: true, ca: proxyCaPublicInfo(ca), results };
  }

  async function removeOne(change: ProxyTrustChange, certPem: string | null): Promise<ProxyTrustStoreResult> {
    const { store, ref } = change;
    let result: TrustStoreOpResult;
    if (store === 'nss-firefox') {
      result = await removeCaFromNssProfile(ref, exec);
    } else if (certPem !== null && store === 'macos-system-keychain') {
      result = await removeCaViaHelper(certPem, change.fingerprintSha1, systemHelper);
    } else if (certPem !== null) {
      result = await removeCaFromKeychain(certPem, change.fingerprintSha1, ref, keychainDeps);
    } else {
      // Without the cert the trust-settings half can't be undone — keep
      // the row and say so rather than half-remove (§5).
      return { store, ref, ok: false, error: 'CA record unavailable — cannot undo keychain trust settings' };
    }
    if (!result.ok) {
      return {
        store,
        ref,
        ok: false,
        ...(result.error !== undefined ? { error: result.error } : {}),
        ...(result.elevationRequired === true ? { elevationRequired: true } : {}),
      };
    }
    // Verified removal: OUR fingerprint must be physically GONE. `absent`
    // and `mismatch` (a foreign cert we never installed) both qualify. A
    // still-`trusted` store obviously fails; so does `untrusted` — the
    // trust settings came off but our cert bytes are still in the store,
    // which is not clean and must not drop the row. `unavailable` keeps
    // the row for the next attempt.
    const probed = await probeStore(store, ref, change.fingerprintSha256);
    if (probed.state === 'trusted') {
      return { store, ref, ok: false, error: 'store still trusts the certificate after removal' };
    }
    if (probed.state === 'untrusted') {
      return { store, ref, ok: false, error: 'certificate is still present in the store after removal' };
    }
    if (probed.state === 'unavailable') {
      return { store, ref, ok: false, ...(probed.detail !== undefined ? { error: probed.detail } : {}) };
    }
    await dropTrustChange(store, ref);
    return { store, ref, ok: true };
  }

  async function remove(dropCa = false): Promise<ProxyTrustRemoveResult> {
    const caRead = await readProxyCa();
    const certPem = caRead === 'undecryptable' || caRead === null ? null : caRead.certPem;
    const changes = await listTrustChanges();
    const results: ProxyTrustStoreResult[] = [];
    for (const change of changes) {
      results.push(await removeOne(change, certPem));
    }
    const allClean = results.every((r) => r.ok);
    if (dropCa && allClean && caRead !== null) {
      // Only once every store is verifiably clean — the CA cert is what
      // a later removal retry would need.
      await dropProxyCa();
    }
    return { ok: allClean, results };
  }

  /**
   * Helper-management surface for the Settings card: binary presence,
   * live XPC reachability, and the read-only SMAppService registration
   * state — all re-derived per call, never cached.
   */
  async function helperState(): Promise<ProxyTrustHelperState> {
    if (!systemHelper.present()) {
      return { present: false, available: false, registration: null };
    }
    const probed = await systemHelper.probe();
    const sm = await systemHelper.smStatus();
    return {
      present: true,
      available: probed.available,
      ...(probed.reason !== undefined ? { reason: probed.reason } : {}),
      registration: sm.ok && sm.status !== undefined ? sm.status : null,
    };
  }

  return {
    status,
    install,
    remove,
    helperState,
    helperRegister: () => systemHelper.register(),
    helperUnregister: () => systemHelper.unregister(),
    helperOpenLoginItems: () => systemHelper.openLoginItems(),
  };
}
