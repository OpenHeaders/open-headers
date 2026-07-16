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

import { useT } from '@openheaders/ui/context/LocaleContext';
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
  const t = useT();
  return (
    <CtaMenu
      label={t('panel.inspector.headers.redirect.label')}
      ohTrigger
      title={t('panel.inspector.headers.redirect.title')}
      items={[
        {
          label: t('panel.inspector.headers.redirect.url'),
          title: t('panel.inspector.headers.redirect.urlTitle'),
          onPick: onCreateRedirect,
        },
        {
          label: t('panel.inspector.headers.redirect.replaceHost'),
          title: t('panel.inspector.headers.redirect.replaceHostTitle'),
          onPick: onCreateReplaceHost,
        },
        {
          label: t('panel.inspector.headers.redirect.localhost'),
          title: t('panel.inspector.headers.redirect.localhostTitle'),
          onPick: onCreateLocalhost,
        },
      ]}
    />
  );
}
