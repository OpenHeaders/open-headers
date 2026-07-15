/**
 * `requestBody` → the request's body. One media type imports (a body
 * has one shape); the preference order favors what the editor
 * round-trips best: JSON, then XML, then structured form/multipart,
 * then plain text. When several media types are declared, the choice
 * is recorded — never silent. Concrete examples win; a schema-only
 * JSON body synthesizes a placeholder scaffold (`schema-scaffold.ts`)
 * with a transform note naming the synthesis.
 */

import { placeholderFileRef } from '../../files';
import type { FormField, MultipartPart, RequestBody } from '../../types/request';
import { generateUid } from '../../utils/workspace';
import { isRecord } from '../data-scan/json';
import { type ImportReport, recordDrop, recordTransform } from '../report';
import type { RefResolver } from './ref';
import { synthesizeSchemaScaffold } from './schema-scaffold';

interface MediaTypeChoice {
  mediaType: string;
  entry: Record<string, unknown>;
}

/** Preference buckets, most-preferred first. */
function mediaTypeRank(mediaType: string): number {
  const mt = mediaType.toLowerCase();
  if (mt === 'application/json' || mt.endsWith('+json')) return 0;
  if (mt === 'application/xml' || mt === 'text/xml' || mt.endsWith('+xml')) return 1;
  if (mt === 'application/x-www-form-urlencoded') return 2;
  if (mt === 'multipart/form-data') return 3;
  if (mt.startsWith('text/')) return 4;
  return 5;
}

export function pickMediaType(content: Record<string, unknown>): MediaTypeChoice | undefined {
  let best: MediaTypeChoice | undefined;
  let bestRank = Number.POSITIVE_INFINITY;
  for (const [mediaType, entry] of Object.entries(content)) {
    if (!isRecord(entry)) continue;
    const rank = mediaTypeRank(mediaType);
    if (rank < bestRank) {
      best = { mediaType, entry };
      bestRank = rank;
    }
  }
  return best;
}

/**
 * The concrete example authored for a media type: `example`, else the
 * first entry of `examples` (Example Objects resolve through `$ref`).
 * Returns `undefined` when nothing concrete is authored.
 */
export function mediaTypeExample(entry: Record<string, unknown>, resolver: RefResolver): unknown {
  if (entry.example !== undefined) return entry.example;
  if (isRecord(entry.examples)) {
    for (const candidate of Object.values(entry.examples)) {
      const resolved = resolver.resolve(candidate);
      if (resolved.ok && isRecord(resolved.value) && resolved.value.value !== undefined) {
        return resolved.value.value;
      }
    }
  }
  return undefined;
}

function asBodyText(value: unknown): string {
  if (typeof value === 'string') return value;
  try {
    return JSON.stringify(value, null, 2) ?? '';
  } catch {
    return '';
  }
}

/**
 * Build the request body from a resolved `requestBody` object. Media
 * types beyond the imported one are named in a transform; unmappable
 * media types drop with the type named.
 */
export function buildOpenApiBody(
  requestBody: Record<string, unknown>,
  jsonPath: string,
  resolver: RefResolver,
  report: ImportReport,
): RequestBody {
  const content = isRecord(requestBody.content) ? requestBody.content : {};
  const choice = pickMediaType(content);
  if (choice === undefined) {
    recordDrop(report, {
      path: `${jsonPath}.requestBody`,
      reason: 'Request body declares no media types — imported without a body.',
    });
    return { type: 'none' };
  }

  const otherTypes = Object.keys(content).filter((mt) => mt !== choice.mediaType);
  if (otherTypes.length > 0) {
    recordTransform(report, {
      path: `${jsonPath}.requestBody`,
      from: `${Object.keys(content).length} media types`,
      to: choice.mediaType,
      reason: `A request body has one shape — ${choice.mediaType} was imported; also declared: ${otherTypes.join(', ')}.`,
    });
  }

  const mt = choice.mediaType.toLowerCase();
  const bodyPath = `${jsonPath}.requestBody.content['${choice.mediaType}']`;
  if (mt === 'application/json' || mt.endsWith('+json')) {
    return jsonBody(choice.entry, bodyPath, resolver, report);
  }
  if (mt === 'application/xml' || mt === 'text/xml' || mt.endsWith('+xml')) {
    return xmlBody(choice.entry, bodyPath, resolver, report);
  }
  if (mt === 'application/x-www-form-urlencoded') {
    return formBody(choice.entry, resolver);
  }
  if (mt === 'multipart/form-data') {
    return multipartBody(choice.entry, bodyPath, resolver, report);
  }
  if (mt.startsWith('text/')) {
    const example = mediaTypeExample(choice.entry, resolver);
    return { type: 'text', content: example !== undefined ? asBodyText(example) : '' };
  }
  recordDrop(report, {
    path: bodyPath,
    reason: `Request body media type "${choice.mediaType}" has no counterpart — imported without a body; author it in the editor.`,
    tracking: 'PERMANENT: body-type picklist',
  });
  return { type: 'none' };
}

