/**
 * RulePopoverHost — single shared popover for editing the rule
 * modification that produced a header row in the inspector. Built on
 * the same `createHoverPopoverHost` factory as the variable popover so
 * both popovers share lifecycle behavior (hover-grace, click-out via
 * `useDismiss`, fresh mount per session).
 */

import type {
  BlockRuleDraft,
  DelayRuleDraft,
  HeaderRuleDraft,
  QueryParamRuleDraft,
  RedirectRuleDraft,
  RequestBodyRuleDraft,
  ResponseRuleDraft,
  Rule,
} from '@openheaders/core/types';
import type { HeaderDirection } from '@openheaders/core/utils';
import { createHoverPopoverHost, type HoverPopoverBodyProps } from '@openheaders/ui/shared/popover';
import type { HeaderAttribution } from '../data/header-attribution';
import type { RuleApplicability } from '../data/rule-applicability';
import { BlockQuickCreate } from './rule-quick-editor/BlockQuickCreate';
import { DelayQuickCreate } from './rule-quick-editor/DelayQuickCreate';
import { HeaderQuickCreate } from './rule-quick-editor/HeaderQuickCreate';
import { QueryParamQuickCreate } from './rule-quick-editor/QueryParamQuickCreate';
import { RedirectQuickCreate } from './rule-quick-editor/RedirectQuickCreate';
import { RequestBodyQuickCreate } from './rule-quick-editor/RequestBodyQuickCreate';
import { ResponseQuickCreate } from './rule-quick-editor/ResponseQuickCreate';
import { ResponseQuickEditor } from './rule-quick-editor/ResponseQuickEditor';
import { RuleHoverPopover, type RuleHoverPopoverTarget } from './RuleHoverPopover';

/** Create mode — no live rule yet; the popover edits a captured-response
 *  draft and Save mints + publishes the rule (`ResponseQuickCreate`). */
interface ResponseCreatePopoverState {
  mode: 'create-response';
  anchorEl: HTMLElement;
  draft: ResponseRuleDraft;
  /** Inspected request the draft was captured from — the popover's
   *  session identity (there is no rule uid to key on yet). */
  requestId: string;
}

/** Create mode for a header rule — opened from a server header row's
 *  Override button; Save mints + publishes (`HeaderQuickCreate`). */
interface HeaderCreatePopoverState {
  mode: 'create-header';
  anchorEl: HTMLElement;
  draft: HeaderRuleDraft;
  direction: HeaderDirection;
  /** Inspected request — with the direction and the clicked header's
   *  name, the popover's session identity. */
  requestId: string;
}

/** Which CTA opened a URL-action create session. The three redirect
 *  variants share a rule type but seed different targets, so the
 *  variant — not the type — is the per-request session discriminator. */
export type UrlCreateVariant = 'redirect' | 'replace-host' | 'replace-url-part' | 'delay' | 'block';

/** Create mode for the URL-action rules (redirect / delay / block) —
 *  opened from the Headers tab's CTA row; Save mints + publishes. */
interface UrlCreatePopoverState {
  mode: 'create-url';
  anchorEl: HTMLElement;
  draft: RedirectRuleDraft | DelayRuleDraft | BlockRuleDraft;
  variant: UrlCreateVariant;
  /** Inspected request — with the variant, the popover's session identity. */
  requestId: string;
}

/** Create mode for a request-body rule — opened from the Payload tab's
 *  "Override request body" CTA; Save mints + publishes. */
interface RequestBodyCreatePopoverState {
  mode: 'create-request-body';
  anchorEl: HTMLElement;
  draft: RequestBodyRuleDraft;
  /** Inspected request — the popover's session identity. */
  requestId: string;
}

/** Create mode for a query-param rule — opened from the Payload tab's
 *  "Override query params" CTA; Save mints + publishes. */
interface QueryParamCreatePopoverState {
  mode: 'create-query-param';
  anchorEl: HTMLElement;
  draft: QueryParamRuleDraft;
  /** Inspected request — the popover's session identity. */
  requestId: string;
}

interface RuleEditPopoverState {
  mode?: 'edit';
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

type RulePopoverState =
  | RuleEditPopoverState
  | ResponseCreatePopoverState
  | HeaderCreatePopoverState
  | UrlCreatePopoverState
  | RequestBodyCreatePopoverState
  | QueryParamCreatePopoverState;

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
  // Per-type dispatch inside the one shared host: create mode gets the
  // response quick-create body, fired response rules get the compact
  // response quick-editor, and everything else stays on the header
  // popover (which degrades to a summary for other rule types).
  if (state.mode === 'create-response') {
    return (
      <ResponseQuickCreate
        anchorEl={state.anchorEl}
        draft={state.draft}
        onClose={onClose}
        onMouseEnter={onMouseEnter}
        onMouseLeave={onMouseLeave}
        visible={visible}
      />
    );
  }
  if (state.mode === 'create-url') {
    const common = {
      anchorEl: state.anchorEl,
      onClose,
      onMouseEnter,
      onMouseLeave,
      visible,
    };
    if (state.draft.type === 'redirect') return <RedirectQuickCreate {...common} draft={state.draft} />;
    if (state.draft.type === 'delay') return <DelayQuickCreate {...common} draft={state.draft} />;
    return <BlockQuickCreate {...common} draft={state.draft} />;
  }
  if (state.mode === 'create-request-body') {
    return (
      <RequestBodyQuickCreate
        anchorEl={state.anchorEl}
        draft={state.draft}
        onClose={onClose}
        onMouseEnter={onMouseEnter}
        onMouseLeave={onMouseLeave}
        visible={visible}
      />
    );
  }
  if (state.mode === 'create-query-param') {
    return (
      <QueryParamQuickCreate
        anchorEl={state.anchorEl}
        draft={state.draft}
        onClose={onClose}
        onMouseEnter={onMouseEnter}
        onMouseLeave={onMouseLeave}
        visible={visible}
      />
    );
  }
  if (state.mode === 'create-header') {
    return (
      <HeaderQuickCreate
        anchorEl={state.anchorEl}
        draft={state.draft}
        direction={state.direction}
        onClose={onClose}
        onMouseEnter={onMouseEnter}
        onMouseLeave={onMouseLeave}
        visible={visible}
      />
    );
  }
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
    // Create sessions have no rule uid yet — key on the inspected
    // request the draft was captured from (plus, for headers, the
    // clicked row so each Override button is its own session).
    if (s.mode === 'create-response') return `create-response|${s.requestId}`;
    if (s.mode === 'create-url') return `create-url|${s.requestId}|${s.variant}`;
    if (s.mode === 'create-request-body') return `create-request-body|${s.requestId}`;
    if (s.mode === 'create-query-param') return `create-query-param|${s.requestId}`;
    if (s.mode === 'create-header') {
      const mods = s.direction === 'request' ? s.draft.requestHeaders : s.draft.responseHeaders;
      return `create-header|${s.requestId}|${s.direction}|${mods?.[0]?.headerName ?? ''}`;
    }
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
