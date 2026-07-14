import { placeholderFileRef } from '../../files';
import type { MultipartPart, RequestBody, RequestHeader } from '../../types/request';
import { generateUid } from '../../utils/workspace';
import { type ImportReport, recordDrop, recordTransform } from '../report';
import type { PostmanBody } from './types';

// ── Body ───────────────────────────────────────────────────────────

export function buildBody(
  body: PostmanBody | undefined,
  headers: RequestHeader[],
  jsonPath: string,
  report: ImportReport,
): RequestBody {
  if (!body || body.disabled || !body.mode) return { type: 'none' };

  switch (body.mode) {
    case 'raw': {
      const content = typeof body.raw === 'string' ? body.raw : '';
      if (content.length === 0) return { type: 'none' };
      const language = body.options?.raw?.language?.toLowerCase();
      if (language === 'json') return { type: 'json', content };
      if (language === 'xml') return { type: 'xml', content };
      if (language === 'graphql') return { type: 'graphql', content };
      if (language === 'html') {
        recordTransform(report, {
          path: `${jsonPath}.request.body`,
          from: 'raw/html',
          to: 'text',
          reason: 'No dedicated HTML body type; kept as text. Set Content-Type manually.',
          tracking: 'PERMANENT: body-type picklist',
        });
        return { type: 'text', content };
      }
      if (language === 'javascript') {
        recordTransform(report, {
          path: `${jsonPath}.request.body`,
          from: 'raw/javascript',
          to: 'text',
          reason: 'No dedicated JavaScript body type; kept as text.',
          tracking: 'PERMANENT: body-type picklist',
        });
        return { type: 'text', content };
      }
      // Infer from Content-Type header if language isn't set.
      const contentType = contentTypeOf(headers) ?? '';
      if (/application\/json/i.test(contentType)) return { type: 'json', content };
      if (/application\/xml|text\/xml/i.test(contentType)) return { type: 'xml', content };
      if (/application\/x-www-form-urlencoded/i.test(contentType)) {
        // Promote the raw text to structured form fields so the editor's
        // form-urlencoded tab renders them. Importers seeing a `raw`
        // body with a urlencoded Content-Type usually mean the user
        // copy-pasted `key=value&key2=value2` into the raw box. A
        // lossless automatic conversion — same wire bytes — recorded
        // so no rewrite is silent.
        recordTransform(report, {
          path: `${jsonPath}.request.body`,
          from: 'raw text with a form-urlencoded Content-Type',
          to: 'structured form fields',
          reason: 'The raw key=value text was promoted to form fields — the wire bytes are identical; nothing to do.',
        });
        return { type: 'form', formParts: parseUrlEncodedToFormFields(content) };
      }
      return { type: 'text', content };
    }
    case 'urlencoded': {
      const items = Array.isArray(body.urlencoded) ? body.urlencoded : [];
      // Postman's urlencoded mode is structured already — preserve the
      // per-row enabled flag + description so importing a Postman
      // collection round-trips through our editor without losing any
      // metadata. Disabled rows persist; description goes into the per
      // row note column.
      const formParts = items
        .filter((p) => p.key)
        .map((p) => ({
          uid: generateUid(),
          key: p.key ?? '',
          value: typeof p.value === 'string' ? p.value : '',
          enabled: p.disabled ? false : undefined,
          description: typeof p.description === 'string' && p.description ? p.description : undefined,
        }));
      return { type: 'form', formParts };
    }
    case 'graphql': {
      const gql = body.graphql ?? {};
      return {
        type: 'graphql',
        content: typeof gql.query === 'string' ? gql.query : '',
        graphqlVariables: typeof gql.variables === 'string' ? gql.variables : undefined,
      };
    }
    case 'formdata': {
      const raw = Array.isArray(body.formdata) ? body.formdata : [];
      const parts: MultipartPart[] = [];
      let filePlaceholderCount = 0;
      for (const p of raw) {
        if (p.disabled) continue;
        const name = typeof p.key === 'string' ? p.key : '';
        if (p.type === 'file') {
          // `src` can be a single string or an array (multi-file pick).
          // Emit one placeholder FileRef per entry; empty `src` falls
          // back to a single unnamed placeholder.
          const srcArr = Array.isArray(p.src) ? p.src : typeof p.src === 'string' ? [p.src] : [];
          const fileRefs =
            srcArr.length > 0
              ? srcArr.map((s) => placeholderFileRef({ filename: basenameFromPath(s ?? '') || 'unnamed' }))
              : [placeholderFileRef({ filename: (typeof p.value === 'string' ? p.value : name) || 'unnamed' })];
          parts.push({ kind: 'file', uid: generateUid(), name, fileRefs });
          filePlaceholderCount += fileRefs.length;
          continue;
        }
        parts.push({ kind: 'text', uid: generateUid(), name, value: typeof p.value === 'string' ? p.value : '' });
      }
      if (filePlaceholderCount > 0) {
        recordTransform(report, {
          path: `${jsonPath}.request.body.formdata`,
          from: `formdata (${filePlaceholderCount} file part${filePlaceholderCount === 1 ? '' : 's'})`,
          to: 'multipart with placeholder FileRefs',
          reason: `Postman collections don't include file bytes. File parts imported as placeholders — open the request editor's Body tab to upload the real files.`,
          tracking: '#todo-file-blobs',
        });
      }
      if (parts.length === 0) return { type: 'none' };
      return { type: 'multipart', multipartParts: parts };
    }
    case 'file': {
      // Postman's `file` body mode ships an entire file as the request
      // body (not inside a multipart envelope). We express this as a
      // multipart body with a single file part so the UI can prompt
      // for reconciliation through the same affordance.
      const src = typeof body.file?.src === 'string' ? body.file.src : undefined;
      const filename = src ? basenameFromPath(src) : 'binary-body';
      recordTransform(report, {
        path: `${jsonPath}.request.body`,
        from: 'file (raw binary body)',
        to: 'multipart with placeholder FileRef',
        reason: `Postman's raw-file body landed as a one-part multipart placeholder so reconciliation uses the same UI as every other importer. If the target API wants a raw binary body (not multipart), switch the body type after upload.`,
        tracking: '#todo-file-blobs',
      });
      return {
        type: 'multipart',
        multipartParts: [
          {
            kind: 'file',
            uid: generateUid(),
            name: 'file',
            fileRefs: [placeholderFileRef({ filename: filename || 'binary-body' })],
          },
        ],
      };
    }
    case 'binary': {
      recordDrop(report, {
        path: `${jsonPath}.request.body`,
        reason:
          'Binary body not imported — Postman does not record the bytes. Open the request editor, switch Body type to Multipart, and upload the file manually.',
        tracking: '#todo-file-blobs',
      });
      return { type: 'none' };
    }
    default: {
      recordDrop(report, {
        path: `${jsonPath}.request.body`,
        reason: `Unknown body mode "${body.mode}" — dropped.`,
        tracking: 'PERMANENT: body-mode picklist',
      });
      return { type: 'none' };
    }
  }
}

