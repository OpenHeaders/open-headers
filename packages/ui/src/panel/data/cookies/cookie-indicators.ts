/**
 * Status-square logic for the Cookies tab's leading indicator column.
 *
 *   - blue  (`rule`)   — a rule that fired on this request modifies the
 *                        row's cookie header (`Cookie` for request rows,
 *                        `Set-Cookie` for response rows). The Cookie header
 *                        is a bundle, so this is per-direction, not
 *                        per-cookie-name.
 *   - grey  (`edited`) — the cookie was added/edited from the panel this
 *                        session.
 *   - none             — neither.
 *
 * A rule interaction outranks an edit when both apply — the rule is the
 * stronger "this isn't the raw browser state" signal.
 */

import type { InspectorFire } from '../types';

export type CookieIndicator = 'rule' | 'edited' | null;

const HEADER_FOR_DIRECTION: Record<'request' | 'response', string> = {
  request: 'cookie',
  response: 'set-cookie',
};

/**
 * Whether any fire on the request carries a header modification targeting
 * the cookie header for `direction`.
 */
export function cookieHeaderRuleTouched(fires: readonly InspectorFire[], direction: 'request' | 'response'): boolean {
  const target = HEADER_FOR_DIRECTION[direction];
  for (const fire of fires) {
    const mods = fire.ruleSnapshot?.headerMods;
    if (!mods) continue;
    for (const mod of mods) {
      if (mod.direction === direction && mod.headerName.toLowerCase() === target) return true;
    }
  }
  return false;
}

export function cookieRowIndicator(edited: boolean, ruleTouched: boolean): CookieIndicator {
  if (ruleTouched) return 'rule';
  if (edited) return 'edited';
  return null;
}
