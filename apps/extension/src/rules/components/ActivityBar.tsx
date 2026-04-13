/**
 * ActivityBar — permanent vertical icon strip on either the left or right
 * side of the workspace shell. Mirrors the desktop V5Shell ActivityBar
 * pattern and the IDE tool-window conventions:
 *
 *   - `side` decides which edge of the shell it attaches to. Left bars
 *     split into two groups (top drives the left Allotment pane, bottom
 *     drives the bottom Allotment pane). Right bars use only the top
 *     group.
 *   - Each icon can be in one of four visual states:
 *       closed          → neutral
 *       open + unfocused → grey selected background (IDE "selected")
 *       open + focused  → blue accent (IDE "focused")
 *       disabled        → low opacity, no interaction
 *   - Right-clicking anywhere on the bar opens a context menu to toggle
 *     the label-visibility preference (icons-only mode ~ 36px wide).
 *
 * The component is deliberately pure — all state lives in the parent
 * (useWorkspaceLayout). Click handlers are supplied per item so the host
 * can decide whether to toggle, swap, or launch.
 */

import { Dropdown, Tooltip, theme } from 'antd';
import type { ItemType } from 'antd/es/menu/interface';
import type React from 'react';
import { forwardRef, useMemo } from 'react';

// ── Public types ────────────────────────────────────────────────────

export interface ActivityBarItem {
  /** Stable identifier — typed as string so the parent can use keys from
   *  LeftPanelKey / RightPanelKey without widening. */
  key: string;
  /** Icon element (react-icon). */
  icon: React.ReactNode;
  /** Short label rendered under the icon when labels are visible. */
  label: string;
  /** Whether this item can be activated. Disabled items still show as
   *  placeholders with a tooltip hint. */
  enabled: boolean;
  /** Tooltip string — typically the keyboard shortcut or a hint. */
  tooltip?: string;
  /** Called when the user activates the item (click / Enter / Space). */
  onActivate?: () => void;
  /** Whether this item's panel is currently open on screen. */
  active: boolean;
  /**
   * Whether this item's region currently owns keyboard focus. The host
   * computes this per-item because the left bar hosts two independent
   * regions (top group → left region, bottom group → bottom region) —
   * a single bar-wide boolean would light up the wrong icons.
   */
  focused: boolean;
}

export interface ActivityBarProps {
  /** Which edge of the shell this bar is mounted on. */
  side: 'left' | 'right';
  /** Items rendered at the top of the bar. */
  topItems: ActivityBarItem[];
  /** Items rendered at the bottom (above the trailing slot). Left bar
   *  uses this for bottom-panel launchers; right bar usually leaves it
   *  empty. */
  bottomItems?: ActivityBarItem[];
  /** Optional trailing item shown at the very bottom (e.g. Settings). */
  trailingItem?: ActivityBarItem;
  /** Whether icon labels are visible. False renders the bar as a narrow
   *  icons-only strip. */
  labelsVisible: boolean;
  /** Called when the user toggles labels via the right-click menu. */
  onToggleLabels: () => void;
}

// ── Implementation ──────────────────────────────────────────────────

const ActivityBar = forwardRef<HTMLDivElement, ActivityBarProps>(
  ({ side, topItems, bottomItems = [], trailingItem, labelsVisible, onToggleLabels }, ref) => {
    const { token } = theme.useToken();

    const contextMenuItems = useMemo<ItemType[]>(
      () => [
        {
          key: 'toggle-labels',
          label: labelsVisible ? 'Hide labels' : 'Show labels',
          onClick: onToggleLabels,
        },
      ],
      [labelsVisible, onToggleLabels],
    );

    const barStyle: React.CSSProperties = {
      background: token.colorBgLayout,
      [side === 'left' ? 'borderRight' : 'borderLeft']: `1px solid ${token.colorBorderSecondary}`,
    };

    const renderItem = (item: ActivityBarItem) => {
      const isFocused = item.active && item.focused;
      // Three-state styling:
      //   focused → primary bg + primary accent border on the side
      //   active (unfocused) → muted "selected" background
      //   inactive → no background, secondary icon color
      const itemStyle: React.CSSProperties = isFocused
        ? {
            background: token.colorPrimaryBg,
            color: token.colorPrimary,
            borderRadius: 0,
            width: '100%',
            ...(side === 'left'
              ? { borderLeft: `2px solid ${token.colorPrimary}` }
              : { borderRight: `2px solid ${token.colorPrimary}` }),
          }
        : item.active
          ? {
              background: token.colorFillTertiary,
              color: token.colorText,
              borderRadius: 0,
              width: '100%',
            }
          : { color: token.colorTextSecondary };

      const handleKey = (e: React.KeyboardEvent<HTMLDivElement>) => {
        if (!item.enabled) return;
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          item.onActivate?.();
        }
      };

      return (
        <Tooltip
          key={item.key}
          title={item.tooltip ?? (item.enabled ? item.label : undefined)}
          placement={side === 'left' ? 'right' : 'left'}
        >
          <div
            className={`rules-activity-icon ${item.enabled ? '' : 'disabled'} ${item.active ? 'active' : ''} ${isFocused ? 'focused' : ''}`}
            style={itemStyle}
            onClick={item.enabled ? item.onActivate : undefined}
            role="button"
            tabIndex={item.enabled ? 0 : -1}
            onKeyDown={handleKey}
            aria-pressed={item.active}
            aria-label={item.label}
          >
            {item.icon}
            {labelsVisible && <span className="rules-activity-label">{item.label}</span>}
          </div>
        </Tooltip>
      );
    };

    return (
      <Dropdown menu={{ items: contextMenuItems }} trigger={['contextMenu']}>
        <div
          ref={ref}
          className={`rules-activity-bar ${side === 'right' ? 'rules-activity-bar--right' : ''} ${labelsVisible ? '' : 'rules-activity-bar--compact'}`}
          style={barStyle}
          tabIndex={-1}
          data-side={side}
        >
          <div className="rules-activity-group rules-activity-group--top">{topItems.map(renderItem)}</div>

          {bottomItems.length > 0 && (
            <div className="rules-activity-group rules-activity-group--bottom">{bottomItems.map(renderItem)}</div>
          )}

          {trailingItem && <div className="rules-activity-group rules-activity-group--trailing">{renderItem(trailingItem)}</div>}
        </div>
      </Dropdown>
    );
  },
);

ActivityBar.displayName = 'ActivityBar';

export default ActivityBar;
