/**
 * Workspace identity — canonical form is UUIDv7 per
 * the data-plane topologies design §11.3`.
 *
 * **Why UUIDv7 specifically:**
 *
 *   - **Cross-host uniqueness without coordination.** Two devices that
 *     create a workspace offline (same user, same name) MUST mint
 *     distinct ids — name-based merging is the #1 cause of "mysterious
 *     data loss" in Postman / VS Code Sync (§11.2). UUIDv7's 74 bits of
 *     randomness rule out collisions in practice.
 *   - **Temporal order falls out for free.** The 48-bit unix-ms prefix
 *     means lexicographic sort matches creation order. Useful for
 *     "newest workspace first" UI without a separate `createdAt`, and
 *     for the mode-switch dialog's name-collision dedup (§11.2 hybrid
 *     improvement — older workspace wins as the canonical id when two
 *     same-named offline mints meet).
 *   - **Distinct from entity uids.** Entity uids inside a workspace
 *     (rule.uid, header.uid, etc.) stay at 8-char base36 — their scope
 *     is one workspace and a 2.8T id-space is plenty. Mixing the two
 *     formats also gives a fast visual cue when debugging the wire:
 *     workspaceIds look like UUIDs, entity uids don't.
 *
 * **Where this matters:**
 *
 *   - `oh.sync.hello` (`@openheaders/core/protocol/handshake`) carries
 *     `workspaceId`; the responder uses it to read its log + state
 *     vector. If two peers carry the same name but different ids the
 *     mode-switch dialog (§11.2) handles the collision; format
 *     canonicalization happens here so the dialog never has to think
 *     about partial-format matches.
 *   - YAML serialization (Phase D Git backend) puts workspaceId in the
 *     file path; UUIDv7 is filesystem-safe ASCII.
 *
 * **What this module does NOT do:**
 *
 *   - Enforce the format on inbound wire frames. The protocol schemas
 *     stay `minLength(1)` — peer-supplied ids are opaque on the wire
 *     and reformatted only when WE mint a new one.
 */
import { isUuidV7, uuidv7 } from './uuidv7';

/**
 * Mint a fresh workspace id. The same generator runs on extension SW,
 * desktop main, and the future daemon — the audit point that closes
 * out W1-W2 of the Phase C/D status doc.
 */
export function generateWorkspaceId(): string {
  return uuidv7();
}

/**
 * True iff `id` is in the canonical UUIDv7 form WE mint. Used by
 * diagnostic / dev-tools surfaces that want to flag legacy or
 * externally-injected ids; not consulted by the runtime hot path.
 */
export function isCanonicalWorkspaceId(id: string): boolean {
  return isUuidV7(id);
}
