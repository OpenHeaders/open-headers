import { describe, expect, it } from 'vitest';
import * as YAML from 'yaml';
import { parseSpec, parseSpecInline, serializeSpec } from '../../src/codec/yaml';
import { freshDocument, mergePatch } from '../../src/schemas/document';
import { serializeEntityYaml } from '../../src/workspace-export';
import type { Spec } from '../../src/types';

const ROOT_CONTENT = [
  "openapi: '3.1.0'",
  'info:',
  '  title: OpenHeaders API',
  "  version: '1.0.0'",
  'servers:',
  '  - url: https://api.openheaders.io/v1',
  'paths: {}',
  '',
].join('\n');

const spec = (overrides: Partial<Spec> = {}): Spec => ({
  schemaVersion: 5,
  uid: 'spec0001',
  path: 'specs/openheaders-api-spec0001',
  name: 'OpenHeaders API',
  format: 'openapi-3.1',
  rootFileUid: 'file0001',
  files: [{ uid: 'file0001', fileName: 'index.yaml', content: ROOT_CONTENT }],
  ...overrides,
});

describe('serializeSpec', () => {
  it('keeps source content out of the manifest and fans it out verbatim', () => {
    const out = serializeSpec(freshDocument(spec()));
    expect(out.specYaml).not.toContain('openapi:');
    expect(out.specYaml).toContain('rootFileUid: file0001');
    expect(out.specYaml).toContain('fileName: index.yaml');
    expect(out.files).toEqual([{ fileName: 'index.yaml', content: ROOT_CONTENT }]);
  });

  it('strips the runtime-only path from the manifest', () => {
    const out = serializeSpec(freshDocument(spec()));
    expect(out.specYaml).not.toContain('specs/openheaders-api-spec0001');
  });

  it('emits one sibling per files[] row', () => {
    const two = spec({
      files: [
        { uid: 'file0001', fileName: 'index.yaml', content: ROOT_CONTENT },
        { uid: 'file0002', fileName: 'components/schemas.yaml', content: 'components: {}\n' },
      ],
    });
    const out = serializeSpec(freshDocument(two));
    expect(out.files.map((f) => f.fileName)).toEqual(['index.yaml', 'components/schemas.yaml']);
  });
});

describe('parseSpec', () => {
  it('round-trips serialize → parse byte-identically', () => {
    const entity = spec({ description: 'design-time source of truth' });
    const out = serializeSpec(freshDocument(entity));
    const parsed = parseSpec(out.specYaml, {
      path: entity.path,
      siblings: out.files,
    });
    expect(parsed.value).toEqual(entity);
  });

  it('parses a catalog row with a missing sibling as empty content', () => {
    const out = serializeSpec(freshDocument(spec()));
    const parsed = parseSpec(out.specYaml, { path: 'specs/openheaders-api-spec0001', siblings: [] });
    expect(parsed.value.files).toEqual([{ uid: 'file0001', fileName: 'index.yaml', content: '' }]);
  });

  it('ignores unrecognized siblings', () => {
    const out = serializeSpec(freshDocument(spec()));
    const parsed = parseSpec(out.specYaml, {
      path: 'specs/openheaders-api-spec0001',
      siblings: [...out.files, { fileName: 'notes.txt', content: 'scratch' }],
    });
    expect(parsed.value.files).toHaveLength(1);
    expect(parsed.value.files[0].content).toBe(ROOT_CONTENT);
  });

  it('preserves unknown manifest keys through a round-trip (invariant #4)', () => {
    const out = serializeSpec(freshDocument(spec()));
    const doc = YAML.parseDocument(out.specYaml);
    doc.set('futureKey', 'kept');
    const parsed = parseSpec(doc.toString(), {
      path: 'specs/openheaders-api-spec0001',
      siblings: out.files,
    });
    const reserialized = serializeSpec(mergePatch(parsed, () => {}));
    expect(reserialized.specYaml).toContain('futureKey: kept');
  });

  it('orders manifest fields metadata-top (invariant #6)', () => {
    const out = serializeSpec(freshDocument(spec({ description: 'ordered' })));
    const keys = Object.keys(YAML.parse(out.specYaml) as Record<string, unknown>);
    expect(keys).toEqual(['schemaVersion', 'uid', 'name', 'description', 'format', 'rootFileUid', 'files']);
  });
});

describe('parseSpecInline', () => {
  it('round-trips the entity-yaml inline shape (merge-editor contract)', () => {
    const entity = spec({ description: 'inline round-trip' });
    const inline = serializeEntityYaml('spec', entity);
    expect(inline).toContain('openapi:'); // content rides in-row, unlike the manifest
    const parsed = parseSpecInline(inline, { path: entity.path });
    expect(parsed.value).toEqual(entity);
  });

  it('throws on a document that fails the Spec schema', () => {
    expect(() => parseSpecInline('name: broken\n', { path: 'specs/broken' })).toThrow();
  });
});
