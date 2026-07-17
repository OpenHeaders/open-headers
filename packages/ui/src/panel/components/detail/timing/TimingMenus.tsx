import { useT } from '@openheaders/ui/context/LocaleContext';
import type { SettingKey } from '@openheaders/ui/workbench/settings/types';
import { MenuNonDefaultDot, ToolbarMenuPopover } from '../../ToolbarMenuPopover';

/** Settings behind the `View ▾` menu — its badge, dots, and reset derive from these. */
export const TIMING_VIEW_MENU_KEYS: readonly SettingKey[] = [
  'devpanelTiming.showInsights',
  'devpanelTiming.showContextStrip',
  'devpanelTiming.showPhaseGroups',
  'devpanelTiming.showTimingBar',
  'devpanelTiming.showServerTiming',
  'devpanelTiming.showRepeats',
  'devpanelTiming.showTransferRate',
];

/**
 * `View ▾` dropdown for the Timing tab. Visibility-only — Timing has no
 * filter input or sort axis, so the menu is a stack of band toggles
 * (insights / context strip / phase breakdown / bar / Server-Timing /
 * repeats / transfer rate). The badge counts toggles that differ from
 * their registered defaults and each such row carries a dot; the parent
 * derives `modified` from the settings registry ([[TIMING_VIEW_MENU_KEYS]])
 * so the menu carries no baseline of its own.
 */
export function TimingViewMenu({
  showInsights,
  showContextStrip,
  showPhaseGroups,
  showTimingBar,
  showServerTiming,
  showRepeats,
  showTransferRate,
  modified,
  onToggleShowInsights,
  onToggleShowContextStrip,
  onToggleShowPhaseGroups,
  onToggleShowTimingBar,
  onToggleShowServerTiming,
  onToggleShowRepeats,
  onToggleShowTransferRate,
  onReset,
}: {
  showInsights: boolean;
  showContextStrip: boolean;
  showPhaseGroups: boolean;
  showTimingBar: boolean;
  showServerTiming: boolean;
  showRepeats: boolean;
  showTransferRate: boolean;
  /** View settings that differ from their registered default. */
  modified: ReadonlySet<SettingKey>;
  onToggleShowInsights: () => void;
  onToggleShowContextStrip: () => void;
  onToggleShowPhaseGroups: () => void;
  onToggleShowTimingBar: () => void;
  onToggleShowServerTiming: () => void;
  onToggleShowRepeats: () => void;
  onToggleShowTransferRate: () => void;
  /** Restore every View option to its registered default. */
  onReset: () => void;
}) {
  const t = useT();
  const activeCount = modified.size;
  return (
    <ToolbarMenuPopover label={t('panel.inspector.timing.view.label')} activeCount={activeCount}>
      <label className="dt-morefilters-item">
        <input type="checkbox" checked={showInsights} onChange={onToggleShowInsights} />
        {t('panel.inspector.timing.view.showSuggestions')}
        <MenuNonDefaultDot show={modified.has('devpanelTiming.showInsights')} />
      </label>
      <label className="dt-morefilters-item">
        <input type="checkbox" checked={showContextStrip} onChange={onToggleShowContextStrip} />
        {t('panel.inspector.timing.view.showContextStrip')}
        <MenuNonDefaultDot show={modified.has('devpanelTiming.showContextStrip')} />
      </label>
      <label className="dt-morefilters-item">
        <input type="checkbox" checked={showPhaseGroups} onChange={onToggleShowPhaseGroups} />
        {t('panel.inspector.timing.view.showPhaseBreakdown')}
        <MenuNonDefaultDot show={modified.has('devpanelTiming.showPhaseGroups')} />
      </label>
      <label className="dt-morefilters-item">
        <input type="checkbox" checked={showTimingBar} onChange={onToggleShowTimingBar} />
        {t('panel.inspector.timing.view.showTimingBar')}
        <MenuNonDefaultDot show={modified.has('devpanelTiming.showTimingBar')} />
      </label>
      <label className="dt-morefilters-item">
        <input type="checkbox" checked={showServerTiming} onChange={onToggleShowServerTiming} />
        {t('panel.inspector.timing.view.showServerTiming')}
        <MenuNonDefaultDot show={modified.has('devpanelTiming.showServerTiming')} />
      </label>
      <label className="dt-morefilters-item">
        <input type="checkbox" checked={showRepeats} onChange={onToggleShowRepeats} />
        {t('panel.inspector.timing.view.showRepeats')}
        <MenuNonDefaultDot show={modified.has('devpanelTiming.showRepeats')} />
      </label>
      <label className="dt-morefilters-item">
        <input type="checkbox" checked={showTransferRate} onChange={onToggleShowTransferRate} />
        {t('panel.inspector.timing.view.showTransferRate')}
        <MenuNonDefaultDot show={modified.has('devpanelTiming.showTransferRate')} />
      </label>
      <div className="dt-morefilters-divider" />
      <button type="button" className="dt-morefilters-reset" onClick={onReset} disabled={activeCount === 0}>
        {t('panel.menu.resetToDefault')}
      </button>
    </ToolbarMenuPopover>
  );
}
