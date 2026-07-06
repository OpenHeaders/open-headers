import {
  evaluateJsonPath,
  evaluateXPath,
  suggestJsonPathCompletions,
  suggestXPathCompletions,
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

describe('suggestJsonPathCompletions', () => {
  it('offers root members for an empty or bare-$ query', () => {
    expect(suggestJsonPathCompletions(DOC, '')).toEqual(['$.url', '$.headers', '$.items', '$.count']);
    expect(suggestJsonPathCompletions(DOC, '$')).toEqual(['$.url', '$.headers', '$.items', '$.count']);
  });

  it('offers only the current level after a trailing dot', () => {
    expect(suggestJsonPathCompletions(DOC, '$.headers.')).toEqual(['$.headers.content-type', '$.headers.host']);
  });

  it('narrows by the trailing fragment', () => {
    expect(suggestJsonPathCompletions(DOC, '$.headers.co')).toEqual(['$.headers.content-type']);
    expect(suggestJsonPathCompletions(DOC, '$.c')).toEqual(['$.count']);
  });

  it('offers [0] and [*] on an array level', () => {
    expect(suggestJsonPathCompletions(DOC, '$.items[')).toEqual(['$.items[0]', '$.items[*]']);
  });

  it('completes through wildcards and indices', () => {
    expect(suggestJsonPathCompletions(DOC, '$.items[0].')).toEqual(['$.items[0].name', '$.items[0].tags']);
    expect(suggestJsonPathCompletions(DOC, '$.items[*].na')).toEqual(['$.items[*].name']);
  });

  it('bracket-quotes keys outside the dot grammar', () => {
    expect(suggestJsonPathCompletions({ 'set cookie': 1 }, '')).toEqual(["$['set cookie']"]);
  });

  it('returns nothing for an unevaluable base or primitive level', () => {
    expect(suggestJsonPathCompletions(DOC, '$.nope.')).toEqual([]);
    expect(suggestJsonPathCompletions(DOC, '$.count.')).toEqual([]);
  });
});

describe('suggestXPathCompletions', () => {
  const XML = '<root><item><name>x</name></item><meta/></root>';

  it('offers //tag for a bare fragment', () => {
    expect(suggestXPathCompletions(XML, 'xml', 'it')).toEqual(['//item']);
    expect(suggestXPathCompletions(XML, 'xml', '')).toEqual(['//root', '//item', '//name', '//meta']);
  });

  it('offers the document element after a single slash', () => {
    expect(suggestXPathCompletions(XML, 'xml', '/')).toEqual(['/root']);
  });

  it('offers all tags after a double slash', () => {
    expect(suggestXPathCompletions(XML, 'xml', '//')).toEqual(['//root', '//item', '//name', '//meta']);
  });

  it('offers child tags of the evaluated base path', () => {
    expect(suggestXPathCompletions(XML, 'xml', '/root/')).toEqual(['/root/item', '/root/meta']);
    expect(suggestXPathCompletions(XML, 'xml', '/root/i')).toEqual(['/root/item']);
    expect(suggestXPathCompletions(XML, 'xml', '//item/')).toEqual(['//item/name']);
  });

  it('returns nothing for an unparseable document or invalid base', () => {
    expect(suggestXPathCompletions('<root><broken', 'xml', '/root/')).toEqual([]);
    expect(suggestXPathCompletions(XML, 'xml', '///')).toEqual([]);
  });
});
