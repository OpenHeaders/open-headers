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
}

export function InfoPopover({ content, children, placement = 'bottomLeft', maxWidth = 360 }: InfoPopoverProps) {
  const [open, setOpen] = useState(false);
  const resolveContainer = useInfoPopoverContainer();
  // Adapter: AntD's `getPopupContainer` receives the trigger element
  // and must return a parent DOM node. When no provider is installed
  // we leave the prop undefined so AntD's default (document.body)
  // kicks in unchanged.
  const getPopupContainer = useCallback(
    (triggerNode: HTMLElement) => resolveContainer?.(triggerNode) ?? document.body,
    [resolveContainer],
  );
  return (
    <Popover
      open={open}
      onOpenChange={setOpen}
      trigger="click"
      destroyOnHidden
      placement={placement}
      overlayClassName="oh-info-popover-overlay"
      overlayStyle={{ maxWidth }}
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
        {content.kicker && <div className="oh-info-popover-kicker">{content.kicker}</div>}
        <div className="oh-info-popover-title">{content.title}</div>
      </div>
      <div className="oh-info-popover-scroll">
        {content.diagram && <div className="oh-info-popover-diagram">{content.diagram}</div>}
        <div className="oh-info-popover-summary">{content.summary}</div>
        {content.description && <div className="oh-info-popover-description">{content.description}</div>}
        {content.sections?.map((section) => (
          <div className="oh-info-popover-section" key={section.heading}>
            <div className="oh-info-popover-section-heading">{section.heading}</div>
            {section.items.map((item) => (
              <div className="oh-info-popover-section-item" key={item.label}>
                <code className="oh-info-popover-section-item-label">{item.label}</code>
                <span className="oh-info-popover-section-item-desc">{item.desc}</span>
              </div>
            ))}
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
