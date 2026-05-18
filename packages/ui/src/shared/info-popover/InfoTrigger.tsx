/**
 * InfoTrigger — convenience `(i)` glyph that opens an `<InfoPopover>`
 * anchored to itself. The standard in-app affordance for "tell me
 * about this thing without opening the docs panel".
 *
 * Stops click propagation by default so it can sit inside row buttons
 * (e.g. the Headers tab's header-name button) without firing them.
 */

import type React from 'react';
import { InfoPopover } from './InfoPopover';
import type { InfoPopoverContent } from './types';

export interface InfoTriggerProps {
  content: InfoPopoverContent;
  /** Extra class on the trigger button for surface-specific styling
   *  (e.g. hover-reveal on a row). */
  className?: string;
  /** Accessible label override — defaults to `About <title>`. */
  ariaLabel?: string;
  /** Popover placement, defaults to `bottomLeft`. */
  placement?: React.ComponentProps<typeof InfoPopover>['placement'];
}

export function InfoTrigger({ content, className, ariaLabel, placement }: InfoTriggerProps) {
  return (
    <InfoPopover content={content} placement={placement}>
      <button
        type="button"
        className={`oh-info-trigger${className ? ` ${className}` : ''}`}
        aria-label={ariaLabel ?? `About ${content.title}`}
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
        }}
      >
        i
      </button>
    </InfoPopover>
  );
}
