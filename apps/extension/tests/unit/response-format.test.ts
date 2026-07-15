/**
 * Response Content-Type derivations: viewer language detection, media
 * preview families, ndjson recognition, and the display-only charset
 * parameter. Content-Type picks renderers and labels — never whether
 * the body is text or bytes (that's `bodyEncoding`).
 */

import {
  contentTypeCharset,
  detectBodyLanguage,
  isNdjsonResponse,
  mediaPreviewKind,
} from '@openheaders/ui/workbench/components/request-editor/response/response-format';
import { describe, expect, it } from 'vitest';

const ct = (value: string) => [{ key: 'Content-Type', value }];

describe('detectBodyLanguage', () => {
  it('maps yaml media types to the yaml grammar', () => {
    expect(detectBodyLanguage(ct('application/yaml'))).toBe('yaml');
    expect(detectBodyLanguage(ct('text/yaml; charset=utf-8'))).toBe('yaml');
    expect(detectBodyLanguage(ct('application/x-yaml'))).toBe('yaml');
  });

  it('keeps csv/tsv as plain text', () => {
    expect(detectBodyLanguage(ct('text/csv'))).toBe('text');
    expect(detectBodyLanguage(ct('text/tab-separated-values'))).toBe('text');
  });

  it('maps ndjson to the json grammar (line-wise records)', () => {
    expect(detectBodyLanguage(ct('application/x-ndjson'))).toBe('json');
  });

  it('maps svg to the xml grammar', () => {
    expect(detectBodyLanguage(ct('image/svg+xml'))).toBe('xml');
  });
});

describe('mediaPreviewKind', () => {
  it('names the four previewable families', () => {
    expect(mediaPreviewKind(ct('application/pdf'))).toBe('pdf');
    expect(mediaPreviewKind(ct('image/png'))).toBe('image');
    expect(mediaPreviewKind(ct('image/svg+xml'))).toBe('image');
    expect(mediaPreviewKind(ct('audio/mpeg'))).toBe('audio');
    expect(mediaPreviewKind(ct('video/mp4; codecs="avc1"'))).toBe('video');
  });

  it('returns null for everything else', () => {
    expect(mediaPreviewKind(ct('application/json'))).toBeNull();
    expect(mediaPreviewKind(ct('application/zip'))).toBeNull();
    expect(mediaPreviewKind([])).toBeNull();
  });
});

describe('isNdjsonResponse', () => {
  it('recognizes the ndjson family', () => {
    expect(isNdjsonResponse(ct('application/x-ndjson'))).toBe(true);
    expect(isNdjsonResponse(ct('application/jsonl'))).toBe(true);
    expect(isNdjsonResponse(ct('application/json-seq'))).toBe(true);
    expect(isNdjsonResponse(ct('application/json'))).toBe(false);
  });
});

describe('contentTypeCharset', () => {
  it('extracts the charset parameter', () => {
    expect(contentTypeCharset(ct('text/plain; charset=ISO-8859-1'))).toBe('iso-8859-1');
    expect(contentTypeCharset(ct('text/html;charset="Shift_JIS"'))).toBe('shift_jis');
  });

  it('returns null when absent', () => {
    expect(contentTypeCharset(ct('application/json'))).toBeNull();
    expect(contentTypeCharset([])).toBeNull();
  });
});
