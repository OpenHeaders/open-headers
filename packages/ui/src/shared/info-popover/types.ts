/**
 * Content model for `<InfoPopover>` — a generic anchored popover used
 * throughout the app to explain things in place (HTTP headers, rule
 * operators, condition fields, …) without bouncing the user to a
 * separate docs surface.
 *
 * Every section is optional except `title` and `summary`. The renderer
 * lays them out top-to-bottom in this fixed order so popovers stay
 * visually consistent across the app:
 *
 *   kicker → title → diagram → summary → description → sections → actions
 *
 * Keep individual popovers small. If you find yourself reaching for
 * three sections + a diagram + multiple paragraphs of description,
 * the topic probably belongs in the docs panel, not a popover.
 */

import type React from 'react';

export interface InfoPopoverSection {
  /** Short heading rendered as a small all-caps label above the items. */
  heading: string;
  /**
   * Row layout. `inline` (default) puts the description beside the
   * label — right for short glossary rows. `stacked` puts it on its own
   * line under the icon + label — right when labels are long enough
   * that side-by-side wrapping turns ragged.
   */
  layout?: 'inline' | 'stacked';
  /** Structured rows — `label` renders as `<code>`, `desc` as plain text.
   *  `labelClassName` is an optional extra class on the label (e.g. to
   *  tint it the same colour the value carries in its own column);
   *  `icon` renders as a small glyph before the label (e.g. a scope
   *  badge). */
  items: ReadonlyArray<{
    label: string;
    desc: React.ReactNode;
    labelClassName?: string;
    /** Inline tint for the label chip when the color comes from a JS
     *  map (e.g. METHOD_COLORS) rather than a CSS class. */
    labelStyle?: React.CSSProperties;
    icon?: React.ReactNode;
    /** Explicit React key for lists whose labels can collide across
     *  rows (the default key is the label). */
    key?: string;
    /** Per-row action, rendered as a small hover-revealed ✕ button at
     *  the row's end (e.g. removing the row's entry). `label` is the
     *  accessible name. */
    action?: { label: string; onClick: () => void };
  }>;
}

export interface InfoPopoverAction {
  label: string;
  /** Runs on click; the popover dismisses itself first, so the action
   *  can open a modal or navigate without the popover lingering. */
  onClick: () => void;
  /** First primary action gets the accent button styling. At most one
   *  primary action per popover; subsequent ones render as secondary. */
  primary?: boolean;
}

export interface InfoPopoverContent {
  /** Required. Bold heading line. */
  title: string;
  /** Optional uppercase mini-line above the title (e.g. category tag). */
  kicker?: string;
  /** Optional link pinned to the header's top-right corner (the header
   *  never scrolls, so it stays visible over long bodies). Used for
   *  "More information" jumps into the full docs surface. */
  headerLink?: InfoPopoverAction;
  /** Required. One-sentence orientation, body-weight, above any longer
   *  description. A node so inline `{{token}}` references can render
   *  as code chips instead of plain text. */
  summary: React.ReactNode;
  /** Optional rich body — paragraphs, lists, anything. Goes below
   *  summary. Use sparingly. */
  description?: React.ReactNode;
  /** Optional structured sub-blocks. Up to ~3 sections — beyond that
   *  the popover stops feeling like a glance and starts feeling like
   *  a page. */
  sections?: ReadonlyArray<InfoPopoverSection>;
  /** Optional small inline diagram (~64-80px tall). Goes between
   *  title and summary. */
  diagram?: React.ReactNode;
  /** Optional footer CTAs. Max 2. */
  actions?: ReadonlyArray<InfoPopoverAction>;
}
