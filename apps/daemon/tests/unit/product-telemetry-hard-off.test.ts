/**
 * Hard-off gate for product telemetry (the telemetry plan §2): the
 * standalone daemon distribution phones home nothing — off by
 * construction, not by flag. A text-level sweep pins that: no module
 * in this app may import the core telemetry client, answer a
 * `productTelemetry*` channel, or know the ingestion endpoint. The
 * spine it boots carries its own twin of this gate in
 * `@openheaders/oracle-host-node`.
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const srcRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', 'src');

const FORBIDDEN = ['core/telemetry', 'productTelemetry', 'product-telemetry', 'telemetry.openheaders.com'];

function sourceFiles(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return sourceFiles(full);
    return entry.name.endsWith('.ts') || entry.name.endsWith('.tsx') ? [full] : [];
  });
}

describe('daemon distribution — product telemetry hard-off', () => {
  it('carries no telemetry import, channel, or endpoint anywhere in src/', () => {
    for (const file of sourceFiles(srcRoot)) {
      const text = fs.readFileSync(file, 'utf8');
      for (const token of FORBIDDEN) {
        expect(text.includes(token), `${path.relative(srcRoot, file)} references "${token}"`).toBe(false);
      }
    }
  });
});
