/**
 * Environment codec — two-file secret split (invariant #8).
 *
 * On disk:
 *
 *   environments/<slug>-<uid>.yaml               # non-secret vars
 *   environments/<slug>-<uid>.secret.yaml        # secret vars (gitignored)
 *   environments/<slug>-<uid>.secret.yaml.template  # committed skeleton
 *
 * The in-memory `Environment.variables` mixes `type: 'default'` +
 * `type: 'secret'` entries; the codec splits on `type` when writing and
 * merges both files on read. The template sibling carries the secret
 * names with empty values — new teammates see which keys they need to
 * populate without ever committing actual secrets.
 *
 * API shape:
 *   parseEnvironment({ default, secret?, path })          → ParsedDocument<Environment>
 *   serializeEnvironment(write) → { default, secret, template }
 *
 * The parse path preserves the raw Document from the default file only
 * — that's the file merge-patches round-trip through. The secret file
 * is reconstituted from `Environment.variables.filter(type==='secret')`
 * on every write (no unknown-field preservation for secrets since they
 * live outside version control).
 */

import * as v from 'valibot';
import * as YAML from 'yaml';
import { makeParsed, type ParsedDocument, type WriteableDocument } from '../../schemas/document';
import { EnvironmentSchema } from '../../schemas/variable';
import type { Environment, Variable } from '../../types/v5/variable';
import { CANONICAL_STRINGIFY_OPTIONS } from './canonical';
import { buildFreshDocument, mergeKnownFields } from './merge';
import { ENVIRONMENT_FIELD_ORDER } from './ordering';

export interface EnvironmentCodecInput {
  /** `<slug>-<uid>.yaml` content. */
  default: string;
  /** `<slug>-<uid>.secret.yaml` content. Missing when the sibling file doesn't exist. */
  secret?: string;
}

export interface EnvironmentSerializeOutput {
  /** Target: `<slug>-<uid>.yaml`. */
  default: string;
  /** Target: `<slug>-<uid>.secret.yaml` (gitignored). */
  secret: string;
  /** Target: `<slug>-<uid>.secret.yaml.template` (committed; values blanked). */
  template: string;
}

/**
 * Shape of the secret sibling: identity-less (identity lives on the
 * non-secret sibling) + the secret subset of variables. Parsed with a
 * local valibot schema — lightweight and not re-exported.
 */
const SecretEnvelope = v.object({
  schemaVersion: v.pipe(v.number(), v.integer(), v.minValue(5)),
  variables: v.array(
    v.object({
      name: v.string(),
      value: v.string(),
      type: v.picklist(['secret']),
    }),
  ),
});

export function parseEnvironment(input: EnvironmentCodecInput): ParsedDocument<Environment> {
  const defaultDoc = YAML.parseDocument(input.default);
  const defaultRaw = defaultDoc.toJS() as { variables?: Variable[] } & Record<string, unknown>;
  const defaultVars = Array.isArray(defaultRaw.variables) ? defaultRaw.variables : [];

  let secretVars: Variable[] = [];
  if (input.secret !== undefined && input.secret.trim().length > 0) {
    const secretDoc = YAML.parseDocument(input.secret);
    const secretRaw = v.parse(SecretEnvelope, secretDoc.toJS());
    secretVars = secretRaw.variables;
  }

  const merged = {
    ...defaultRaw,
    variables: [...defaultVars, ...secretVars],
  };
  const value = v.parse(EnvironmentSchema, merged);
  return makeParsed(value, defaultDoc);
}

export function serializeEnvironment(write: WriteableDocument<Environment>): EnvironmentSerializeOutput {
  const nonSecret = write.value.variables.filter((x) => x.type === 'default');
  const secret = write.value.variables.filter((x) => x.type === 'secret');

  // Non-secret file: merge over the preserved Document if present.
  const defaultView: Environment = { ...write.value, variables: nonSecret };
  const defaultDoc = write.raw
    ? (write.raw as YAML.Document)
    : buildFreshDocument(defaultView, ENVIRONMENT_FIELD_ORDER);
  if (write.raw) mergeKnownFields(defaultDoc, defaultView, ENVIRONMENT_FIELD_ORDER);
  const defaultYaml = defaultDoc.toString(CANONICAL_STRINGIFY_OPTIONS);

  // Secret file: fresh every time. No preserve-unknown — the file is
  // gitignored and rewritten in full on every vault mutation.
  const secretDoc = new YAML.Document({
    schemaVersion: write.value.schemaVersion,
    variables: secret,
  });
  const secretYaml = secretDoc.toString(CANONICAL_STRINGIFY_OPTIONS);

  // Template file: same secret shape, values blanked.
  const templateDoc = new YAML.Document({
    schemaVersion: write.value.schemaVersion,
    variables: secret.map((entry) => ({ name: entry.name, value: '', type: entry.type })),
  });
  const templateYaml = templateDoc.toString(CANONICAL_STRINGIFY_OPTIONS);

  return { default: defaultYaml, secret: secretYaml, template: templateYaml };
}