function contentTypeOf(headers: readonly RequestHeader[]): string | null {
  for (const h of headers) {
    if (h.key.toLowerCase() === 'content-type') return h.value;
  }
  return null;
}

/**
 * Split a `key=value&key2=value2` string into structured form fields.
 * URL-decoding of both key and value matches what the wire decoder
 * does, so what the user sees in the editor is what the executor will
 * send. Empty `=` keys (`=value`, `key=`) are kept — the executor
 * preserves them too. A bare `?` row with no `=` becomes a key-only
 * field with empty value.
 */
function parseUrlEncodedToFormFields(encoded: string): Array<{ uid: string; key: string; value: string }> {
  if (!encoded) return [];
  const out: Array<{ uid: string; key: string; value: string }> = [];
  for (const segment of encoded.split('&')) {
    if (segment.length === 0) continue;
    const eq = segment.indexOf('=');
    const rawKey = eq < 0 ? segment : segment.slice(0, eq);
    const rawValue = eq < 0 ? '' : segment.slice(eq + 1);
    out.push({ uid: generateUid(), key: safeUrlDecode(rawKey), value: safeUrlDecode(rawValue) });
  }
  return out;
}

function safeUrlDecode(s: string): string {
  try {
    return decodeURIComponent(s.replace(/\+/g, ' '));
  } catch {
    return s;
  }
}

function basenameFromPath(path: string): string {
  const cleaned = path.replace(/\\/g, '/').replace(/\/+$/, '');
  const slash = cleaned.lastIndexOf('/');
  return slash < 0 ? cleaned : cleaned.slice(slash + 1);
}
