/**
 * Response documentation → Response Example payloads.
 *
 * Only CONCRETE examples mint entries (a media type's `example` or
 * each of its named `examples`) — schema-only responses stay a
 * counted note (the ratified scope: scaffold synthesis is for request
 * bodies, not response documentation). Each entry snapshots the
 * already-built request shape (auth excluded per the ResponseExample
 * schema) plus a response block: status from the numeric key
 * (`default` / range keys like `2XX` carry as the status text with
 * status 0), a `Content-Type` header from the imported media type,
 * and any response headers that carry concrete example values. The
 * parser stays clock-free — OpenAPI carries no capture moment, so no
 * `capturedAt` is ever emitted.
 */

import type { CapturedRequest } from '../../types/response-example';
import { isRecord } from '../data-scan/json';
import { type ImportReport, recordTransform } from '../report';
import { pickMediaType } from './body';
import type { RefResolver } from './ref';
import type { OpenApiParsedExample } from './types';

export interface ResponseExamplesRead {
  examples: OpenApiParsedExample[];
  /** True when at least one response carried only a schema (no concrete example). */
  schemaOnly: boolean;
  /** `links` entries seen across the operation's responses. */
  links: number;
}

export function buildResponseExamples(
  responses: Record<string, unknown>,
  requestShape: CapturedRequest,
  fullUrl: string,
  jsonPath: string,
  resolver: RefResolver,
  report: ImportReport,
): ResponseExamplesRead {
  const read: ResponseExamplesRead = { examples: [], schemaOnly: false, links: 0 };
  for (const [statusKey, rawResponse] of Object.entries(responses)) {
    const resolved = resolver.resolve(rawResponse);
    if (!resolved.ok || !isRecord(resolved.value)) continue;
    const response = resolved.value;
    if (isRecord(response.links)) read.links += Object.keys(response.links).length;

    const content = isRecord(response.content) ? response.content : {};
    const choice = pickMediaType(content);
    if (choice === undefined) continue;

    const headers = responseHeadersOf(response.headers, choice.mediaType, resolver);
    const description = typeof response.description === 'string' ? response.description.trim() : '';
    const baseName = description !== '' ? `${statusKey} — ${description}` : `Status ${statusKey}`;
    const status = /^\d{3}$/.test(statusKey) ? Number(statusKey) : 0;
    const statusText = status === 0 ? statusKey : '';

    const mint = (name: string, value: unknown): void => {
      const body = bodyText(value);
      read.examples.push({
        name,
        request: requestShape,
        response: {
          status,
          statusText,
          url: fullUrl,
          headers,
          body,
          bodyTruncated: false,
          bodyBytes: new TextEncoder().encode(body).length,
          durationMs: 0,
        },
      });
    };

    // Named examples each mint an entry; the singular `example` mints
    // one. A media type carrying neither is schema-only documentation.
    const named = collectNamedExamples(choice.entry, resolver);
    if (named.length > 0) {
      for (const { name, value } of named) mint(`${baseName} · ${name}`, value);
    } else if (choice.entry.example !== undefined) {
      mint(baseName, choice.entry.example);
    } else {
      read.schemaOnly = true;
      continue;
    }

    const otherTypes = Object.keys(content).filter((mt) => mt !== choice.mediaType && isRecord(content[mt]));
    if (otherTypes.length > 0) {
      recordTransform(report, {
        path: `${jsonPath}.responses['${statusKey}']`,
        from: `${otherTypes.length + 1} media types`,
        to: choice.mediaType,
        reason: `Examples minted from ${choice.mediaType}; other declared media types: ${otherTypes.join(', ')}.`,
      });
    }
  }
  return read;
}

function collectNamedExamples(
  entry: Record<string, unknown>,
  resolver: RefResolver,
): Array<{ name: string; value: unknown }> {
  if (!isRecord(entry.examples)) return [];
  const out: Array<{ name: string; value: unknown }> = [];
  for (const [name, candidate] of Object.entries(entry.examples)) {
    const resolved = resolver.resolve(candidate);
    if (resolved.ok && isRecord(resolved.value) && resolved.value.value !== undefined) {
      out.push({ name, value: resolved.value.value });
    }
  }
  return out;
}

/**
 * Response header rows: `Content-Type` from the imported media type,
 * plus declared headers whose example/default is concrete (schema-only
 * headers contribute an empty value — the name is still the
 * documentation).
 */
function responseHeadersOf(
  rawHeaders: unknown,
  mediaType: string,
  resolver: RefResolver,
): Array<{ key: string; value: string }> {
  const rows: Array<{ key: string; value: string }> = [{ key: 'Content-Type', value: mediaType }];
  const resolved = resolver.resolve(rawHeaders);
  if (!resolved.ok || !isRecord(resolved.value)) return rows;
  for (const [name, rawHeader] of Object.entries(resolved.value)) {
    if (name.toLowerCase() === 'content-type') continue;
    const headerResolved = resolver.resolve(rawHeader);
    const header = headerResolved.ok && isRecord(headerResolved.value) ? headerResolved.value : {};
    rows.push({ key: name, value: headerValueOf(header, resolver) });
  }
  return rows;
}

function headerValueOf(header: Record<string, unknown>, resolver: RefResolver): string {
  if (header.example !== undefined) return scalarText(header.example);
  const schema = resolver.resolve(header.schema);
  if (schema.ok && isRecord(schema.value)) {
    if (schema.value.example !== undefined) return scalarText(schema.value.example);
    if (schema.value.default !== undefined) return scalarText(schema.value.default);
  }
  return '';
}

function scalarText(value: unknown): string {
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  try {
    return JSON.stringify(value) ?? '';
  } catch {
    return '';
  }
}

function bodyText(value: unknown): string {
  if (typeof value === 'string') return value;
  try {
    return JSON.stringify(value, null, 2) ?? '';
  } catch {
    return '';
  }
}
