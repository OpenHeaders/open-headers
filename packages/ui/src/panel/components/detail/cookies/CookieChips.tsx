/**
 * Per-row chip strip — semantic labels that float to the right of the
 * cookie name. Each chip is small enough to scan in the corner of the
 * eye; the row's title prop still carries the long-form explanation
 * so hover stays useful.
 */

import type { CookieRow } from '../../../data/cookie-model';

interface CookieChipsProps {
  row: CookieRow;
  problem: boolean;
  thirdParty: boolean;
  hostPrefix: boolean;
  securePrefix: boolean;
  expired: boolean;
}

function Chip({ tone, label, title }: { tone: 'ok' | 'warn' | 'err' | 'info'; label: string; title?: string }) {
  return (
    <span className={`dt-cookie-chip dt-cookie-chip--${tone}`} title={title}>
      {label}
    </span>
  );
}

export function CookieChips({ row, problem, thirdParty, hostPrefix, securePrefix, expired }: CookieChipsProps) {
  const ss = row.sameSite ? String(row.sameSite).toLowerCase() : '';
  const sameSiteLabel =
    ss === 'no_restriction' || ss === 'none' ? 'SameSite=None'
    : ss === 'lax' ? 'SameSite=Lax'
    : ss === 'strict' ? 'SameSite=Strict'
    : null;

  return (
    <span className="dt-cookie-chips">
      {hostPrefix && (
        <Chip tone="info" label="__Host-" title="Host-locked: must be Secure, Path=/, no Domain." />
      )}
      {securePrefix && (
        <Chip tone="info" label="__Secure-" title="Secure-prefix: must be Secure." />
      )}
      {row.secure && <Chip tone="ok" label="Secure" title="Sent only over HTTPS." />}
      {row.httpOnly && <Chip tone="ok" label="HttpOnly" title="Not readable from JavaScript." />}
      {sameSiteLabel && (
        <Chip
          tone={ss === 'no_restriction' || ss === 'none' ? (row.secure ? 'info' : 'err') : 'ok'}
          label={sameSiteLabel}
          title={
            ss === 'no_restriction' || ss === 'none'
              ? 'Cross-site sendable — must also be Secure.'
              : 'Restricted to same-site contexts.'
          }
        />
      )}
      {row.partitionKey && <Chip tone="info" label="Partitioned" title={`Partitioned to ${row.partitionKey}`} />}
      {row.session && <Chip tone="info" label="Session" />}
      {expired && <Chip tone="err" label="Expired" />}
      {thirdParty && <Chip tone="warn" label="3rd-party" />}
      {row.attribution === 'response-set' && <Chip tone="info" label="Just set" />}
      {row.attribution === 'filtered-out' && (
        <Chip tone="warn" label="Filtered out" title={row.filteredReason ?? 'Not sent on this request'} />
      )}
      {problem && <Chip tone="err" label="!" title="See suggestion above." />}
    </span>
  );
}
