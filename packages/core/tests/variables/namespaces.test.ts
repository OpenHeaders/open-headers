import { describe, expect, it } from 'vitest';
import { isVariableNamespace, parseReference } from '../../src/variables/namespaces';

describe('parseReference', () => {
  it('parses flat references (no namespace)', () => {
    expect(parseReference('API_URL')).toEqual({
      ok: true,
      ref: { namespace: null, name: 'API_URL', raw: 'API_URL' },
    });
  });

  it('parses explicit scope references', () => {
    expect(parseReference('env.API_URL')).toEqual({
      ok: true,
      ref: { namespace: 'env', name: 'API_URL', raw: 'env.API_URL' },
    });
    expect(parseReference('vault.TOKEN')).toEqual({
      ok: true,
      ref: { namespace: 'vault', name: 'TOKEN', raw: 'vault.TOKEN' },
    });
    expect(parseReference('collection.base')).toEqual({
      ok: true,
      ref: { namespace: 'collection', name: 'base', raw: 'collection.base' },
    });
    expect(parseReference('workspace.region')).toEqual({
      ok: true,
      ref: { namespace: 'workspace', name: 'region', raw: 'workspace.region' },
    });
  });

  it('parses the file scope namespace', () => {
    expect(parseReference('file.fixture.json')).toEqual({
      ok: true,
      ref: { namespace: 'file', name: 'fixture.json', raw: 'file.fixture.json' },
    });
  });

  it('parses the dynamic (reserved) namespace', () => {
    expect(parseReference('dynamic.uuid')).toEqual({
      ok: true,
      ref: { namespace: 'dynamic', name: 'uuid', raw: 'dynamic.uuid' },
    });
  });

  it('trims whitespace around the inner expression', () => {
    expect(parseReference('  env.X  ')).toEqual({
      ok: true,
      ref: { namespace: 'env', name: 'X', raw: 'env.X' },
    });
  });

  it('rejects empty references', () => {
    expect(parseReference('')).toEqual({ ok: false, reason: 'empty', raw: '' });
    expect(parseReference('   ')).toEqual({ ok: false, reason: 'empty', raw: '' });
    expect(parseReference('env.')).toEqual({ ok: false, reason: 'empty', raw: 'env.' });
  });

  it('rejects unknown namespaces', () => {
    expect(parseReference('foo.X')).toEqual({
      ok: false,
      reason: 'unknown-namespace',
      raw: 'foo.X',
      namespace: 'foo',
    });
    expect(parseReference('secret.X')).toEqual({
      ok: false,
      reason: 'unknown-namespace',
      raw: 'secret.X',
      namespace: 'secret',
    });
  });
});

describe('isVariableNamespace', () => {
  it('accepts registered namespaces', () => {
    for (const ns of ['env', 'vault', 'collection', 'workspace', 'dynamic', 'file']) {
      expect(isVariableNamespace(ns)).toBe(true);
    }
  });

  it('rejects others', () => {
    expect(isVariableNamespace('secret')).toBe(false);
    expect(isVariableNamespace('foo')).toBe(false);
    expect(isVariableNamespace('')).toBe(false);
  });
});
