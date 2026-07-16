import { useT, type Translate } from '@openheaders/ui/context/LocaleContext';
import { InfoTrigger, type InfoPopoverContent } from '@openheaders/ui/shared/info-popover';
import { useMemo } from 'react';

/**
 * The warning shown above the Request Headers list when the lifecycle's
 * request headers are still provisional — the cooked set the browser
 * assembled, not a confirmed on-the-wire capture. Mirrors the browser's
 * "Provisional headers are shown" banner, but explains *why* in-app (no
 * external doc link) via the shared info-popover.
 */

function provisionalInfo(t: Translate): InfoPopoverContent {
  return {
    title: t('panel.inspector.headers.provisional.title'),
    kicker: t('panel.inspector.headers.provisional.kicker'),
    summary: t('panel.inspector.headers.provisional.summary'),
    sections: [
      {
        heading: t('panel.inspector.headers.provisional.whyHeading'),
        items: [
          {
            label: t('panel.inspector.headers.provisional.cacheLabel'),
            desc: t('panel.inspector.headers.provisional.cacheDesc'),
          },
          {
            label: t('panel.inspector.headers.provisional.blockedLabel'),
            desc: t('panel.inspector.headers.provisional.blockedDesc'),
          },
          {
            label: t('panel.inspector.headers.provisional.inFlightLabel'),
            desc: t('panel.inspector.headers.provisional.inFlightDesc'),
          },
        ],
      },
    ],
  };
}

export function ProvisionalHeadersBanner({ cached }: { cached: boolean }) {
  const t = useT();
  const info = useMemo(() => provisionalInfo(t), [t]);
  return (
    <div className="dt-provisional-banner" role="note">
      <span className="dt-provisional-banner-icon" aria-hidden="true">
        ⚠
      </span>
      <span className="dt-provisional-banner-text">
        {cached
          ? t('panel.inspector.headers.provisional.bannerCached')
          : t('panel.inspector.headers.provisional.bannerPending')}
      </span>
      <InfoTrigger content={info} className="dt-header-info-trigger" />
    </div>
  );
}
