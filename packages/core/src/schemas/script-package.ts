/**
 * Script Package schema — a named, reusable module of script code that
 * pre-request / post-response scripts load via `oh.require('<name>')`.
 *
 * `name` is the require key: an identifier unique within the workspace
 * (uniqueness enforced by the write layer, same as `Environment.name`).
 * `source` is the module body — it assigns its public surface to
 * `module.exports` and runs inside the same sandbox as the requiring
 * script.
 */

import * as v from 'valibot';
import { RelativePathSchema, SchemaVersionSchema, UidSchema } from './common';

const PACKAGE_NAME_PATTERN = /^[a-zA-Z_][a-zA-Z0-9_-]*$/;
const PACKAGE_NAME_MESSAGE =
  'Must start with a letter or underscore; only letters, digits, hyphens, and underscores are allowed.';

export const ScriptPackageNameSchema = v.pipe(
  v.string(),
  v.minLength(1),
  v.maxLength(64),
  v.regex(PACKAGE_NAME_PATTERN, PACKAGE_NAME_MESSAGE),
);

export const ScriptPackageSchema = v.object({
  schemaVersion: SchemaVersionSchema,
  uid: UidSchema,
  path: RelativePathSchema,
  /** Require key: loaded as `oh.require('<name>')`. Unique within the workspace. */
  name: ScriptPackageNameSchema,
  description: v.optional(v.string()),
  /** Module source. Exposes its API by assigning to `module.exports`. */
  source: v.string(),
});
