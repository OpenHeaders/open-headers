import { isPresenceEmpty } from './data-presence';
import type { ModeSwitchInput, ModeSwitchVerdict } from './types';

/**
 * Mode-switch decision state machine. Pure of host runtime — call sites
 * compute presence on both sides (their own host directly, the peer via
 * whatever RPC fits) and feed it in.
 *
 * Branch order matches `docs/DATA_PLANE_TOPOLOGIES.md` §11.2:
 *
 *   1. mode unchanged                  ⇒ no-change
 *   2. peer unreachable                ⇒ peer-unreachable (M2 surfaces "connect target first")
 *   3. both empty                      ⇒ both-empty (silent commit, nothing to merge)
 *   4. source empty                    ⇒ silent-use-target
 *   5. target empty                    ⇒ silent-import-source
 *   6. both populated                  ⇒ show-dialog (Coexist / Import / Discard)
 */
export function decideModeSwitch(input: ModeSwitchInput): ModeSwitchVerdict {
  if (input.fromMode === input.toMode) {
    return { kind: 'no-change' };
  }
  if (input.target === null) {
    return { kind: 'peer-unreachable' };
  }
  const sourceEmpty = isPresenceEmpty(input.source);
  const targetEmpty = isPresenceEmpty(input.target);
  if (sourceEmpty && targetEmpty) return { kind: 'both-empty' };
  if (sourceEmpty) return { kind: 'silent-use-target' };
  if (targetEmpty) return { kind: 'silent-import-source' };
  return { kind: 'show-dialog', source: input.source, target: input.target };
}
