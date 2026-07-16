/**
 * Spec codec — manifest + verbatim source siblings.
 *
 * On disk, a spec is a folder containing:
 *
 *   spec.yaml          # manifest (identity + file catalog, no content)
 *   index.yaml         # source file(s), verbatim — one per files[] row,
 *   ...                # named by the row's fileName
 *
 * The spec text IS the interchange format: every `files[]` row's
 * `content` fans out into its own sibling file byte-for-byte (native
 * syntax highlighting in review, verbatim export), and the manifest
 * carries only the catalog — per-row `{uid, fileName}` plus the
 * spec's scalar metadata. The caller (desktop storage service, future
 * team-sync layer) handles filesystem I/O.
 *
 * Parse input: the caller lists every sibling it found beside
 * `spec.yaml`. The codec splices each sibling's text into the matching
 * catalog row by fileName; rows without a sibling on disk parse with
 * empty content (fresh checkout mid-write), and unrecognized siblings
 * are ignored (forward-compat, same posture as the request codec).
 */

import * as v from 'valibot';
import * as YAML from 'yaml';
import { makeParsed, type ParsedDocument, type WriteableDocument } from '../../schemas/document';
import { SpecSchema } from '../../schemas/spec';
import type { Spec } from '../../types/spec';
import { CANONICAL_STRINGIFY_OPTIONS } from './canonical';
import { buildFreshDocument, mergeKnownFields } from './merge';
import { SPEC_FIELD_ORDER } from './ordering';

export interface SpecSiblingFile {
  /** Filename relative to the spec folder, e.g. "index.yaml". */
  fileName: string;
  content: string;
}

export interface SpecCodecContext {
  /** Workspace-relative spec folder path. */
  path: string;
  /** Every sibling file the caller found next to `spec.yaml`. */
  siblings?: readonly SpecSiblingFile[];
}

export function parseSpec(yaml: string, context: SpecCodecContext): ParsedDocument<Spec> {
  const doc = YAML.parseDocument(yaml);
  const raw = doc.toJS() as Record<string, unknown>;

  const contentByFileName = new Map<string, string>();
  for (const sibling of context.siblings ?? []) {
    contentByFileName.set(sibling.fileName, sibling.content);
  }

  const catalogRows = Array.isArray(raw.files) ? (raw.files as Array<Record<string, unknown>>) : [];
  const files = catalogRows.map((row) => ({
    ...row,
    content: typeof row.fileName === 'string' ? (contentByFileName.get(row.fileName) ?? '') : '',
  }));

  const merged: Record<string, unknown> = {
    ...raw,
    path: context.path,
    files,
  };

  const value = v.parse(SpecSchema, merged);
  return makeParsed(value, doc);
}

/**
 * Parse the INLINE spec shape — `files[]` rows carrying their content
 * — the representation the workspace-export envelope and
 * `serializeEntityYaml` use. No sibling splicing applies: the text is
 * self-contained. This is the deserializer for surfaces that
 * round-trip a spec through one document (the import preview's merge
 * editor); on-disk specs parse through `parseSpec` above.
 */
export function parseSpecInline(yaml: string, context: { path: string }): ParsedDocument<Spec> {
  const doc = YAML.parseDocument(yaml);
  const raw = doc.toJS() as Record<string, unknown>;
  const value = v.parse(SpecSchema, { ...raw, path: context.path });
  return makeParsed(value, doc);
}

export interface SpecSerializeOutput {
  /** `spec.yaml` contents. */
  specYaml: string;
  /** One verbatim source file per `files[]` row. */
  files: SpecSiblingFile[];
}

export function serializeSpec(write: WriteableDocument<Spec>): SpecSerializeOutput {
  // The manifest carries the file CATALOG — per-row identity + name.
  // Content fans out into the sibling files below.
  const manifestView = {
    ...write.value,
    files: write.value.files.map((file) => ({ uid: file.uid, fileName: file.fileName })),
  } as unknown as Spec;

  const doc = write.raw ? (write.raw as YAML.Document) : buildFreshDocument(manifestView, SPEC_FIELD_ORDER);
  mergeKnownFields(doc, manifestView, SPEC_FIELD_ORDER);
  const specYaml = doc.toString(CANONICAL_STRINGIFY_OPTIONS);

  const files: SpecSiblingFile[] = write.value.files.map((file) => ({
    fileName: file.fileName,
    content: file.content,
  }));

  return { specYaml, files };
}
