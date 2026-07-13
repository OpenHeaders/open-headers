/**
 * InfoPopover — generic anchored popover for in-place explanations.
 *
 * Renders an Ant Design `<Popover>` around a child trigger; the
 * popover body lays out the fixed `InfoPopoverContent` model so every
 * info-popover in the app looks the same:
 *
 *   kicker → title → diagram → summary → description → sections → actions
 *
 * Use the convenience `<InfoTrigger content={...} />` for the standard
 * (i)-glyph trigger. Use `<InfoPopover>` directly when the trigger
 * isn't an (i) (e.g. a label, a chip, a row).
 */

import { Popover } from 'antd';
import type React from 'react';
import { useCallback, useState } from 'react';
import { useInfoPopoverContainer } from './InfoPopoverContainerContext';
import type { InfoPopoverContent } from './types';
import './info-popover.css';

export interface InfoPopoverProps {
  content: InfoPopoverContent;
  /** Element the popover anchors to — usually a button or span. */
  children: React.ReactElement;
  /** Popover placement, defaults to `bottomLeft`. */
  placement?: React.ComponentProps<typeof Popover>['placement'];
  /** Maximum width in px, defaults to 360. */
  maxWidth?: number;
  /** Open on `click` (the (i) default) or on `hover` — for triggers whose
   *  click has its own action (e.g. the row-annotation glyph, where click
   *  jumps to the detail pane). */
  trigger?: 'click' | 'hover';
}

export function InfoPopover({
  content,
  children,
  placement = 'bottomLeft',
  maxWidth = 360,
  trigger = 'click',
}: InfoPopoverProps) {
  const [open, setOpen] = useState(false);
  const resolveContainer = useInfoPopoverContainer();
  // Adapter: AntD's `getPopupContainer` receives the trigger element and must
  // return a parent DOM node. When no provider is installed we leave the prop
  // undefined so AntD's default (document.body) kicks in unchanged.
  const getPopupContainer = useCallback(
    (triggerNode: HTMLElement) => resolveContainer?.(triggerNode) ?? document.body,
    [resolveContainer],
  );
  // Auto-adjust (flip + shift) is left on: an info trigger can sit anywhere in
  // the content, so the popover must be free to open upward when its trigger is
  // low. The CSS height cap keeps it scrolling internally, and the always-on-top
  // footer covers any bottom graze (see `.dt-panel-root > .rules-statusbar`).
  return (
    <Popover
      open={open}
      onOpenChange={setOpen}
      trigger={trigger}
      destroyOnHidden
      placement={placement}
      classNames={{ root: 'oh-info-popover-overlay' }}
      styles={{ root: { maxWidth } }}
      {...(resolveContainer ? { getPopupContainer } : {})}
      content={<InfoPopoverBody content={content} />}
    >
      {children}
    </Popover>
  );
}

function InfoPopoverBody({ content }: { content: InfoPopoverContent }) {
  return (
    // Outer is a flex column with a bounded max-height — the title and
    // actions stay pinned, and the middle scrolls. Critical for the
    // DevTools panel where the host frame can be ~200px tall and a
    // freely-sizing popover would overflow off-screen.
    <div className="oh-info-popover">
      <div className="oh-info-popover-header">
        <div className="oh-info-popover-header-text">
          {content.kicker && <div className="oh-info-popover-kicker">{content.kicker}</div>}
          <div className="oh-info-popover-title">{content.title}</div>
        </div>
        {content.headerLink && (
          <button type="button" className="oh-info-popover-header-link" onClick={content.headerLink.onClick}>
            {content.headerLink.label}
          </button>
        )}
      </div>
      <div className="oh-info-popover-scroll">
        {content.diagram && <div className="oh-info-popover-diagram">{content.diagram}</div>}
        <div className="oh-info-popover-summary">{content.summary}</div>
        {content.description && <div className="oh-info-popover-description">{content.description}</div>}
        {content.sections?.map((section) => (
          <div className="oh-info-popover-section" key={section.heading}>
            <div className="oh-info-popover-section-heading">{section.heading}</div>
            {section.items.map((item) => {
              const label = (
                <code
                  className={`oh-info-popover-section-item-label${item.labelClassName ? ` ${item.labelClassName}` : ''}`}
                  style={item.labelStyle}
                >
                  {item.label}
                </code>
              );
              const icon = item.icon && <span className="oh-info-popover-section-item-icon">{item.icon}</span>;
              const action = item.action && (
                <button
                  type="button"
                  className="oh-info-popover-section-item-action"
                  aria-label={item.action.label}
                  title={item.action.label}
                  onClick={item.action.onClick}
                >
                  ✕
                </button>
              );
              const key = item.key ?? item.label;
              if (section.layout === 'stacked') {
                return (
                  <div className="oh-info-popover-section-item oh-info-popover-section-item--stacked" key={key}>
                    <div className="oh-info-popover-section-item-head">
                      {icon}
                      {label}
                      {action}
                    </div>
                    <span className="oh-info-popover-section-item-desc">{item.desc}</span>
                  </div>
                );
              }
              return (
                <div className="oh-info-popover-section-item" key={key}>
                  {icon}
                  {label}
                  <span className="oh-info-popover-section-item-desc">{item.desc}</span>
                  {action}
                </div>
              );
            })}
          </div>
        ))}
      </div>
      {content.actions && content.actions.length > 0 && (
        <div className="oh-info-popover-actions">
          {content.actions.map((action) => (
            <button
              key={action.label}
              type="button"
              className={`oh-info-popover-action${action.primary ? ' oh-info-popover-action--primary' : ''}`}
              onClick={action.onClick}
            >
              {action.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
