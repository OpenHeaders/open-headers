/**
 * Active-workspace mutator catalog — routing constants.
 *
 * The host's active-workspace pointer: which workspace this host is
 * operating on. A host-local singleton in the `__global__` scope beside
 * the workspace list (`extension-workspace`), never on any wire in
 * either direction (`HOST_LOCAL_ENTITY_TYPES`): two hosts that share a
 * workspace list each keep their own pointer, the same way each keeps
 * its own dock layout. Same-host surfaces still converge over the
 * local broadcast — the renderer's switcher writes it, the service
 * worker's coord runner swaps the per-workspace stores on commit.
 *
 * The pointer used to be the `activeId` scalar on the shared list
 * record (`EXTENSION_WORKSPACE_ACTIVE_ID_PATH`), replicated LWW across
 * every host of an Org. Those rows stay in every log and are ignored
 * by type and path at the projector and the side-effect derivation.
 *
 * Not sensitive. Side effect: `SWAP_PER_WORKSPACE_STORES` on every
 * committed `setField`.
 */

/** Routing key carried on every active-workspace mutation envelope. */
export const ACTIVE_WORKSPACE_ENTITY_TYPE = 'active-workspace';

/** Fixed singleton id — one pointer per host. */
export const ACTIVE_WORKSPACE_ID = 'active-workspace';

/** Scalar path holding the active workspace id (string). */
export const ACTIVE_WORKSPACE_PATH = 'workspaceId';
