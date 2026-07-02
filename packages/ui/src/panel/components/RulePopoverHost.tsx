/**
 * RulePopoverHost — single shared popover for editing the rule
 * modification that produced a header row in the inspector. Built on
 * the same `createHoverPopoverHost` factory as the variable popover so
 * both popovers share lifecycle behavior (hover-grace, click-out via
 * `useDismiss`, fresh mount per session).
 */

import type { Rule } from '@openheaders/core/types';
import { createHoverPopoverHost, type HoverPopoverBodyProps } from '@openheaders/ui/shared/popover';
import type { HeaderAttribution } from '../data/header-attribution';
import type { RuleApplicability } from '../data/rule-applicability';
import { ResponseQuickEditor } from './rule-quick-editor/ResponseQuickEditor';
import { RuleHoverPopover, type RuleHoverPopoverTarget } from './RuleHoverPopover';

interface RulePopoverState {
  anchorEl: HTMLElement;
  /** Live rule for editing (may be null if the rule was deleted since
   *  the fire — popover degrades to read-only history view). */
  rule: Rule | null;
  /** For header rules — pinpoints the modification entry the row came from. */
  target?: RuleHoverPopoverTarget;
  /** Row attribution — provides the snapshot for the "what happened on
   *  this request" history block. Optional only for legacy callers that
   *  predate the snapshot architecture. */
  attribution?: HeaderAttribution;
  /** Current resolution of the live mod's value template — computed
   *  by the caller against the panel's resolver hook. Drives the
   *  popover's "Future" line for value drift. Null when the rule is
   *  gone or the mod is `remove`. */
  currentResolvedValue?: string | null;
  /** Current resolution of the live mod's headerName template. Drives
   *  the popover's name-drift surface (template unchanged, but a var
   *  referenced by the name resolves differently). */
  currentResolvedName?: string | null;
  /** Verdict on whether the live rule would still fire on the next
   *  request to this row's URL. Drives the Future row's branching
   *  for rule-disabled / conditions-mismatch / unresolvable templates. */
  applicability?: RuleApplicability | null;
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
  // Per-type dispatch inside the one shared host: response rules get
  // the compact response quick-editor; everything else stays on the
  // header popover (which degrades to a summary for other rule types).
  if (state.rule?.type === 'response') {
    return (
      <ResponseQuickEditor
        anchorEl={state.anchorEl}
        rule={state.rule}
        onClose={onClose}
        onMouseEnter={onMouseEnter}
        onMouseLeave={onMouseLeave}
        visible={visible}
      />
    );
  }
  return (
    <RuleHoverPopover
      anchorEl={state.anchorEl}
      rule={state.rule}
      target={state.target}
      attribution={state.attribution}
      currentResolvedValue={state.currentResolvedValue}
      currentResolvedName={state.currentResolvedName}
      applicability={state.applicability}
      onClose={onClose}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      visible={visible}
    />
  );
}

const host = createHoverPopoverHost<RulePopoverState>({
  identity: (s) => {
    // When the rule is gone (deleted since fire), identity falls back
    // to the snapshotted ruleUid carried in the attribution so the
    // popover still keys deterministically off the row that opened it.
    const ctx =
      s.attribution?.kind === 'added' || s.attribution?.kind === 'modified' || s.attribution?.kind === 'removed'
        ? s.attribution.ctx
        : null;
    const uid = s.rule?.uid ?? ctx?.ruleUid ?? '';
    return `${uid}|${s.target?.direction ?? ''}|${s.target?.headerName ?? ''}|${s.target?.operation ?? ''}`;
  },
  insideSelectors: POPOVER_INSIDE_SELECTORS,
  Body: RulePopoverBody,
});

export const RulePopoverProvider = host.Provider;
export const useRulePopover = host.useApi;