function jsonBody(
  entry: Record<string, unknown>,
  bodyPath: string,
  resolver: RefResolver,
  report: ImportReport,
): RequestBody {
  const example = mediaTypeExample(entry, resolver);
  if (example !== undefined) return { type: 'json', content: asBodyText(example) };
  if (entry.schema === undefined) return { type: 'json', content: '' };
  const scaffold = synthesizeSchemaScaffold(entry.schema, resolver);
  recordTransform(report, {
    path: bodyPath,
    from: 'schema without a concrete example',
    to: 'synthesized placeholder body',
    reason:
      'The body declares a schema but no example — a placeholder JSON body was synthesized from the schema; replace the values before sending.',
  });
  return { type: 'json', content: asBodyText(scaffold) };
}

function xmlBody(
  entry: Record<string, unknown>,
  bodyPath: string,
  resolver: RefResolver,
  report: ImportReport,
): RequestBody {
  const example = mediaTypeExample(entry, resolver);
  if (typeof example === 'string') return { type: 'xml', content: example };
  recordTransform(report, {
    path: bodyPath,
    from: example !== undefined ? 'structured XML example' : 'schema without a concrete example',
    to: 'empty XML body',
    reason:
      'Only literal XML examples import — the scaffold synthesizer emits JSON, not XML; author the XML body in the editor.',
  });
  return { type: 'xml', content: '' };
}

/**
 * Urlencoded: a concrete example object becomes rows verbatim;
 * otherwise the schema's properties scaffold one row each (structured
 * property values JSON-encode — they'd be encoded on the wire too).
 */
function formBody(entry: Record<string, unknown>, resolver: RefResolver): RequestBody {
  const example = mediaTypeExample(entry, resolver);
  const source = isRecord(example) ? example : scaffoldObject(entry.schema, resolver);
  const formParts: FormField[] = Object.entries(source).map(([key, value]) => ({
    uid: generateUid(),
    key,
    value: fieldText(value),
  }));
  return formParts.length > 0 ? { type: 'form', formParts } : { type: 'form', formParts: [] };
}

/**
 * Multipart: schema properties become parts — binary-marked strings
 * (`format: binary` / 3.1 `contentMediaType`) become placeholder file
 * parts (no bytes travel in a spec), everything else a text part.
 */
function multipartBody(
  entry: Record<string, unknown>,
  bodyPath: string,
  resolver: RefResolver,
  report: ImportReport,
): RequestBody {
  const schema = resolver.resolve(entry.schema);
  const properties =
    schema.ok && isRecord(schema.value) && isRecord(schema.value.properties) ? schema.value.properties : {};
  const parts: MultipartPart[] = [];
  let fileParts = 0;
  for (const [name, rawProp] of Object.entries(properties)) {
    const resolvedProp = resolver.resolve(rawProp);
    const prop = resolvedProp.ok && isRecord(resolvedProp.value) ? resolvedProp.value : {};
    if (isBinaryProperty(prop)) {
      parts.push({ kind: 'file', uid: generateUid(), name, fileRefs: [placeholderFileRef({ filename: name })] });
      fileParts++;
      continue;
    }
    parts.push({ kind: 'text', uid: generateUid(), name, value: fieldText(synthesizeSchemaScaffold(prop, resolver)) });
  }
  if (fileParts > 0) {
    recordTransform(report, {
      path: bodyPath,
      from: `multipart (${fileParts} file part${fileParts === 1 ? '' : 's'})`,
      to: 'multipart with placeholder FileRefs',
      reason:
        "Specs don't carry file bytes. File parts imported as placeholders — open the request editor's Body tab to upload the real files.",
      tracking: '#todo-file-blobs',
    });
  }
  return { type: 'multipart', multipartParts: parts };
}

function isBinaryProperty(prop: Record<string, unknown>): boolean {
  if (prop.format === 'binary' || prop.format === 'base64') return true;
  if (typeof prop.contentMediaType === 'string') return true;
  return prop.contentEncoding === 'base64' || prop.contentEncoding === 'binary';
}

function scaffoldObject(schema: unknown, resolver: RefResolver): Record<string, unknown> {
  const scaffold = synthesizeSchemaScaffold(schema, resolver);
  return isRecord(scaffold) ? scaffold : {};
}

function fieldText(value: unknown): string {
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  if (value === null || value === undefined) return '';
  try {
    return JSON.stringify(value) ?? '';
  } catch {
    return '';
  }
}
