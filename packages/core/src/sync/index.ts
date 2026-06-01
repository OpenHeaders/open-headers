/**
 * Sync engine public surface (`@openheaders/core/sync`).
 *
 * See `docs/SYNC_ENGINE_DESIGN.md` for the architectural contract this
 * package implements. Phase A scope is generic mutation primitives +
 * the in-memory document store; Rule-specific mutators, the SW local
 * oracle, awareness, and the side-effect runner ship in the same
 * phase but live in their respective apps.
 */

export * from './activity';
export * from './backend';
export * from './boot-baseline';
export * from './boot-regression';
export * from './envelope';
export * from './hlc';
export * from './mutators';
export * from './order';
export * from './path';
export * from './reach-scope';
export * from './schema';
export * from './state-vector';
export * from './store';
