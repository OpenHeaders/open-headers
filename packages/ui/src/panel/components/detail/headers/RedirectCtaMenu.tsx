/**
 * `Redirect ▾` CTA — one primary button for every redirect-seeding
 * variant. The variants share a rule type and a popover; only the seeded
 * target differs, so they are menu entries rather than sibling CTAs:
 * the row spends one slot per ACTION KIND, and seeding strategies are
 * chosen at decision time, where each option can explain itself.
 *
 * Rendering is the shared `CtaMenu` (the Copy ▾ dropdown format); every
 * entry opens the create popover anchored to the trigger button.
 */

import { CtaMenu } from './CtaMenu';

export function RedirectCtaMenu({
  onCreateRedirect,
  onCreateReplaceHost,
  onCreateLocalhost,
}: {
  onCreateRedirect: (anchorEl: HTMLElement) => void;
  onCreateReplaceHost: (anchorEl: HTMLElement) => void;
  onCreateLocalhost: (anchorEl: HTMLElement) => void;
}) {
  return (
    <CtaMenu
      label="Redirect"
      ohTrigger
      title="Send matching requests somewhere else — pick how the target is pre-filled"
      items={[
        {
          label: 'Redirect URL…',
          title: 'Send matching requests to a different URL — the target seeds as a per-domain variable',
          onPick: onCreateRedirect,
        },
        {
          label: 'Replace host…',
          title: 'Keep path and query, swap the host — seeds a per-domain host variable',
          onPick: onCreateReplaceHost,
        },
        {
          label: 'Point to localhost…',
          title: 'Keep path and query, send to your local dev server over http — seeds a per-domain port variable',
          onPick: onCreateLocalhost,
        },
      ]}
    />
  );
}
