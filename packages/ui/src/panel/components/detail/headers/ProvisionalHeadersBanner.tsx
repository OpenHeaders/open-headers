import { InfoTrigger, type InfoPopoverContent } from '@openheaders/ui/shared/info-popover';

/**
 * The warning shown above the Request Headers list when the lifecycle's
 * request headers are still provisional — the cooked set the browser
 * assembled, not a confirmed on-the-wire capture. Mirrors the browser's
 * "Provisional headers are shown" banner, but explains *why* in-app (no
 * external doc link) via the shared info-popover.
 */

const PROVISIONAL_INFO: InfoPopoverContent = {
  title: 'Provisional headers',
  kicker: 'Request',
  summary:
    'These are the headers the browser assembled and intended to send — not a confirmed capture of what crossed the wire. The on-the-wire set can differ (the network stack adds cookies, credentials, and connection headers later).',
  sections: [
    {
      heading: 'Why a request shows only provisional headers',
      items: [
        {
          label: 'Served from cache',
          desc: 'Answered locally (memory/disk cache or a service worker) — nothing was sent on the wire this time, so the original sent headers were never stored.',
        },
        {
          label: 'Never reached the network',
          desc: 'Blocked or failed before a header exchange completed (an invalid URL, a CORS/CSP block, a connection error).',
        },
        {
          label: 'Still in flight',
          desc: 'The on-the-wire set has not been reported yet; it resolves once the request completes.',
        },
      ],
    },
  ],
};

export function ProvisionalHeadersBanner({ cached }: { cached: boolean }) {
  return (
    <div className="dt-provisional-banner" role="note">
      <span className="dt-provisional-banner-icon" aria-hidden="true">
        ⚠
      </span>
      <span className="dt-provisional-banner-text">
        {cached
          ? 'Provisional headers are shown — served from cache, so the original sent headers aren’t stored.'
          : 'Provisional headers are shown — the on-the-wire set hasn’t been confirmed yet.'}
      </span>
      <InfoTrigger content={PROVISIONAL_INFO} className="dt-header-info-trigger" />
    </div>
  );
}
