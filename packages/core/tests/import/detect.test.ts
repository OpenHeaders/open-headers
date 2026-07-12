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

  describe('Postman backup', () => {
    function backup(overrides: Record<string, unknown> = {}): string {
      return JSON.stringify({
        version: 1,
        collections: [],
        environments: [],
        headerPresets: [],
        globals: [],
        ...overrides,
      });
    }

    it('detects the backup envelope (version + four section arrays)', () => {
      expect(detectImportSource(backup())).toEqual({ kind: 'postman-backup' });
    });

    it('detects a populated backup', () => {
      const populated = backup({
        collections: [{ info: { name: 'API', _postman_id: 'abc' }, item: [] }],
        headerPresets: [{ name: 'Tracing', headers: [{ key: 'X-Trace', value: '1' }] }],
      });
      expect(detectImportSource(populated)).toEqual({ kind: 'postman-backup' });
    });

    it('requires every section array — a partial envelope stays unknown', () => {
      expect(detectImportSource(JSON.stringify({ version: 1, collections: [], environments: [] }))).toEqual({
        kind: 'unknown',
      });
    });

    it('requires a numeric version', () => {
      const stringVersion = backup({ version: '1' });
      expect(detectImportSource(stringVersion)).toEqual({ kind: 'unknown' });
    });

    it('does not shadow a plain collection export', () => {
      const col = JSON.stringify({ info: { name: 'API', _postman_id: 'abc' }, item: [] });
      expect(detectImportSource(col)).toEqual({ kind: 'postman' });
    });

    it('does not shadow an environment export carrying a values array', () => {
      const env = JSON.stringify({ name: 'Staging', values: [], _postman_variable_scope: 'environment' });
      expect(detectImportSource(env)).toEqual({ kind: 'postman' });
    });

    it('does not shadow a HAR whose log sits beside a version field', () => {
      const har = JSON.stringify({ version: 1, log: { version: '1.2', entries: [] } });
      expect(detectImportSource(har)).toEqual({ kind: 'har' });
    });
  });

  describe('Insomnia', () => {
    it('detects a v4 export envelope', () => {
      const v4 = JSON.stringify({ _type: 'export', __export_format: 4, __export_date: '', resources: [] });
      expect(detectImportSource(v4)).toEqual({ kind: 'insomnia' });
    });

    it('detects a v5 document saved as JSON', () => {
      const v5 = JSON.stringify({ type: 'collection.insomnia.rest/5.0', name: 'API', collection: [] });
      expect(detectImportSource(v5)).toEqual({ kind: 'insomnia' });
    });

    it('detects a v5 YAML collection document', () => {
      const yaml = `type: collection.insomnia.rest/5.0\nname: Openheaders API\ncollection: []\n`;
      expect(detectImportSource(yaml)).toEqual({ kind: 'insomnia' });
    });

    it('detects a v5 YAML environment document with quoted type', () => {
      const yaml = `type: 'environment.insomnia.rest/5.0'\nname: Staging\ndata:\n  host: api.openheaders.io\n`;
      expect(detectImportSource(yaml)).toEqual({ kind: 'insomnia' });
    });

    it('rejects a v4-looking envelope without a numeric export format', () => {
      expect(detectImportSource(JSON.stringify({ _type: 'export', resources: [] }))).toEqual({ kind: 'unknown' });
    });

    it('rejects unrelated type discriminators', () => {
      expect(detectImportSource(JSON.stringify({ type: 'something-else' }))).toEqual({ kind: 'unknown' });
      expect(detectImportSource('type: something-else\nname: X\n')).toEqual({ kind: 'unknown' });
    });

    it('does not shadow a YAML workspace export', () => {
      const yaml = `kind: workspace-export\nschemaVersion: 5\nworkspace:\n  name: QA\n`;
      expect(detectImportSource(yaml)).toEqual({ kind: 'workspace' });
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
