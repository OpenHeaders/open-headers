import { Popover } from 'antd';
import type { ReactNode } from 'react';
import { usePopoverViewportFit } from './use-popover-viewport-fit';

/**
 * Shared toolbar-style click-dropdown menu used across the Network panel —
 * the `More filters ▾` / `View ▾` / `Sort ▾` triggers in the toolbar, footer,
 * and detail tabs. Renders the standard caret button (with an optional active
 * accent + count badge) and an anchored `.dt-morefilters-menu` popover.
 *
 * The viewport-fit hook is baked in, so the menu stays anchored to its button
 * and shrinks + scrolls internally as the panel shortens — at any vertical
 * position, not just the top toolbar. `autoAdjustOverflow={false}` keeps the
 * menu pinned to the trigger (no flip/slide); the measured max-height handles
 * the overflow instead.
 */
export function ToolbarMenuPopover({
  label,
  activeCount,
  active = activeCount > 0,
  title,
  placement = 'bottomRight',
  rootClassName,
  menuClassName,
  children,
}: {
  /** Trigger text, e.g. `More filters` / `View` / `Sort`. */
  label: string;
  /** Count shown in the inline badge; the badge hides at 0. */
  activeCount: number;
  /** Whether the trigger picks up the accent colour. Defaults to
   *  `activeCount > 0`; pass `false` to badge a count without accenting. */
  active?: boolean;
  /** Native button tooltip. */
  title?: string;
  placement?: 'bottomRight' | 'bottomLeft';
  /** Extra overlay class appended to `dt-morefilters-popover`. */
  rootClassName?: string;
  /** Extra menu class appended to `dt-morefilters-menu` (e.g. `dt-network-view-menu`). */
  menuClassName?: string;
  /** Menu rows. */
  children: ReactNode;
}) {
  const { triggerRef, onOpenChange, maxHeight } = usePopoverViewportFit<HTMLButtonElement>();
  const rootClass = rootClassName ? `dt-morefilters-popover ${rootClassName}` : 'dt-morefilters-popover';
  const menuClass = menuClassName ? `dt-morefilters-menu ${menuClassName}` : 'dt-morefilters-menu';
  return (
    <Popover
      content={
        <div className={menuClass} style={maxHeight != null ? { maxHeight } : undefined}>
          {children}
        </div>
      }
      trigger="click"
      placement={placement}
      autoAdjustOverflow={false}
      arrow={false}
      classNames={{ root: rootClass }}
      onOpenChange={onOpenChange}
    >
      <button
        ref={triggerRef}
        type="button"
        className={`dt-toolbar-dropdown${active ? ' dt-toolbar-dropdown--active' : ''}`}
        title={title}
      >
        {label}
        {activeCount > 0 && <span className="dt-toolbar-dropdown-count">{activeCount}</span>}
        <span className="dt-toolbar-dropdown-caret" aria-hidden="true">
          ▾
        </span>
      </button>
    </Popover>
  );
}
