/**
 * Script translator coverage (`pm.*` → `oh.*`).
 *
 * Sections mirror the translator's mapped surface: variable scopes,
 * response reads, assertions, request mutations, sendRequest, the
 * whole-script verbatim fallback, and the compile gate. Corpus-shaped
 * cases at the end reproduce the real idioms the live census found.
 */

import { describe, expect, it } from 'vitest';
import { translatePostmanScript } from '../../src/import/postman';

function translated(source: string): string {
  const result = translatePostmanScript(source);
  expect(result.kind).toBe('translated');
  return result.source;
}

function verbatim(source: string): { source: string; constructs: string[] } {
  const result = translatePostmanScript(source);
  expect(result.kind).toBe('verbatim');
  return result as { source: string; constructs: string[] };
}

// ── Variable scopes ─────────────────────────────────────────────────

describe('variable scope mapping', () => {
  it('flattens all four pm scopes onto oh.variables with await', () => {
    expect(translated('pm.environment.set("a", "1");')).toBe('await oh.variables.set("a", "1");');
    expect(translated('pm.collectionVariables.set("a", "1");')).toBe('await oh.variables.set("a", "1");');
    expect(translated('pm.globals.set("a", "1");')).toBe('await oh.variables.set("a", "1");');
    expect(translated('const v = pm.variables.get("a");')).toBe('const v = await oh.variables.get("a");');
  });

  it('maps the legacy postman.set/getEnvironmentVariable pair', () => {
    expect(translated('postman.setEnvironmentVariable("TOKEN", token);')).toBe(
      'await oh.variables.set("TOKEN", token);',
    );
    expect(translated('const t = postman.getEnvironmentVariable("TOKEN");')).toBe(
      'const t = await oh.variables.get("TOKEN");',
    );
  });

  it('reports the scope flattening in the mapped list', () => {
    const result = translatePostmanScript('pm.environment.set("a", "1");');
    expect(result.kind).toBe('translated');
    if (result.kind === 'translated') {
      expect(result.mapped).toContain('pm.environment.set → oh.variables.set (workspace scope)');
    }
  });

  it('leaves unmapped scope methods (unset/has/replaceIn) to the verbatim fallback', () => {
    const { constructs } = verbatim('pm.environment.unset("a");');
    expect(constructs).toContain('pm.environment.unset');
  });
});

// ── Response reads ──────────────────────────────────────────────────

describe('response read mapping', () => {
  it('maps json()/text()/code/status', () => {
    expect(translated('const data = pm.response.json();')).toBe('const data = JSON.parse(oh.response.body);');
    expect(translated('const body = pm.response.text();')).toBe('const body = oh.response.body;');
    expect(translated('if (pm.response.code === 200) {}')).toBe('if (oh.response.status === 200) {}');
    expect(translated('console.log(pm.response.status);')).toBe('console.log(oh.response.statusText);');
  });

  it('maps headers.get through a case-insensitive lookup helper', () => {
    const source = translated('const loc = pm.response.headers.get("Location");');
    expect(source).toContain('const __ohResponseHeader = (name) =>');
    expect(source).toContain('const loc = __ohResponseHeader("Location");');
  });

  it('maps the legacy responseBody global', () => {
    expect(translated('var jsonData = JSON.parse(responseBody);')).toBe('var jsonData = JSON.parse(oh.response.body);');
  });

  it('does not rewrite a user identifier that merely contains responseBody', () => {
    expect(translated('const myResponseBody2 = "x"; console.log(myResponseBody2);')).toBe(
      'const myResponseBody2 = "x"; console.log(myResponseBody2);',
    );
  });

  it('falls back on unmapped response members', () => {
    const { constructs } = verbatim('pm.response.headers.each((h) => console.log(h));');
    expect(constructs).toContain('pm.response.headers.each');
  });
});

// ── Assertions ──────────────────────────────────────────────────────

describe('assertion mapping', () => {
  it('maps two-argument pm.test to awaited oh.test', () => {
    expect(translated('pm.test("ok", function () { console.log(1); });')).toBe(
      'await oh.test("ok", function () { console.log(1); });',
    );
  });

  it('falls back on single-argument pm.test', () => {
    // biome-ignore lint/suspicious/noTemplateCurlyInString: the placeholder is translator input, not a template
    const { constructs } = verbatim('pm.test(`length: ${JSON.stringify([1, 2])}`)');
    expect(constructs).toContain('pm.test(name) without a test callback');
  });

  it('treats commas inside template expressions as non-top-level', () => {
    // The comma inside `${...}` is argument-internal — still one argument.
    // biome-ignore lint/suspicious/noTemplateCurlyInString: the placeholder is translator input, not a template
    const { constructs } = verbatim('pm.test(`v: ${Math.max(1, 2)}`)');
    expect(constructs).toContain('pm.test(name) without a test callback');
  });

  it('maps supported expect matcher chains', () => {
    expect(translated('pm.test("s", () => { pm.expect(a).to.eql(b); });')).toBe(
      'await oh.test("s", () => { oh.expect(a).toEqual(b); });',
    );
    expect(translated('pm.expect(a).to.equal(1);')).toBe('oh.expect(a).toBe(1);');
    expect(translated('pm.expect(a).to.deep.equal(b);')).toBe('oh.expect(a).toEqual(b);');
    expect(translated('pm.expect(a).to.include("x");')).toBe('oh.expect(a).toContain("x");');
    expect(translated('pm.expect(res).to.have.status(200);')).toBe('oh.expect(res).toHaveStatus(200);');
  });

  it('falls back on unsupported expect matchers', () => {
    const { constructs } = verbatim('pm.expect(a).to.be.oneOf([1, 2]);');
    expect(constructs).toContain('unsupported expect matcher chain');
  });
});

