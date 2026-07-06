import { deriveSaveFilename } from '@openheaders/ui/workbench/components/request-editor/response/response-save';
import { describe, expect, it } from 'vitest';

describe('deriveSaveFilename', () => {
  it('keeps a segment that already carries an extension', () => {
    expect(deriveSaveFilename('https://api.openheaders.io/exports/report.csv', 'text')).toBe('report.csv');
  });

  it('appends the language extension when the segment has none', () => {
    expect(deriveSaveFilename('https://api.openheaders.io/v1/users', 'json')).toBe('users.json');
    expect(deriveSaveFilename('https://openheaders.io/docs/page', 'html')).toBe('page.html');
  });

  it('ignores query and hash', () => {
    expect(deriveSaveFilename('https://api.openheaders.io/v1/users?page=2#top', 'json')).toBe('users.json');
  });

  it('falls back to response for a bare origin or root path', () => {
    expect(deriveSaveFilename('https://api.openheaders.io', 'json')).toBe('response.json');
    expect(deriveSaveFilename('https://api.openheaders.io/', 'xml')).toBe('response.xml');
  });

  it('falls back to response for an unparseable URL', () => {
    expect(deriveSaveFilename('', 'text')).toBe('response.txt');
    expect(deriveSaveFilename('not a url', 'text')).toBe('response.txt');
  });

  it('percent-decodes and sanitizes the segment', () => {
    expect(deriveSaveFilename('https://api.openheaders.io/files/my%20report', 'json')).toBe('my_report.json');
    expect(deriveSaveFilename('https://api.openheaders.io/a%2Fb:c', 'text')).toBe('a_b_c.txt');
  });

  it('keeps a raw segment when percent-decoding fails', () => {
    expect(deriveSaveFilename('https://api.openheaders.io/bad%2', 'text')).toBe('bad_2.txt');
  });

  it('strips leading dots so the file is never hidden', () => {
    expect(deriveSaveFilename('https://api.openheaders.io/.well-known', 'json')).toBe('well-known.json');
  });

  it('maps every body language to its extension', () => {
    expect(deriveSaveFilename('https://openheaders.io/x', 'javascript')).toBe('x.js');
    expect(deriveSaveFilename('https://openheaders.io/x', 'css')).toBe('x.css');
    expect(deriveSaveFilename('https://openheaders.io/x', 'markdown')).toBe('x.md');
    expect(deriveSaveFilename('https://openheaders.io/x', 'graphql')).toBe('x.graphql');
  });
});
