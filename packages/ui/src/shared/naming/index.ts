/**
 * Default names for freshly-minted entities + the "(2)" dedupe every
 * create-new surface shares (sidebar `+` affordances, the panel's
 * quick-create popovers, context-less fallbacks). One module so a
 * default name reads the same no matter which surface minted it.
 */

export const NEW_RULES_COLLECTION_NAME = 'New Rules Collection';
export const NEW_REQUESTS_COLLECTION_NAME = 'New Requests Collection';
export const NEW_TEMPLATE_COLLECTION_NAME = 'User Templates';
export const NEW_ENVIRONMENT_NAME = 'New Environment';

/** Append `(2)`, `(3)`, … to `baseName` until it clears the pool. */
export function uniqueName(baseName: string, taken: ReadonlySet<string>): string {
  let name = baseName;
  let counter = 2;
  while (taken.has(name)) name = `${baseName} (${counter++})`;
  return name;
}
