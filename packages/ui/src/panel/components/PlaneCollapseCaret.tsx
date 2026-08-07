/**
 * PlaneCollapseCaret — the always-visible collapse header of a stacked
 * plane's toolbar (the Traffic Monitor's Network / Storage / Console
 * posture): a down-pointing caret plus the plane title, ONE click
 * target, collapsing the plane to its strip row — whose right-pointing
 * caret + title is this cluster's reopen twin, at the same offsets.
 * Rendered only when a host passes a collapse handler; the in-browser
 * DevTools panel keeps its plain title and − hide affordance instead.
 */

import { useT } from '@openheaders/ui/context/LocaleContext';

export function PlaneCollapseCaret({ label, onCollapse }: { label: string; onCollapse: () => void }) {
  const t = useT();
  return (
    <button
      type="button"
      className="dt-plane-collapse"
      data-testid="dt-plane-collapse"
      aria-expanded="true"
      title={t('panel.capture.collapsePlane')}
      onClick={onCollapse}
    >
      {/* The collapsed strip's exact triangle, rotated to point down —
          transform keeps the 4×6 layout box, so the caret column-aligns
          with the strip's caret and the title lands at the strip's own
          text offset. */}
      <span
        aria-hidden="true"
        style={{
          display: 'inline-block',
          width: 0,
          height: 0,
          borderLeft: '4px solid currentColor',
          borderTop: '3px solid transparent',
          borderBottom: '3px solid transparent',
          transform: 'rotate(90deg)',
        }}
      />
      <strong className="dt-header-panel-name">{label}</strong>
    </button>
  );
}
