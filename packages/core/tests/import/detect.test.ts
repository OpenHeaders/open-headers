import { describe, expect, it } from 'vitest';
import { detectImportSource } from '../../src/import/detect';

describe('detectImportSource', () => {
  describe('curl', () => {
    it('detects a plain curl command', () => {
      expect(detectImportSource("curl 'https://api.openheaders.io/v1/me'")).toEqual({ kind: 'curl' });
    });

    it('detects multiline curl with continuations', () => {
      const cmd = `curl -X POST 'https://api.openheaders.io/v1/rules' \\
  -H 'Authorization: Bearer token' \\
  --data-raw '{"a":1}'`;
      expect(detectImportSource(cmd)).toEqual({ kind: 'curl' });
    });

    it('strips shell prompt prefixes', () => {
      expect(detectImportSource("$ curl 'https://api.openheaders.io'")).toEqual({ kind: 'curl' });
      expect(detectImportSource("# curl 'https://api.openheaders.io'")).toEqual({ kind: 'curl' });
      expect(detectImportSource("> curl 'https://api.openheaders.io'")).toEqual({ kind: 'curl' });
      expect(detectImportSource('PS C:\\Users\\dev> curl https://api.openheaders.io')).toEqual({ kind: 'curl' });
    });

    it('detects curl.exe and mixed case', () => {
      expect(detectImportSource('curl.exe https://api.openheaders.io')).toEqual({ kind: 'curl' });
      expect(detectImportSource('CURL https://api.openheaders.io')).toEqual({ kind: 'curl' });
    });

    it('does not match words merely starting with curl', () => {
      expect(detectImportSource('curling is a sport')).toEqual({ kind: 'unknown' });
    });
  });

  describe('bare URL', () => {
    it('detects an https URL with query', () => {
      expect(detectImportSource('https://api.openheaders.io/v1/rules?dryRun=true')).toEqual({
        kind: 'url',
        url: 'https://api.openheaders.io/v1/rules?dryRun=true',
      });
    });

    it('detects http URLs', () => {
      expect(detectImportSource('http://staging.openheaders.io/health')).toEqual({
        kind: 'url',
        url: 'http://staging.openheaders.io/health',
      });
    });

    it('rejects text that contains a URL among other words', () => {
      expect(detectImportSource('see https://openheaders.io for docs')).toEqual({ kind: 'unknown' });
    });
  });

  describe('HAR', () => {
    it('detects a HAR document', () => {
      const har = JSON.stringify({ log: { version: '1.2', entries: [] } });
      expect(detectImportSource(har)).toEqual({ kind: 'har' });
    });

    it('rejects JSON with a non-object log', () => {
      expect(detectImportSource(JSON.stringify({ log: 'entries' }))).toEqual({ kind: 'unknown' });
    });
  });

  describe('Postman', () => {
    it('detects a collection by info.schema', () => {
      const col = JSON.stringify({
        info: { name: 'API', schema: 'https://schema.getpostman.com/json/collection/v2.1.0/collection.json' },
        item: [],
      });
      expect(detectImportSource(col)).toEqual({ kind: 'postman' });
    });

    it('detects a collection by info._postman_id', () => {
      const col = JSON.stringify({ info: { name: 'API', _postman_id: 'abc-123' }, item: [] });
      expect(detectImportSource(col)).toEqual({ kind: 'postman' });
    });

    it('detects an environment export (name + values[])', () => {
      const env = JSON.stringify({
        name: 'Staging',
        values: [{ key: 'host', value: 'staging.openheaders.io', enabled: true }],
        _postman_variable_scope: 'environment',
      });
      expect(detectImportSource(env)).toEqual({ kind: 'postman' });
    });
  });

  describe('workspace export', () => {
    it('detects the JSON form by kind discriminator', () => {
      const exp = JSON.stringify({ kind: 'workspace-export', schemaVersion: 5, workspace: {} });
      expect(detectImportSource(exp)).toEqual({ kind: 'workspace' });
    });

    it('detects the YAML form by kind line', () => {
      const yaml = `kind: workspace-export\nschemaVersion: 5\nworkspace:\n  name: QA\n`;
      expect(detectImportSource(yaml)).toEqual({ kind: 'workspace' });
    });

    it('detects the YAML form with quoted kind', () => {
      expect(detectImportSource(`kind: 'workspace-export'\nschemaVersion: 5\n`)).toEqual({ kind: 'workspace' });
    });
  });

  describe('unknown', () => {
    it('returns unknown for empty and whitespace input', () => {
      expect(detectImportSource('')).toEqual({ kind: 'unknown' });
      expect(detectImportSource('   \n  ')).toEqual({ kind: 'unknown' });
    });

    it('returns unknown for arbitrary JSON', () => {
      expect(detectImportSource(JSON.stringify({ hello: 'world' }))).toEqual({ kind: 'unknown' });
    });

    it('returns unknown for malformed JSON', () => {
      expect(detectImportSource('{"broken":')).toEqual({ kind: 'unknown' });
    });

    it('returns unknown for JSON arrays', () => {
      expect(detectImportSource('[1,2,3]')).toEqual({ kind: 'unknown' });
    });

    it('returns unknown for prose', () => {
      expect(detectImportSource('please import my requests')).toEqual({ kind: 'unknown' });
    });
  });
});
