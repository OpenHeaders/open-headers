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

import { useT } from '@openheaders/ui/context/LocaleContext';
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
  const t = useT();
  const roleLabel = suppressRoleChip ? '' : roleChipLabel(t, role);
  const roleTooltip = (() => {
    if (vendor) {
      const noun =
        role === 'auth'
          ? t('panel.inspector.cookies.role.nounAuth')
          : role === 'tracking'
            ? t('panel.inspector.cookies.role.nounTracking')
            : role === 'pref'
              ? t('panel.inspector.cookies.role.nounPref')
              : t('panel.inspector.cookies.role.nounOther');
      return t('panel.inspector.cookies.role.vendorTooltip', { vendor, noun });
    }
    if (role === 'auth') return t('panel.inspector.cookies.role.tooltipAuth');
    if (role === 'tracking') return t('panel.inspector.cookies.role.tooltipTracking');
    if (role === 'pref') return t('panel.inspector.cookies.role.tooltipPref');
    return '';
  })();
  return (
    <span className="dt-cookie-chips">
      {roleLabel && <Chip tone="role" label={roleLabel} title={roleTooltip} />}
      {row.partitionKey && (
        <Chip
          tone="info"
          label={t('panel.inspector.cookies.chips.partitioned')}
          title={t('panel.inspector.cookies.chips.partitionedTitle', { key: row.partitionKey })}
        />
      )}
      {thirdParty && <Chip tone="warn" label={t('panel.inspector.cookies.chips.thirdParty')} />}
      {row.attribution === 'response-set' && !dropped && (
        <Chip
          tone="info"
          label={t('panel.inspector.cookies.chips.justSet')}
          title={t('panel.inspector.cookies.chips.justSetTitle')}
        />
      )}
      {dropped && (
        <Chip
          tone="err"
          label={t('panel.inspector.cookies.chips.dropped')}
          title={t('panel.inspector.cookies.chips.droppedTitle')}
        />
      )}
      {row.attribution === 'filtered-out' && (
        <Chip
          tone="warn"
          label={t('panel.inspector.cookies.chips.filteredOut')}
          title={row.filteredReason ?? t('panel.inspector.cookies.chips.filteredOutFallbackTitle')}
        />
      )}
      {problem && <Chip tone="err" label="!" title={t('panel.inspector.cookies.chips.problemTitle')} />}
    </span>
  );
}
