import { describe, expect, it } from 'vitest';
import { parseTrustedRoots, serializeTrustedRoots } from '../../../src/codec/yaml/trusted-roots';
import { freshDocument } from '../../../src/schemas/document';
import type { TrustedRoots } from '../../../src/types';

const PEM = '-----BEGIN CERTIFICATE-----\nMIIB\n-----END CERTIFICATE-----\n';

describe('trusted-roots yaml codec', () => {
  it('round-trips a record through serialize → parse', () => {
    const value: TrustedRoots = {
      schemaVersion: 5,
      roots: [{ uid: 'root0001', name: 'Corp Root', certPem: PEM, addedAt: '2026-08-27T00:00:00.000Z' }],
    };
    const yaml = serializeTrustedRoots(freshDocument(value));
    expect(yaml.startsWith('schemaVersion: 5\nroots:')).toBe(true);
    expect(parseTrustedRoots(yaml).value).toEqual(value);
  });

  it('mints a uid for a hand-added row without one', () => {
    const yaml = `schemaVersion: 5\nroots:\n  - name: Hand-added\n    certPem: |\n      ${PEM.replace(/\n/g, '\n      ')}\n    addedAt: '2026-08-27T00:00:00.000Z'\n`;
    const parsed = parseTrustedRoots(yaml).value;
    expect(parsed.roots).toHaveLength(1);
    expect(parsed.roots[0].uid).toMatch(/^[a-z0-9]{8}$/);
    expect(parsed.roots[0].name).toBe('Hand-added');
  });
});
