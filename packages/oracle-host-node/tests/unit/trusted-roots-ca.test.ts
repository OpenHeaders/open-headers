/**
 * The trusted-roots host law: additive behind the runtime bundle, and
 * an empty list leaves the `ca` option unset.
 */

import { rootCertificates } from 'node:tls';
import { describe, expect, it } from 'vitest';
import { caOptionFor } from '../../src/live/trusted-roots-ca';

const ROOT_A = '-----BEGIN CERTIFICATE-----\nAAA\n-----END CERTIFICATE-----\n';
const ROOT_B = '-----BEGIN CERTIFICATE-----\nBBB\n-----END CERTIFICATE-----\n';

describe('caOptionFor', () => {
  it('an absent or empty list leaves the option unset — the runtime default path untouched', () => {
    expect(caOptionFor(undefined)).toBeUndefined();
    expect(caOptionFor([])).toBeUndefined();
  });

  it('appends the workspace roots BEHIND the full runtime bundle, in order', () => {
    const ca = caOptionFor([ROOT_A, ROOT_B]);
    expect(ca).toBeDefined();
    expect(ca?.length).toBe(rootCertificates.length + 2);
    expect(ca?.slice(0, rootCertificates.length)).toEqual([...rootCertificates]);
    expect(ca?.slice(-2)).toEqual([ROOT_A, ROOT_B]);
  });

  it('never hands back the caller’s array', () => {
    const roots = [ROOT_A];
    const ca = caOptionFor(roots);
    expect(ca).not.toBe(roots);
  });
});
