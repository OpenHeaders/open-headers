/**
 * `ohd show-token` — the first-boot pairing bootstrap
 * (the daemon plan §6/§7 Phase 2). Mints a real ledger token through
 * `mintDaemonAuthToken` against the daemon's own `storage.json` and
 * returns the raw secret (surfaced exactly once — the ledger stores
 * only the SHA-256 hash) plus every URL a client might join at.
 *
 * Offline by design: `FileBackedHostStorage` is single-writer, and a
 * running daemon holds the whole envelope in memory — a concurrent
 * CLI mint would be clobbered by the daemon's next flush and invisible
 * to its validator. The caller guards with a `/healthz` probe and
 * refuses while the daemon is up; the daemon reads the fresh ledger on
 * its next boot. Tokens minted after first boot come from a connected
 * admin surface (`oh.daemon.tokens.mint`), later the served web app.
 */

import * as path from 'node:path';
import { mintDaemonAuthToken } from '@openheaders/core/identity';
import { setHostStorage } from '@openheaders/core/storage';
import { FileBackedHostStorage } from '@openheaders/oracle-host-node/host-storage';
import type { DaemonConfig } from '../config';
import { resolveDaemonCipher } from '../vault-cipher';
import { type JoinUrl, joinUrlsFor } from './join-urls';

export interface BootstrapTokenResult {
  readonly tokenId: string;
  /** Raw `oh_` secret — shown once, never persisted. */
  readonly secret: string;
  readonly joinUrls: readonly JoinUrl[];
}

export async function mintBootstrapToken(
  config: DaemonConfig,
  label?: string,
  userId?: string,
): Promise<BootstrapTokenResult> {
  const storage = new FileBackedHostStorage({
    filePath: path.join(config.dataDir, 'storage.json'),
    secretCipher: resolveDaemonCipher(config),
  });
  setHostStorage(storage);
  const { record, secret } = await mintDaemonAuthToken({ label, ...(userId !== undefined ? { userId } : {}) });

  return { tokenId: record.id, secret, joinUrls: joinUrlsFor(config.bindAddress, config.bindPort) };
}
