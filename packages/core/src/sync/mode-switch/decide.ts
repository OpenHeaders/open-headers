import { isPresenceEmpty } from './data-presence';
import { findNameCollisions } from './name-collision';
import type { ModeSwitchInput, ModeSwitchVerdict } from './types';

/**
 * Mode-switch decision state machine. Pure of host runtime — call sites
 * compute presence on both sides (their own host directly, the peer via
 * whatever RPC fits) and feed it in.
 *
 * Branch order matches `docs/DATA_PLANE_TOPOLOGIES.md` §11.2:
 *
 *   1. mode unchanged                  ⇒ no-change
 *   2. peer unreachable, source empty  ⇒ both-empty (let the user opt into
 *                                        the new backend; first-time
 *                                        switch from in-browser→desktop
 *                                        can't have its peer reachable
 *                                        until AFTER the mode flips, so
 *                                        blocking is a chicken-and-egg)
 *   3. peer unreachable, source has data ⇒ peer-unreachable (M2 surfaces
 *                                          "connect target first" — we
 *                                          can't decide merge/discard
 *                                          without seeing the peer)
 *   4. both empty                      ⇒ both-empty (silent commit, nothing to merge)
 *   5. source empty                    ⇒ silent-use-target
 *   6. target empty                    ⇒ silent-import-source
 *   7. both populated                  ⇒ show-dialog (Coexist / Import / Discard)
 */
export function decideModeSwitch(input: ModeSwitchInput): ModeSwitchVerdict {
  if (input.fromMode === input.toMode) {
    return { kind: 'no-change' };
  }
  const sourceEmpty = isPresenceEmpty(input.source);
  if (input.target === null) {
    // Source has nothing to lose → commit so the connection layer can
    // attempt its handshake under the new mode. The user explicitly
    // picked this back-end; whatever it has becomes the source of truth
    // once the WS connects.
    if (sourceEmpty) return { kind: 'both-empty' };
    return { kind: 'peer-unreachable' };
  }
  const targetEmpty = isPresenceEmpty(input.target);
  if (sourceEmpty && targetEmpty) return { kind: 'both-empty' };
  if (sourceEmpty) return { kind: 'silent-use-target' };
  if (targetEmpty) return { kind: 'silent-import-source' };
  const nameCollisions = findNameCollisions({ source: input.source, target: input.target });
  return { kind: 'show-dialog', source: input.source, target: input.target, nameCollisions };
}
