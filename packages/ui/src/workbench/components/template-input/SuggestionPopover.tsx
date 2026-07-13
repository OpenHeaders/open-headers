/**
 * SuggestionPopover — our own dropdown list for TemplateInput, built
 * directly on AntD primitives (theme tokens + Typography) without
 * wrapping `Mentions` or `Dropdown`. Full ownership means:
 *
 *   - Arrow-nav + Enter/Tab/Escape handled by the caller via props,
 *     so keyboard behaviour is deterministic (no gating on `keyup` /
 *     `keydown` key name as in rc-mentions).
 *   - Footer is a real component inside the popover's DOM, not a
 *     disabled "option" hacked into the end of the list.
 *   - Reveal-on-hover + focus-follows-mouse can be done here without
 *     fighting a library's internal active-index state machine.
 *
 * Positioning is the caller's job — the popover is a plain
 * absolutely-positioned `<div>` that the caller pins below (or
 * anywhere near) the textarea via its own layout wrapper.
 */

import { PlusOutlined } from '@ant-design/icons';
import type { VariableSuggestion } from '@openheaders/core/variables';
import { useT } from '@openheaders/ui/context/LocaleContext';
import { Typography, theme } from 'antd';
import type React from 'react';
import { useCallback, useEffect, useRef } from 'react';
import SuggestionRow from './SuggestionRow';

const { Text } = Typography;

export interface SuggestionPopoverProps {
  suggestions: ReadonlyArray<VariableSuggestion>;
  activeIndex: number;
  /** Caps the scroll list to the room on the popover's chosen side (set by
   *  the caller's placement). Overrides the CSS default so the list shrinks +
   *  scrolls instead of overflowing the viewport. */
  maxListHeight?: number;
  /** Notify parent when the user hovers an option — sets active index. */
  onActiveIndexChange: (index: number) => void;
  /** Notify parent when the user clicks an option. */
  onSelect: (suggestion: VariableSuggestion) => void;
  /** Shown UNDER the "No matches" empty state when the typed reference
   *  names a creatable variable that doesn't exist yet — picking it
   *  opens the inline create flow. The empty state stays visible so the
   *  user sees WHY a create is being offered. Enter is routed here by
   *  the owning input. */
  createAction?: { label: React.ReactNode; onSelect: () => void };
}

const SuggestionPopover: React.FC<SuggestionPopoverProps> = ({
  suggestions,
  activeIndex,
  maxListHeight,
  onActiveIndexChange,
  onSelect,
  createAction,
}) => {
  const { token } = theme.useToken();
  const t = useT();
  const listRef = useRef<HTMLDivElement | null>(null);
  const rowRefs = useRef<Array<HTMLDivElement | null>>([]);
  // Index of the last hover-set active row. Hover selection must not
  // auto-scroll (the row is already under the pointer); only keyboard
  // nav scrolls the list.
  const hoverIndexRef = useRef(-1);

  // Keep activeIndex's row in view when arrow-nav pushes past the
  // viewport edge. Runs after render so layout is settled.
  useEffect(() => {
    if (activeIndex === hoverIndexRef.current) return;
    hoverIndexRef.current = -1;
    const list = listRef.current;
    const row = rowRefs.current[activeIndex];
    if (!list || !row) return;
    const rowTop = row.offsetTop;
    const rowBottom = rowTop + row.offsetHeight;
    const viewTop = list.scrollTop;
    const viewBottom = viewTop + list.clientHeight;
    if (rowTop < viewTop) list.scrollTop = rowTop;
    else if (rowBottom > viewBottom) list.scrollTop = rowBottom - list.clientHeight;
  }, [activeIndex]);

  const handleClick = useCallback(
    (suggestion: VariableSuggestion, index: number) => {
      if (suggestion.disabled) return;
      onActiveIndexChange(index);
      onSelect(suggestion);
    },
    [onActiveIndexChange, onSelect],
  );

  return (
    <div
      className="oh-template-popover-panel"
      role="listbox"
      style={{
        background: token.colorBgElevated,
        border: `1px solid ${token.colorBorderSecondary}`,
        borderRadius: token.borderRadiusLG,
        boxShadow: token.boxShadowSecondary,
      }}
    >
      <div
        ref={listRef}
        className="oh-template-popover-list"
        style={maxListHeight != null ? { maxHeight: maxListHeight } : undefined}
      >
        {suggestions.length === 0 ? (
          <>
            <div className="oh-template-popover-empty">
              <Text type="secondary" style={{ fontSize: 12 }}>
                {t('shared.templateInput.noMatches')}
              </Text>
            </div>
            {createAction && (
              // biome-ignore lint/a11y/useFocusableInteractive: ARIA listbox pattern — focus stays on the textarea (combobox); the row is the active descendant.
              // biome-ignore lint/a11y/useKeyWithClickEvents: Enter is handled by the owning textarea's onKeyDown in TemplateInput, not on the row.
              <div
                role="option"
                aria-selected
                className="oh-template-popover-row oh-template-popover-row-active oh-template-popover-create"
                style={{ background: token.colorFillSecondary }}
                onMouseDown={(e) => e.preventDefault()}
                onClick={createAction.onSelect}
              >
                <Text style={{ fontSize: 13 }}>
                  <PlusOutlined style={{ marginRight: 8, color: token.colorPrimary }} />
                  {createAction.label}
                </Text>
              </div>
            )}
          </>
        ) : (
          suggestions.map((s, i) => {
            const isActive = i === activeIndex;
            return (
              // biome-ignore lint/a11y/useFocusableInteractive: ARIA listbox pattern — focus lives on the textarea (combobox), rows are navigated via aria-activedescendant (activeIndex state). tabIndex on rows would break the intended focus model.
              // biome-ignore lint/a11y/useKeyWithClickEvents: same — keyboard handling lives on the owning textarea's onKeyDown in TemplateInput, not on individual rows. The combobox pattern explicitly delegates row nav to the input.
              <div
                ref={(el) => {
                  rowRefs.current[i] = el;
                }}
                key={s.reference}
                role="option"
                aria-selected={isActive}
                className={`oh-template-popover-row${isActive ? ' oh-template-popover-row-active' : ''}${
                  s.disabled ? ' oh-template-popover-row-disabled' : ''
                }`}
                style={{
                  background: isActive ? token.colorFillSecondary : 'transparent',
                }}
                onMouseMove={() => {
                  // mousemove, not mouseenter: keyboard scrolling shifts
                  // rows under a stationary pointer, and the browser fires
                  // enter/leave for that — hover would keep yanking the
                  // active index back to the pointer's row. mousemove only
                  // fires on real pointer motion.
                  if (i === activeIndex) return;
                  hoverIndexRef.current = i;
                  onActiveIndexChange(i);
                }}
                onMouseDown={(e) => {
                  // Prevent the textarea from blurring before click
                  // registers — without this, the popover closes on
                  // mouseDown (blur → setOpen(false)) and the click
                  // never fires on the row.
                  e.preventDefault();
                }}
                onClick={() => handleClick(s, i)}
              >
                <SuggestionRow suggestion={s} reveal={isActive} />
              </div>
            );
          })
        )}
      </div>
      <div
        className="oh-template-popover-footer"
        style={{
          borderTop: `1px solid ${token.colorBorderSecondary}`,
          color: token.colorTextTertiary,
          background: token.colorFillQuaternary,
        }}
      >
        <span>{t('shared.templateInput.footerNavigate')}</span>
        <span>{t('shared.templateInput.footerSelect')}</span>
        <span>{t('shared.templateInput.footerClose')}</span>
      </div>
    </div>
  );
};

export default SuggestionPopover;
