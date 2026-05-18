import {
  buildHttpHeadersGroup,
  getHeaderDocSectionId,
  hasHeaderDoc,
  HTTP_HEADERS_GROUP,
} from '@openheaders/ui/shared/docs/sections/http-headers';
import { buildSectionIndex, type DocSection } from '@openheaders/ui/shared/docs/registry';
import { describe, expect, it } from 'vitest';

describe('http-headers doc group', () => {
  it('every section has a unique id and a Component', () => {
    const ids = new Set<string>();
    for (const section of HTTP_HEADERS_GROUP.sections) {
      expect(ids.has(section.id)).toBe(false);
      ids.add(section.id);
      expect(typeof section.Component).toBe('function');
      expect(section.title.length).toBeGreaterThan(0);
      expect(section.summary.length).toBeGreaterThan(0);
    }
    expect(HTTP_HEADERS_GROUP.sections.length).toBeGreaterThanOrEqual(40);
  });

  it('section ids follow the http-header:<lowercase> convention', () => {
    for (const section of HTTP_HEADERS_GROUP.sections) {
      expect(section.id.startsWith('http-header:')).toBe(true);
      expect(section.id).toBe(section.id.toLowerCase());
    }
  });

  it('hasHeaderDoc + getHeaderDocSectionId agree with the registry', () => {
    const index = buildSectionIndex([HTTP_HEADERS_GROUP]);
    for (const name of ['Cache-Control', 'set-cookie', 'CONTENT-TYPE', 'Authorization']) {
      expect(hasHeaderDoc(name)).toBe(true);
      const sectionId = getHeaderDocSectionId(name);
      expect(index.has(sectionId)).toBe(true);
    }
    expect(hasHeaderDoc('X-Made-Up-Header-That-Does-Not-Exist')).toBe(false);
  });

  it('buildHttpHeadersGroup is deterministic — singleton matches a fresh build', () => {
    const built = buildHttpHeadersGroup();
    expect(built.sections.map((s: DocSection) => s.id)).toEqual(
      HTTP_HEADERS_GROUP.sections.map((s: DocSection) => s.id),
    );
  });
});
