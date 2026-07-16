import { SPEC_FILES_PATH } from '@openheaders/core/sync';
import type { Spec, SpecFile } from '@openheaders/core/types';
import { DEFAULT_LOCALE, getTranslator } from '@openheaders/i18n';
import { SPEC_PATHS } from '@openheaders/ui/shared/awareness/spec-paths';
import {
  specConflictAdapter,
  specResolveAdapter,
} from '@openheaders/ui/workbench/components/specs/spec-conflict-adapter';
import { describe, expect, it } from 'vitest';

const t = getTranslator(DEFAULT_LOCALE);

const ROOT_CONTENT = "openapi: '3.1.0'\ninfo:\n  title: OpenHeaders API\n  version: '1.0.0'\n";

function makeFile(overrides: Partial<SpecFile> = {}): SpecFile {
  return {
    uid: 'file0001',
    fileName: 'index.yaml',
    content: ROOT_CONTENT,
    ...overrides,
  };
}

function makeSpec(overrides: Partial<Spec> = {}): Spec {
  return {
    schemaVersion: 5,
    uid: 'spec0001',
    path: 'specs/spec0001.yaml',
    name: 'OpenHeaders API',
    description: 'API for openheaders.io',
    format: 'openapi-3.1',
    rootFileUid: 'file0001',
    files: [makeFile()],
    ...overrides,
  };
}

describe('specConflictAdapter', () => {
  it('extracts scalar leaves plus per-file leaves', () => {
    const baseline = specConflictAdapter.extractBaseline(makeSpec());
    expect(baseline).toEqual({
      name: 'OpenHeaders API',
      description: 'API for openheaders.io',
      format: 'openapi-3.1',
      rootFileUid: 'file0001',
      'files.file0001.fileName': 'index.yaml',
      'files.file0001.content': ROOT_CONTENT,
    });
  });

  it('reads scalar and file leaves by path', () => {
    const spec = makeSpec({ format: 'openapi-3.0' });
    expect(specConflictAdapter.readPath(spec, 'format')).toBe('openapi-3.0');
    expect(specConflictAdapter.readPath(spec, 'rootFileUid')).toBe('file0001');
    expect(specConflictAdapter.readPath(spec, 'files.file0001.content')).toBe(ROOT_CONTENT);
    expect(specConflictAdapter.readPath(spec, 'unknown.path')).toBeNull();
  });

  it('handles missing optional description as empty string', () => {
    expect(specConflictAdapter.readPath(makeSpec({ description: undefined }), 'description')).toBe('');
  });

  it('snapshots the files set with fileName summaries', () => {
    const spec = makeSpec({
      files: [makeFile(), makeFile({ uid: 'file0002', fileName: 'paths/users.yaml', content: 'get: {}\n' })],
    });
    const snapshots = specConflictAdapter.snapshotSets(spec);
    expect(snapshots).toHaveLength(1);
    expect(snapshots[0].setPath).toBe('files');
    expect([...snapshots[0].byUid.keys()]).toEqual(['file0001', 'file0002']);
    expect([...snapshots[0].byUid.values()].map((m) => m.summary)).toEqual(['index.yaml', 'paths/users.yaml']);
  });
});

describe('specResolveAdapter', () => {
  it('writes scalar leaves into the entity clone', () => {
    const spec = makeSpec();
    specResolveAdapter.applyResolutionToEntity(spec, 'name', { base: '', theirs: 'Renamed API' });
    expect(spec.name).toBe('Renamed API');
    specResolveAdapter.applyResolutionToEntity(spec, 'format', { base: '', theirs: 'openapi-3.0' });
    expect(spec.format).toBe('openapi-3.0');
    specResolveAdapter.applyResolutionToEntity(spec, 'rootFileUid', { base: '', theirs: 'file0002' });
    expect(spec.rootFileUid).toBe('file0002');
  });

  it('writes file leaves through uid-set navigation', () => {
    const spec = makeSpec();
    const updated = "openapi: '3.1.0'\ninfo:\n  title: Renamed\n";
    expect(
      specResolveAdapter.applyResolutionToEntity(spec, 'files.file0001.content', { base: '', theirs: updated }),
    ).toBe(true);
    expect(spec.files[0].content).toBe(updated);
    specResolveAdapter.applyResolutionToEntity(spec, 'files.file0001.fileName', { base: '', theirs: 'root.yaml' });
    expect(spec.files[0].fileName).toBe('root.yaml');
  });

  it('applies set-add and set-remove resolutions', () => {
    const spec = makeSpec();
    const added = makeFile({ uid: 'file0002', fileName: 'components/schemas.yaml', content: 'schemas: {}\n' });
    expect(
      specResolveAdapter.applyResolutionToEntity(spec, 'set:files.file0002', {
        base: '',
        theirs: '',
        kind: 'set-add',
        rowPayload: added,
      }),
    ).toBe(true);
    expect(spec.files.map((f) => f.uid)).toEqual(['file0001', 'file0002']);
    expect(
      specResolveAdapter.applyResolutionToEntity(spec, 'set:files.file0002', {
        base: '',
        theirs: '',
        kind: 'set-remove',
      }),
    ).toBe(true);
    expect(spec.files.map((f) => f.uid)).toEqual(['file0001']);
  });

  it('returns false for unrecognized paths', () => {
    expect(specResolveAdapter.applyResolutionToEntity(makeSpec(), 'unknown', { base: '', theirs: 'x' })).toBe(false);
  });

  it('emits the same path vocabulary as SPEC_PATHS and the mutator catalog', () => {
    expect(SPEC_PATHS.files).toBe(SPEC_FILES_PATH);
    expect(SPEC_PATHS.scalar('rootFileUid')).toBe('rootFileUid');
    const baseline = specConflictAdapter.extractBaseline(makeSpec());
    expect(Object.keys(baseline)).toContain(SPEC_PATHS.file('file0001', 'content'));
    expect(Object.keys(baseline)).toContain(SPEC_PATHS.file('file0001', 'fileName'));
    expect(Object.keys(baseline)).toContain(SPEC_PATHS.scalar('format'));
  });

  it('produces human labels for scalar and file paths', () => {
    const spec = makeSpec();
    expect(specResolveAdapter.prettyPath(t, spec, 'name')).toBe('Spec (name)');
    expect(specResolveAdapter.prettyPath(t, spec, 'rootFileUid')).toBe('Spec (root file)');
    expect(specResolveAdapter.prettyPath(t, spec, 'files.file0001.content')).toBe('Spec file index.yaml (content)');
    expect(specResolveAdapter.prettyPath(t, spec, 'files.file0009.fileName')).toBe('Spec file (file name)');
    expect(specResolveAdapter.prettyPath(t, spec, 'unknown.path')).toBe('unknown.path');
  });
});
