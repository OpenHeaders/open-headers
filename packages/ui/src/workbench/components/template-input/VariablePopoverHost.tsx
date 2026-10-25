/**
 * VariablePopoverHost — single popover instance shared across every
 * `TemplateInput` on the page.
 *
 * Uses the generic `createHoverPopoverHost` factory so the host's
 * lifecycle (hover-grace, click-out via `useDismiss`, fresh mount per
 * session) is shared with the rule popover host instead of being
 * duplicated. This file specializes only the state shape, the
 * identity key, and the popover body.
 *
 * Workbench, popup, and devpanel apps each wrap their tree in
 * `<VariablePopoverProvider>` so any `TemplateInput` they render gets
 * the shared host. A TemplateInput rendered outside a provider
 * gracefully degrades — `useVariablePopover()` returns a noop, no
 * popover appears, but typing still works.
 */

import { createHoverPopoverHost, type HoverPopoverBodyProps } from '@openheaders/ui/shared/popover';
import PathParamHoverPopover from './PathParamHoverPopover';
import VariableHoverPopover from './VariableHoverPopover';

/** A `{{reference}}` token's session — the default kind. */
interface ReferencePopoverState {
  kind?: 'reference';
  anchorEl: HTMLElement;
  reference: string;
  collectionId?: string;
  /** Focus the value input on open — set by deliberate opens (the create
   *  flow), omitted for hover opens. */
  autoFocus?: boolean;
}

/** A `:name` path token's session (the HTTP URL bar): the row's value
 *  and the bar's writer. The two kinds share the one host so a hover on
 *  either token closes the other's popover. */
interface PathParamPopoverState {
  kind: 'path-param';
  anchorEl: HTMLElement;
  name: string;
  value: string;
  onSave: (name: string, value: string) => void;
  collectionId?: string;
}

export type VariablePopoverState = ReferencePopoverState | PathParamPopoverState;

const POPOVER_INSIDE_SELECTORS: ReadonlyArray<string> = [
  '[data-variable-popover-root]',
  // TemplateInput's suggestion popover portals to `document.body`,
  // so its clicks would otherwise count as "outside" the variable
  // popover root and close it on suggestion-row click.
  '.oh-template-popover-anchor',
  '.ant-dropdown',
  '.ant-tooltip',
  '.ant-popover',
  '.ant-select-dropdown',
  '.ant-message',
];

function VariablePopoverBody({
  state,
  onClose,
  onMouseEnter,
  onMouseLeave,
  visible,
}: HoverPopoverBodyProps<VariablePopoverState>) {
  if (state.kind === 'path-param') {
    return (
      <PathParamHoverPopover
        anchorEl={state.anchorEl}
        name={state.name}
        value={state.value}
        onSave={state.onSave}
        collectionId={state.collectionId}
        onClose={onClose}
        onMouseEnter={onMouseEnter}
        onMouseLeave={onMouseLeave}
        visible={visible}
      />
    );
  }
  return (
    <VariableHoverPopover
      anchorEl={state.anchorEl}
      reference={state.reference}
      collectionId={state.collectionId}
      autoFocus={state.autoFocus}
      onClose={onClose}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      visible={visible}
    />
  );
}

const host = createHoverPopoverHost<VariablePopoverState>({
  identity: (s) =>
    s.kind === 'path-param' ? `path-param:${s.name}` : `${s.reference}|${s.collectionId ?? ''}`,
  insideSelectors: POPOVER_INSIDE_SELECTORS,
  Body: VariablePopoverBody,
});

export const VariablePopoverProvider = host.Provider;
export const useVariablePopover = host.useApi;
