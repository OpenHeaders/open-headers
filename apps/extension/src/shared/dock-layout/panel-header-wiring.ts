/**
 * `PanelHeaderWiring` — branded type produced exclusively by
 * `createPanelHeaderWiring(...)`.
 *
 * The brand makes "called PanelHeader without going through the
 * factory" a TypeScript error: a literal `{ onHide: () => ... }`
 * doesn't carry the `__shellPanelBrand` field, so the compiler rejects
 * it at the `<PanelHeader wiring=...>` call site. Combined with the
 * AST lint test (`tests/unit/dock-layout/dock-layout-lint.test.ts`),
 * this closes BC-D2 (literal-bypass) by construction and BC-D5
 * (`as PanelHeaderWiring` cast escape) by lint.
 *
 * The factory itself is intentionally minimal: it stamps the brand
 * onto an `{ onHide }` payload and nothing else. We do NOT bundle a
 * `usePanel(id, slot)` hook here — open question #3 in the v2 design
 * doc stays deferred. Hosts wire `onHide` themselves; the factory's
 * job is to make the wiring type un-fakeable.
 */

declare const SHELL_PANEL_BRAND: unique symbol;

export interface PanelHeaderWiring {
  readonly [SHELL_PANEL_BRAND]: never;
  onHide: () => void;
}

export interface CreatePanelHeaderWiringInput {
  /** Hide handler — typically `() => tl.toggleWindow(id)`. The host
   *  picks the `id`; the factory does not enforce it. */
  onHide: () => void;
}

/**
 * Factory — the only legitimate producer of `PanelHeaderWiring`. The
 * `as unknown as` cast is the brand's single intentional escape hatch;
 * the AST lint forbids the same cast pattern outside this file.
 */
export function createPanelHeaderWiring(input: CreatePanelHeaderWiringInput): PanelHeaderWiring {
  return { onHide: input.onHide } as unknown as PanelHeaderWiring;
}
