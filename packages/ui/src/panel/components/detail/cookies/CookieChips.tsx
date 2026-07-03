/**
 * Per-row chip strip — semantic + lifecycle labels only. Chips that
 * duplicate the cookie name (`__Host-` / `__Secure-` prefixes are
 * already visible in the Name column) or the table columns (Secure /
 * HttpOnly / SameSite / Session / Expired) are intentionally absent.
 *
 * Each chip is one short word/phrase in plain English. The prefix
 * meanings (`__Host-` / `__Secure-`) are surfaced via a tooltip on
 * the cookie name itself in `CookieRow`, not echoed back as a chip.
 *
 * What this strip is for: surfacing facts NOT in any column.
 *
 *   - role chips   `auth?` `tracking?` `pref` — heuristic guesses.
 *   - lifecycle    `just set` `dropped` `filtered out`.
 *   - context      `3rd-party` `partitioned`.
 *   - problem      `!` — has an insight; the top callout explains why.
 */

import type { CookieRow } from '../../../data/cookies/cookie-model';
import type { CookieRole } from '../../../data/cookies/cookie-role';
import { roleChipLabel } from '../../../data/cookies/cookie-role';

interface CookieChipsProps {
  row: CookieRow;
  role: CookieRole;
  /** Vendor / source attribution from the classifier — surfaced in the
   *  role chip's tooltip ("Google Analytics" instead of just "tracking"). */
  vendor?: string;
  problem: boolean;
  thirdParty: boolean;
  /** True when a Set-Cookie response landed but the browser will
   *  reject it (missing Secure + SameSite=None, __Host- violation, …).
   *  Inferred at insight-compute time from the same rules. */
  dropped: boolean;
  /** When the surface groups rows by role, the role chip duplicates
   *  the group heading on every row. The lifecycle and context chips
   *  still carry unique signal and stay visible. */
  suppressRoleChip?: boolean;
}

function Chip({ tone, label, title }: { tone: 'ok' | 'warn' | 'err' | 'info' | 'role'; label: string; title?: string }) {
  return (
    <span className={`dt-cookie-chip dt-cookie-chip--${tone}`} title={title}>
      {label}
    </span>
  );
}

export function CookieChips({ row, role, vendor, problem, thirdParty, dropped, suppressRoleChip }: CookieChipsProps) {
  const roleLabel = suppressRoleChip ? '' : roleChipLabel(role);
  const roleTooltip = (() => {
    if (vendor) {
      const noun =
        role === 'auth' ? 'auth / session'
        : role === 'tracking' ? 'analytics / tracking'
        : role === 'pref' ? 'preference / consent'
        : 'cookie';
      return `${vendor} — ${noun} cookie.`;
    }
    if (role === 'auth') return 'Looks like an auth / session cookie (heuristic).';
    if (role === 'tracking') return 'Looks like an analytics / tracking cookie (heuristic).';
    if (role === 'pref') return 'A user-preference cookie.';
    return '';
  })();
  return (
    <span className="dt-cookie-chips">
      {roleLabel && <Chip tone="role" label={roleLabel} title={roleTooltip} />}
      {row.partitionKey && <Chip tone="info" label="partitioned" title={`Isolated to top-level site: ${row.partitionKey}`} />}
      {thirdParty && <Chip tone="warn" label="3rd-party" />}
      {row.attribution === 'response-set' && !dropped && (
        <Chip tone="info" label="just set" title="Set by this response." />
      )}
      {dropped && <Chip tone="err" label="dropped" title="The browser will reject this Set-Cookie." />}
      {row.attribution === 'filtered-out' && (
        <Chip tone="warn" label="filtered out" title={row.filteredReason ?? 'Not sent on this request.'} />
      )}
      {problem && <Chip tone="err" label="!" title="See suggestion above." />}
    </span>
  );
}
