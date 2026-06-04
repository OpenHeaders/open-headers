import { ToolbarMenuPopover } from '../../ToolbarMenuPopover';

/**
 * `View ▾` dropdown for the Timing tab. Visibility-only — Timing has no
 * filter input or sort axis, so the menu is a stack of band toggles
 * (insights / context strip / phase breakdown / bar / Server-Timing /
 * repeats). The badge counts non-default toggles so the user always
 * knows the view isn't its default shape.
 */
export function TimingViewMenu({
  showInsights,
  showContextStrip,
  showPhaseGroups,
  showTimingBar,
  showServerTiming,
  showRepeats,
  onToggleShowInsights,
  onToggleShowContextStrip,
  onToggleShowPhaseGroups,
  onToggleShowTimingBar,
  onToggleShowServerTiming,
  onToggleShowRepeats,
}: {
  showInsights: boolean;
  showContextStrip: boolean;
  showPhaseGroups: boolean;
  showTimingBar: boolean;
  showServerTiming: boolean;
  showRepeats: boolean;
  onToggleShowInsights: () => void;
  onToggleShowContextStrip: () => void;
  onToggleShowPhaseGroups: () => void;
  onToggleShowTimingBar: () => void;
  onToggleShowServerTiming: () => void;
  onToggleShowRepeats: () => void;
}) {
  const activeCount = [
    !showInsights,
    !showContextStrip,
    !showPhaseGroups,
    !showTimingBar,
    !showServerTiming,
    !showRepeats,
  ].reduce((n, v) => n + (v ? 1 : 0), 0);
  return (
    <ToolbarMenuPopover label="View" activeCount={activeCount}>
      <label className="dt-morefilters-item">
        <input type="checkbox" checked={showInsights} onChange={onToggleShowInsights} />
        Show suggestions
      </label>
      <label className="dt-morefilters-item">
        <input type="checkbox" checked={showContextStrip} onChange={onToggleShowContextStrip} />
        Show context strip
      </label>
      <label className="dt-morefilters-item">
        <input type="checkbox" checked={showPhaseGroups} onChange={onToggleShowPhaseGroups} />
        Show phase breakdown
      </label>
      <label className="dt-morefilters-item">
        <input type="checkbox" checked={showTimingBar} onChange={onToggleShowTimingBar} />
        Show timing bar
      </label>
      <label className="dt-morefilters-item">
        <input type="checkbox" checked={showServerTiming} onChange={onToggleShowServerTiming} />
        Show Server-Timing
      </label>
      <label className="dt-morefilters-item">
        <input type="checkbox" checked={showRepeats} onChange={onToggleShowRepeats} />
        Show repeats in session
      </label>
    </ToolbarMenuPopover>
  );
}