// ── Request mutations + sendRequest ─────────────────────────────────

describe('request mutation mapping', () => {
  it('maps headers add/upsert/remove', () => {
    const source = translated('pm.request.headers.upsert({ key: "X-Trace", value: "1" });');
    expect(source).toContain('const __ohUpsertHeader = (row) => oh.setHeader(row.key, row.value);');
    expect(source).toContain('__ohUpsertHeader({ key: "X-Trace", value: "1" });');
    expect(translated('pm.request.headers.remove("X-Trace");')).toBe('oh.removeHeader("X-Trace");');
  });

  it('falls back on other pm.request usage', () => {
    const { constructs } = verbatim('console.log(pm.request.url.toString());');
    expect(constructs).toContain('pm.request.url.toString');
  });

  it('maps single-argument pm.sendRequest and rejects the callback form', () => {
    expect(translated('const res = pm.sendRequest({ method: "GET", url: "https://api.openheaders.io/x" });')).toBe(
      'const res = await oh.sendRequest({ method: "GET", url: "https://api.openheaders.io/x" });',
    );
    const { constructs } = verbatim('pm.sendRequest("https://api.openheaders.io/x", (err, res) => {});');
    expect(constructs).toContain('pm.sendRequest with a callback');
  });
});

// ── Verbatim fallback ───────────────────────────────────────────────

describe('verbatim fallback', () => {
  it('keeps the original source behind the marker header', () => {
    const original = "const sdk = require('postman-collection');\nconsole.log(request.name);";
    const { source, constructs } = verbatim(original);
    expect(source.startsWith('// == Imported unchanged ==')).toBe(true);
    expect(source.endsWith(original)).toBe(true);
    expect(constructs).toContain('require(…)');
    expect(constructs).toContain('request.name (legacy request global)');
  });

  it('names legacy globals and the tests[] object', () => {
    const { constructs } = verbatim('tests["status"] = responseCode.code === 200;');
    expect(constructs).toContain('tests[…] legacy assertions');
    expect(constructs).toContain('responseCode (legacy response global)');
  });

  it('demotes the whole script when any construct is unmapped', () => {
    // The variable set is mappable, the iteration global is not — no
    // half-translated output may escape.
    const original = 'pm.environment.set("i", pm.info.iteration);';
    const { source } = verbatim(original);
    expect(source).toContain(original);
    expect(source).not.toContain('oh.variables.set');
  });

  it('does not flag oh.request produced by translation as a legacy request global', () => {
    const result = translatePostmanScript('console.log("plain");');
    expect(result.kind).toBe('translated');
  });
});

// ── Compile gate ────────────────────────────────────────────────────

describe('compile gate', () => {
  it('accepts top-level return (legal inside the runner wrapper)', () => {
    expect(translated('if (!x) { return 1; }\nconsole.log(x);')).toContain('return 1;');
  });

  it('falls back when inserted await lands in a non-async function', () => {
    const original = 'function read() { return pm.environment.get("k"); }\nread();';
    const result = translatePostmanScript(original);
    expect(result.kind).toBe('verbatim');
    if (result.kind === 'verbatim') {
      expect(result.constructs[0]).toContain('does not compile under the sandbox');
      expect(result.source).toContain(original);
    }
  });

  it('imports scripts with no vendor APIs as-is with nothing mapped', () => {
    const result = translatePostmanScript('console.log("hello");');
    expect(result).toEqual({ kind: 'translated', source: 'console.log("hello");', mapped: [] });
  });
});

// ── Corpus-shaped round trips ───────────────────────────────────────

describe('corpus idioms', () => {
  it('translates the json-fields-to-variables shape', () => {
    const source = translated(
      [
        'var jsonData = pm.response.json();',
        'pm.environment.set("DOCUMENT_MIME", jsonData.MimeType);',
        'pm.environment.set("DOCUMENT", jsonData.Document);',
      ].join('\n'),
    );
    expect(source).toBe(
      [
        'var jsonData = JSON.parse(oh.response.body);',
        'await oh.variables.set("DOCUMENT_MIME", jsonData.MimeType);',
        'await oh.variables.set("DOCUMENT", jsonData.Document);',
      ].join('\n'),
    );
  });

  it('translates the location-header-segment shape', () => {
    const source = translated(
      ['let str = pm.response.headers.get("Location").split("/")[5]', 'pm.environment.set("dataset_id", str);'].join(
        '\n',
      ),
    );
    expect(source).toContain('let str = __ohResponseHeader("Location").split("/")[5]');
    expect(source).toContain('await oh.variables.set("dataset_id", str);');
  });

  it('translates the async-IIFE web-crypto shape (variable reads inside async scope)', () => {
    const source = translated(
      [
        '(async () => {',
        '  const secret = pm.environment.get("TOTP_SECRET");',
        '  const code = await compute(secret);',
        '  pm.environment.set("_TOTP_CODE", code);',
        '})();',
      ].join('\n'),
    );
    expect(source).toContain('const secret = await oh.variables.get("TOTP_SECRET");');
    expect(source).toContain('await oh.variables.set("_TOTP_CODE", code);');
  });

  it('translates the access-token capture shape', () => {
    const source = translated(
      [
        'const responseJson = pm.response.json();',
        'if (responseJson.access_token) {',
        '  pm.environment.set("_ACCESS_TOKEN", responseJson.access_token);',
        '}',
      ].join('\n'),
    );
    expect(source).toContain('const responseJson = JSON.parse(oh.response.body);');
    expect(source).toContain('await oh.variables.set("_ACCESS_TOKEN", responseJson.access_token);');
  });
});
