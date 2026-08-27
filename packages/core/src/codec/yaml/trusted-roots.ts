/**
 * Trusted-roots YAML codec — `trusted-roots.yaml` in the workspace
 * tree. Committed (public trust material, never a `.secret.yaml`).
 * Rows without a uid (hand-added) get one minted on read, the
 * workspace-variables idiom.
 */

import * as v from 'valibot';
import * as YAML from 'yaml';
import { makeParsed, type ParsedDocument, type WriteableDocument } from '../../schemas/document';
import { TrustedRootsSchema } from '../../schemas/trusted-roots';
import type { TrustedRoots } from '../../types/trusted-roots';
import { generateUid } from '../../utils/workspace';
import { emitCanonicalYaml } from './canonical-emit';
import { TRUSTED_ROOTS_FIELD_ORDER } from './ordering';
import { extractUnknownFields, unknownFieldsOf } from './unknown-fields';

export function parseTrustedRoots(yaml: string): ParsedDocument<TrustedRoots> {
  const doc = YAML.parseDocument(yaml);
  const raw = doc.toJS() as Record<string, unknown>;
  if (Array.isArray(raw.roots)) {
    raw.roots = raw.roots.map(mintRootUidIfMissing);
  }
  const value = v.parse(TrustedRootsSchema, raw);
  return makeParsed(value, extractUnknownFields(raw, TrustedRootsSchema, TRUSTED_ROOTS_FIELD_ORDER));
}

export function serializeTrustedRoots(write: WriteableDocument<TrustedRoots>): string {
  return emitCanonicalYaml(write.value, TrustedRootsSchema, TRUSTED_ROOTS_FIELD_ORDER, unknownFieldsOf(write));
}

function mintRootUidIfMissing(raw: unknown): unknown {
  if (typeof raw !== 'object' || raw === null) return raw;
  const obj = raw as Record<string, unknown>;
  if (typeof obj.uid === 'string') return obj;
  return { ...obj, uid: generateUid() };
}
