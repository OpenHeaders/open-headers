/**
 * Script Package type — derived from the valibot schema in
 * `../schemas/script-package.ts` so the runtime validator and the
 * TypeScript type stay locked together.
 */

import type * as v from 'valibot';
import type { ScriptPackageSchema } from '../schemas/script-package';

/** A named, reusable script module loaded via `oh.require('<name>')`. */
export type ScriptPackage = v.InferOutput<typeof ScriptPackageSchema>;
