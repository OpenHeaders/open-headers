/**
 * HTTP/3 helper bootstrap (the request-engine H3-protocol design): where
 * the daemon finds the bundled `oh-h3-helper` binary the `'3'`
 * HTTP-version pin spawns. Two distribution faces, one locator: the
 * SEA build unpacks the helper embedded in the binary (lazily — the
 * payload only materializes on the first `'3'` send), and the
 * plain-Node distribution reads the per-target dir staged beside the
 * daemon bundle (`dist/h3-helper/<target>/`). Neither present keeps
 * the transport's honest not-bundled failure.
 */

import { chmodSync, existsSync } from 'node:fs';
import * as path from 'node:path';
import {
  h3HelperBinaryName,
  h3HelperTargetName,
  registerH3HelperLocator,
} from '@openheaders/oracle-host-node/live/h3-helper/helper-binary';
import { ensureSeaPayload } from './sea/payload';

function locateH3Helper(): string | null {
  const binaryName = h3HelperBinaryName();
  const unpacked = ensureSeaPayload('helper');
  if (unpacked !== null) {
    const binary = path.join(unpacked, binaryName);
    if (!existsSync(binary)) return null;
    // The payload extractor writes plain files — the spawn needs the
    // execute bit back.
    chmodSync(binary, 0o755);
    return binary;
  }
  // "Beside the daemon bundle" anchors on the entry script, the same
  // rule the static web root uses — both entries (`dist/main.js`,
  // `dist/cli.js`) sit beside the staged `h3-helper/` dir.
  const target = h3HelperTargetName();
  const entryScript = process.argv[1];
  if (target === null || entryScript === undefined) return null;
  return path.join(path.dirname(path.resolve(entryScript)), 'h3-helper', target, binaryName);
}

/** Register the daemon's helper locator — call once at boot. */
export function installH3HelperLocator(): void {
  registerH3HelperLocator(locateH3Helper);
}
