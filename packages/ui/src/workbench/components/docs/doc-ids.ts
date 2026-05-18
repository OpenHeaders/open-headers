/**
 * Compatibility re-export — doc-id maps + lookup helpers now live in
 * `@openheaders/ui/shared/docs/doc-ids`. Existing rule-editor callsites
 * still import from this file; new code should import from the shared
 * module directly.
 */

export * from '@openheaders/ui/shared/docs/doc-ids';
