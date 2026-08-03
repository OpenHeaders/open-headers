/**
 * Shared dual-app harness plumbing for the agent-traffic e2e specs —
 * the extension-side keep-alive page and the encrypted backend-registry
 * seeding that every spec in the family needs (previously copied
 * per-spec; lifted once the family reached four specs).
 *
 * The cipher-seed guard (the S0 rider): the extension encrypts
 * `oh.backends` with an at-rest AES key it mints in IndexedDB on
 * startup. Seeding races that mint, so the read (a) probes EXISTENCE
 * via `indexedDB.databases()` first — an eager `indexedDB.open()`
 * would CREATE the schema-less husk it then trips on — (b) heals a
 * husk by deleting it, and (c) rejects on a timeout instead of hanging,
 * so the caller's retry loop can spin.
 */

import type { BrowserContext, Page } from '@playwright/test';

export interface ExtensionSeedHarnessDeps {
  /** The persistent Chromium context (set during beforeAll). */
  readonly context: () => BrowserContext | undefined;
  readonly extensionId: () => string;
  /** Daemon auth token (minted during beforeAll). */
  readonly token: () => string;
  readonly daemonPort: number;
  /** Backend registry record identity — unique per spec. */
  readonly recordId: string;
  readonly recordLabel: string;
  /** Prefix for retry-loop log lines, e.g. `agent-traffic-tools setup`. */
  readonly logTag: string;
}

export interface ExtensionSeedHarness {
  /** The extension page — MV3 keep-alive client + storage evaluate
   *  surface (never the worker context; lazily recreated, per the
   *  live-network harness rationale). */
  extensionPage(): Promise<Page>;
  /** (Re-)seed the extension's backend registry record — same
   *  encrypted blob as the live-network harness, cipher-guarded. */
  seedBackend(seed: { enabled: boolean }): Promise<void>;
  /** Seed with the retry loop the cipher-mint race requires. */
  seedBackendRetrying(seed: { enabled: boolean }): Promise<void>;
}

export function createExtensionSeedHarness(deps: ExtensionSeedHarnessDeps): ExtensionSeedHarness {
  let popup: Page | null = null;

  async function extensionPage(): Promise<Page> {
    if (popup && !popup.isClosed()) return popup;
    const context = deps.context();
    if (!context) throw new Error('extension context not launched');
    const page = await context.newPage();
    await page.goto(`chrome-extension://${deps.extensionId()}/merge-showcase.html`);
    await page.waitForLoadState('load');
    popup = page;
    return page;
  }

  async function seedBackend(seed: { enabled: boolean }): Promise<void> {
    const page = await extensionPage();
    await page.evaluate(
      async ({ backendUrl, authToken, enabled, recordId, recordLabel }) => {
        // Existence probe first — an eager indexedDB.open would CREATE
        // an empty schema-less DB and race the extension's cipher init.
        const databases = await indexedDB.databases();
        if (!databases.some((d) => d.name === 'oh-secret-cipher')) {
          throw new Error('cipher db not yet created');
        }
        const key = await Promise.race([
          new Promise<CryptoKey>((resolve, reject) => {
            const open = indexedDB.open('oh-secret-cipher');
            open.onerror = () => reject(open.error);
            open.onsuccess = () => {
              const db = open.result;
              if (!db.objectStoreNames.contains('keys')) {
                // A schema-less husk (e.g. from an earlier eager open)
                // blocks the extension's init — heal by deleting it.
                db.close();
                const drop = indexedDB.deleteDatabase('oh-secret-cipher');
                drop.onsuccess = drop.onerror = () => reject(new Error('cipher db was empty — healed, retrying'));
                return;
              }
              const request = db.transaction('keys', 'readonly').objectStore('keys').get('at-rest-aes-gcm-v1');
              request.onerror = () => reject(request.error);
              request.onsuccess = () =>
                request.result
                  ? resolve(request.result as CryptoKey)
                  : reject(new Error('cipher key not yet minted'));
            };
          }),
          new Promise<never>((_, reject) => setTimeout(() => reject(new Error('cipher read timed out')), 4000)),
        ]);
        const record = {
          id: recordId,
          label: recordLabel,
          url: backendUrl,
          authToken,
          autoConnect: true,
          enabled,
          addedAt: new Date().toISOString(),
          lastConnectedAt: null,
        };
        const iv = crypto.getRandomValues(new Uint8Array(12));
        const ciphertext = await crypto.subtle.encrypt(
          { name: 'AES-GCM', iv },
          key,
          new TextEncoder().encode(JSON.stringify([record])),
        );
        const packed = new Uint8Array(iv.length + ciphertext.byteLength);
        packed.set(iv, 0);
        packed.set(new Uint8Array(ciphertext), iv.length);
        let binary = '';
        for (const byte of packed) binary += String.fromCharCode(byte);
        await new Promise<void>((resolve) => {
          chrome.storage.local.set({ onboardingCompleted: true, 'oh.backends': `v1:${btoa(binary)}` }, () => resolve());
        });
      },
      {
        backendUrl: `ws://127.0.0.1:${deps.daemonPort}`,
        authToken: deps.token(),
        enabled: seed.enabled,
        recordId: deps.recordId,
        recordLabel: deps.recordLabel,
      },
    );
  }

  async function seedBackendRetrying(seed: { enabled: boolean }): Promise<void> {
    let seedError: unknown;
    for (let attempt = 0; attempt < 8; attempt++) {
      try {
        await seedBackend(seed);
        return;
      } catch (err) {
        seedError = err;
        console.log(`[${deps.logTag}] seed attempt ${attempt} failed: ${String(err).split('\n')[0]}`);
        await new Promise((resolve) => setTimeout(resolve, 1500));
        // Keep the page across retries — extensionPage() recreates only
        // when it actually closed (a not-yet-minted cipher key is a
        // waiting condition, not a dead page).
      }
    }
    throw new Error(`seedBackend failed: ${String(seedError)}`);
  }

  return { extensionPage, seedBackend, seedBackendRetrying };
}
