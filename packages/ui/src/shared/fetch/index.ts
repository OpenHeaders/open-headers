// `ensureScheme` and friends are pure URL utilities — they live in
// `@openheaders/core/utils` (the public/private interface) so the
// host-neutral request executor in `@openheaders/oracle` can reach
// them without depending on `@openheaders/ui`. Re-exported here so the
// renderer surfaces (RequestEditor URL bar) keep their existing import.
export { ensureScheme, inferSchemeForBareHost, needsSchemeNormalization } from '@openheaders/core/utils';
