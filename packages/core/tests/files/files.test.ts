/**
 * FileRef + FileRegistry coverage. The registry is a pure in-memory
 * index; the actual blob bytes live in the platform-specific
 * BlobStore (IDB on the extension, OPFS on the desktop).
 */

import * as v from 'valibot';
import { describe, expect, it } from 'vitest';
import {
  buildFileRegistry,
  EMPTY_FILE_REGISTRY,
  type FileRef,
  isPlaceholderFileRef,
  PLACEHOLDER_HASH_PREFIX,
  placeholderFileRef,
  resolveFileRef,
} from '../../src/files';
import { FileRefSchema } from '../../src/schemas/request';

let FIXTURE_ID_COUNTER = 0;
const fixtureRef = (overrides: Partial<FileRef> = {}): FileRef => ({
  fileId: `file:fixture-${++FIXTURE_ID_COUNTER}`,
  hash: 'sha256:a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2',
  filename: 'fixture.json',
  mimeType: 'application/json',
  size: 42,
  ...overrides,
});

describe('buildFileRegistry', () => {
  it('indexes empty list as empty registry', () => {
    const reg = buildFileRegistry([]);
    expect(reg.byLabel.size).toBe(0);
    expect(reg.byHash.size).toBe(0);
  });

  it('indexes each ref by filename and hash', () => {
    const ref = fixtureRef();
    const reg = buildFileRegistry([ref]);
    expect(reg.byLabel.get('fixture.json')).toBe(ref);
    expect(reg.byHash.get(ref.hash)).toBe(ref);
  });

  it('first-insertion-wins on duplicate filename (byLabel only)', () => {
    const first = fixtureRef({
      filename: 'invoice.pdf',
      hash: 'sha256:1111111111111111111111111111111111111111111111111111111111111111',
    });
    const second = fixtureRef({
      filename: 'invoice.pdf',
      hash: 'sha256:2222222222222222222222222222222222222222222222222222222222222222',
    });
    const reg = buildFileRegistry([first, second]);
    expect(reg.byLabel.get('invoice.pdf')).toBe(first);
    // Both hashes are distinct identities.
    expect(reg.byHash.get(first.hash)).toBe(first);
    expect(reg.byHash.get(second.hash)).toBe(second);
  });
});

describe('resolveFileRef', () => {
  it('returns null for missing labels', () => {
    const reg = buildFileRegistry([fixtureRef()]);
    expect(resolveFileRef(reg, 'missing.txt')).toBeNull();
  });

  it('resolves by filename', () => {
    const ref = fixtureRef({ filename: 'logo.png' });
    const reg = buildFileRegistry([ref]);
    expect(resolveFileRef(reg, 'logo.png')).toBe(ref);
  });

  it('resolves by explicit sha256 hash', () => {
    const ref = fixtureRef();
    const reg = buildFileRegistry([ref]);
    expect(resolveFileRef(reg, ref.hash)).toBe(ref);
  });

  it('returns null when sha256 prefix matches but hash is missing', () => {
    const reg = buildFileRegistry([fixtureRef()]);
    expect(resolveFileRef(reg, 'sha256:0000000000000000000000000000000000000000000000000000000000000000')).toBeNull();
  });

  it('EMPTY_FILE_REGISTRY always misses', () => {
    expect(resolveFileRef(EMPTY_FILE_REGISTRY, 'anything')).toBeNull();
    expect(
      resolveFileRef(EMPTY_FILE_REGISTRY, 'sha256:a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2'),
    ).toBeNull();
  });
});

describe('placeholderFileRef — importer reconciliation', () => {
  it('builds a FileRef with the placeholder prefix + encoded filename', () => {
    const ref = placeholderFileRef({ filename: 'invoice.pdf' });
    expect(ref.hash.startsWith(PLACEHOLDER_HASH_PREFIX)).toBe(true);
    expect(ref.hash).toBe('placeholder:invoice.pdf');
    expect(ref.filename).toBe('invoice.pdf');
    expect(ref.size).toBe(0);
  });

  it('URL-encodes filenames with whitespace and non-ASCII so the hash regex accepts them', () => {
    const ref = placeholderFileRef({ filename: 'ñ spaced & ?.png' });
    expect(ref.hash).toBe('placeholder:%C3%B1%20spaced%20%26%20%3F.png');
    // Round-trips through the schema (proves the regex accepts placeholders).
    expect(() => v.parse(FileRefSchema, ref)).not.toThrow();
  });

  it('falls back to "missing" filename when the importer has nothing to say', () => {
    const ref = placeholderFileRef({ filename: '' });
    expect(ref.filename).toBe('missing');
    expect(ref.hash).toBe('placeholder:missing');
  });

  it('carries optional mimeType through verbatim', () => {
    const ref = placeholderFileRef({ filename: 'x.png', mimeType: 'image/png' });
    expect(ref.mimeType).toBe('image/png');
  });

  it('isPlaceholderFileRef distinguishes placeholders from real sha256 refs', () => {
    const placeholder = placeholderFileRef({ filename: 'a.bin' });
    const real: FileRef = {
      fileId: 'file:real-a',
      hash: 'sha256:a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2',
      filename: 'a.bin',
      size: 4,
    };
    expect(isPlaceholderFileRef(placeholder)).toBe(true);
    expect(isPlaceholderFileRef(real)).toBe(false);
  });

  it('resolveFileRef never surfaces a placeholder from a registry (registry only ever holds real blobs)', () => {
    // Placeholders aren't stored — registry.byHash is keyed by real
    // sha256 hashes. Asking for a placeholder hash yields null so the
    // executor silently skips the part (matches "missing blob" drop).
    const ref = placeholderFileRef({ filename: 'x.png' });
    const reg = buildFileRegistry([]);
    expect(resolveFileRef(reg, ref.hash)).toBeNull();
  });
});

describe('FileRefSchema — placeholder + real ref discipline', () => {
  it('accepts real sha256 hashes', () => {
    expect(() =>
      v.parse(FileRefSchema, {
        fileId: 'file:abc-123',
        hash: 'sha256:a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2',
        filename: 'x.png',
        size: 10,
      }),
    ).not.toThrow();
  });

  it('accepts placeholder hashes emitted by importers', () => {
    expect(() =>
      v.parse(FileRefSchema, {
        fileId: 'placeholder:some-label',
        hash: 'placeholder:some-label',
        filename: 'some-label',
        size: 0,
      }),
    ).not.toThrow();
  });

  it('rejects malformed hashes (wrong prefix, wrong length)', () => {
    const bad = [
      { fileId: 'file:a', hash: 'md5:abc', filename: 'x', size: 0 },
      { fileId: 'file:a', hash: 'sha256:short', filename: 'x', size: 0 },
      { fileId: 'file:a', hash: '', filename: 'x', size: 0 },
    ];
    for (const b of bad) {
      expect(() => v.parse(FileRefSchema, b)).toThrow();
    }
  });

  it('rejects missing fileId', () => {
    expect(() =>
      v.parse(FileRefSchema, {
        hash: 'sha256:a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2',
        filename: 'x.png',
        size: 10,
      }),
    ).toThrow();
  });
});
