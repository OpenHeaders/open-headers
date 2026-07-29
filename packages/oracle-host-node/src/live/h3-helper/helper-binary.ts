/**
 * Helper binary resolution. The dev / live-pass override is the
 * `OPENHEADERS_H3_HELPER` env var (static-bundling law: this is not a
 * distribution channel); packaged per-platform paths arrive with the
 * distribution slice. `null` = no helper on this install — the
 * transport fails a `'3'` send honestly PRE-wire.
 */

import { existsSync } from 'node:fs';

export function resolveH3HelperBinary(): string | null {
  const override = process.env.OPENHEADERS_H3_HELPER;
  if (override !== undefined && override !== '' && existsSync(override)) return override;
  return null;
}
