import {
  evaluateJsonPath,
  evaluateXPath,
} from '@openheaders/ui/workbench/components/request-editor/response/response-filter';
import { describe, expect, it } from 'vitest';

const DOC = {
  url: 'https://api.openheaders.io/v1/items',
  headers: { 'content-type': 'application/json', host: 'api.openheaders.io' },
  items: [
    { name: 'first', tags: ['a', 'b'] },
    { name: 'second', tags: [] },
  ],
  count: 2,
};

describe('evaluateJsonPath', () => {
  it('returns the root for a bare $', () => {
    expect(evaluateJsonPath(DOC, '$')).toEqual({ ok: true, matches: [DOC] });
  });

  it('walks dot members with or without the $ prefix', () => {
    expect(evaluateJsonPath(DOC, '$.count')).toEqual({ ok: true, matches: [2] });
    expect(evaluateJsonPath(DOC, '.count')).toEqual({ ok: true, matches: [2] });
  });

  it('reads bracket-quoted members with non-identifier characters', () => {
    expect(evaluateJsonPath(DOC, "$.headers['content-type']")).toEqual({
      ok: true,
      matches: ['application/json'],
    });
    expect(evaluateJsonPath(DOC, '$.headers["content-type"]')).toEqual({
      ok: true,
      matches: ['application/json'],
    });
  });

  it('indexes arrays, including from the end', () => {
    expect(evaluateJsonPath(DOC, '$.items[0].name')).toEqual({ ok: true, matches: ['first'] });
    expect(evaluateJsonPath(DOC, '$.items[-1].name')).toEqual({ ok: true, matches: ['second'] });
  });

  it('returns no matches for an out-of-bounds index', () => {
    expect(evaluateJsonPath(DOC, '$.items[9]')).toEqual({ ok: true, matches: [] });
  });

  it('expands wildcards over array items and object values', () => {
    expect(evaluateJsonPath(DOC, '$.items[*].name')).toEqual({ ok: true, matches: ['first', 'second'] });
    expect(evaluateJsonPath(DOC, '$.headers.*')).toEqual({
      ok: true,
      matches: ['application/json', 'api.openheaders.io'],
    });
  });

  it('descends recursively to a key anywhere below', () => {
    expect(evaluateJsonPath(DOC, '$..name')).toEqual({ ok: true, matches: ['first', 'second'] });
  });

  it('returns no matches for a missing member', () => {
    expect(evaluateJsonPath(DOC, '$.nope')).toEqual({ ok: true, matches: [] });
  });

  it('rejects paths outside the grammar', () => {
    expect(evaluateJsonPath(DOC, '$.items[?(@.name)]')).toEqual({ ok: false });
    expect(evaluateJsonPath(DOC, '$.items[0:2]')).toEqual({ ok: false });
    expect(evaluateJsonPath(DOC, '$$')).toEqual({ ok: false });
  });
});

describe('evaluateXPath', () => {
  const XML = '<root><item><name>first</name></item><item><name>second</name></item></root>';

  it('serializes matched XML nodes in document order', () => {
    expect(evaluateXPath(XML, '//item/name', 'xml')).toEqual({
      ok: true,
      matches: ['<name>first</name>', '<name>second</name>'],
    });
  });

  it('returns primitive XPath results as one text match', () => {
    expect(evaluateXPath(XML, 'count(//item)', 'xml')).toEqual({ ok: true, matches: ['2'] });
    expect(evaluateXPath(XML, 'string(//name)', 'xml')).toEqual({ ok: true, matches: ['first'] });
  });

  it('returns no matches for a path that hits nothing', () => {
    expect(evaluateXPath(XML, '//absent', 'xml')).toEqual({ ok: true, matches: [] });
  });

  it('fails on an invalid expression', () => {
    expect(evaluateXPath(XML, '///', 'xml')).toEqual({ ok: false });
  });

  it('fails on an unparseable XML document', () => {
    expect(evaluateXPath('<root><broken', '//root', 'xml')).toEqual({ ok: false });
  });

  it('queries HTML documents', () => {
    const html = '<html><head><title>openheaders.io</title></head><body><p>hi</p></body></html>';
    expect(evaluateXPath(html, 'string(/html/head/title)', 'html')).toEqual({
      ok: true,
      matches: ['openheaders.io'],
    });
  });
});
