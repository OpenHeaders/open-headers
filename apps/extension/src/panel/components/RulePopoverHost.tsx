/**
 * RulePopoverHost — single shared popover for editing the rule
 * modification that produced a header row in the inspector. Built on
 * the same `createHoverPopoverHost` factory as the variable popover so
 * both popovers share lifecycle behavior (hover-grace, click-out via
 * `useDismiss`, fresh mount per session).
 */

import type { V5 } from '@openheaders/core/types';
import { createHoverPopoverHost, type HoverPopoverBodyProps } from '@/shared/hover-popover-host';
import { RuleHoverPopover, type RuleHoverPopoverTarget } from './RuleHoverPopover';

interface RulePopoverState {
  anchorEl: HTMLElement;
  rule: V5.Rule;
  /** For header rules — pinpoints the modification entry the row came from. */
  target?: RuleHoverPopoverTarget;
}

const POPOVER_INSIDE_SELECTORS: ReadonlyArray<string> = [
  '[data-rule-popover-root]',
  '[data-variable-popover-root]',
  // TemplateInput's suggestion popover portals to `document.body` so
  // it floats above clipped containers — that means it's a sibling of
  // the popover root, not a descendant, and the default
  // contains-descendant outside-click check would treat clicks on it
  // as "outside". Whitelisting the class here keeps the rule popover
  // open when the user clicks a suggestion row.
  '.oh-template-popover-anchor',
  '.ant-dropdown',
  '.ant-tooltip',
  '.ant-popover',
  '.ant-select-dropdown',
  '.ant-message',
];

function RulePopoverBody({
  state,
  onClose,
  onMouseEnter,
  onMouseLeave,
  visible,
}: HoverPopoverBodyProps<RulePopoverState>) {
  return (
    <RuleHoverPopover
      anchorEl={state.anchorEl}
      rule={state.rule}
      target={state.target}
      onClose={onClose}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      visible={visible}
    />
  );
}

const host = createHoverPopoverHost<RulePopoverState>({
  identity: (s) =>
    `${s.rule.uid}|${s.target?.direction ?? ''}|${s.target?.headerName ?? ''}|${s.target?.operation ?? ''}`,
  insideSelectors: POPOVER_INSIDE_SELECTORS,
  Body: RulePopoverBody,
});

export const RulePopoverProvider = host.Provider;
export const useRulePopover = host.useApi;
