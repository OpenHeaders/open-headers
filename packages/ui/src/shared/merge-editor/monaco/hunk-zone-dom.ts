/**
 * DOM builders + frame class tables shared by the hunk zone hooks
 * (`use-hunk-action-zones`, `use-result-status-zones`,
 * `use-hunk-alignment-placeholders`). Palette decisions live in
 * `view/hunk-visual.ts`; this module renders them into plain DOM for
 * Monaco view zones.
 */

import type { HunkAnalysis } from '../diff/hunk-analysis';
import type { PickStateController } from '../use-hunk-pick-state';
import { type FrameVariant, type HunkSide, kindLabelFor, type MissingVariant } from '../view/hunk-visual';
import './hunk-action-zones.css';

// ── Frame class tables ─────────────────────────────────────────────
//
// One mapping per (FrameVariant) → (per-line CSS class, last-line CSS
// class). The hooks pick from these when emitting the per-line frame
// decorations that close the bottom + side edges of the bordered
// rectangle around a hunk.

export const FRAME_CLASS: Record<FrameVariant, string> = {
  'pending-conflict': 'oh-merge__action-zone-frame',
  'pending-clean': 'oh-merge__action-zone-frame-clean',
  resolved: 'oh-merge__action-zone-frame-resolved',
};
export const FRAME_CLASS_LAST: Record<FrameVariant, string> = {
  'pending-conflict': 'oh-merge__action-zone-frame-last',
  'pending-clean': 'oh-merge__action-zone-frame-clean-last',
  resolved: 'oh-merge__action-zone-frame-resolved-last',
};

/** Top-strip CSS modifier matching a frame variant. The base class is
 *  the orange action zone; clean swaps to blue, resolved to grey. */
function actionZoneVariantClass(variant: FrameVariant): string {
  switch (variant) {
    case 'pending-conflict':
      return '';
    case 'pending-clean':
      return ' oh-merge__action-zone-clean';
    case 'resolved':
      return ' oh-merge__action-zone-resolved';
  }
}

// ── Source-pane action zones ───────────────────────────────────────

const LABEL_THEIRS = { accept: 'Accept Incoming', combine: 'Accept Combination', ignore: 'Ignore' };
const LABEL_MINE = { accept: 'Accept Current', combine: 'Accept Combination', ignore: 'Ignore' };

function makeSeparator(): HTMLElement {
  const sep = document.createElement('span');
  sep.className = 'oh-merge__action-zone-sep';
  sep.textContent = ' | ';
  sep.setAttribute('aria-hidden', 'true');
  return sep;
}

export function buildActionZoneDom(args: {
  side: HunkSide;
  analysis: HunkAnalysis;
  controller: PickStateController;
  combineMeaningful: boolean;
  variant: FrameVariant;
}): HTMLElement {
  const labels = args.side === 'theirs' ? LABEL_THEIRS : LABEL_MINE;
  const wrapper = document.createElement('div');
  wrapper.className = 'oh-merge__action-zone-wrapper';
  const root = document.createElement('div');
  root.className = `oh-merge__action-zone${actionZoneVariantClass(args.variant)}`;
  root.setAttribute('data-side', args.side);
  root.setAttribute('data-hunk-id', args.analysis.id);
  wrapper.appendChild(root);

  const slot: 'left' | 'right' = args.side === 'theirs' ? 'left' : 'right';

  // Monaco intercepts mousedown on its DOM root to manage caret +
  // selection. Stopping propagation here keeps clicks inside the
  // view zone reaching the actual button handlers.
  const eatMouseDown = (e: Event) => e.stopPropagation();

  const makeBtn = (label: string, extraClass: string, onClick: () => void): HTMLButtonElement => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = `oh-merge__action-zone-btn ${extraClass}`.trim();
    btn.textContent = label;
    btn.addEventListener('mousedown', eatMouseDown);
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      onClick();
    });
    return btn;
  };

  const acceptBtn = makeBtn(labels.accept, '', () =>
    args.controller.dispatch({ hunkId: args.analysis.id, slot, action: 'arrow' }),
  );
  const combineBtn = makeBtn(labels.combine, '', () =>
    args.controller.bulkSet([{ hunkId: args.analysis.id, next: { theirs: 'accepted', mine: 'accepted' } }]),
  );
  combineBtn.title = 'Stack both sides — incoming first, then current';
  const ignoreBtn = makeBtn(labels.ignore, 'oh-merge__action-zone-btn-ignore', () =>
    args.controller.dispatch({ hunkId: args.analysis.id, slot, action: 'x' }),
  );

  root.addEventListener('mousedown', eatMouseDown);
  root.appendChild(acceptBtn);
  if (args.combineMeaningful) {
    root.appendChild(makeSeparator());
    root.appendChild(combineBtn);
  }
  root.appendChild(makeSeparator());
  root.appendChild(ignoreBtn);

  // Right-aligned type label (Added / Deleted / Modified / No change).
  // Single design vocabulary across every header so the user reads
  // the same word for the same concept regardless of pane or state.
  const kind = args.side === 'theirs' ? args.analysis.theirs.kind : args.analysis.mine.kind;
  const kindLabel = document.createElement('span');
  kindLabel.className = 'oh-merge__action-zone-kind';
  kindLabel.textContent = kindLabelFor(kind);
  root.appendChild(kindLabel);
  return wrapper;
}

export function buildResultStatusDom(args: {
  hunkId: string;
  label: string;
  removable: ReadonlyArray<{ slot: 'left' | 'right'; label: string }>;
  controller: PickStateController;
  variant: FrameVariant;
}): HTMLElement {
  const wrapper = document.createElement('div');
  wrapper.className = 'oh-merge__action-zone-wrapper';
  const root = document.createElement('div');
  root.className = `oh-merge__action-zone${actionZoneVariantClass(args.variant)} oh-merge__action-zone-status`;
  wrapper.appendChild(root);

  const eatMouseDown = (e: Event) => e.stopPropagation();
  root.addEventListener('mousedown', eatMouseDown);

  const labelSpan = document.createElement('span');
  labelSpan.className = 'oh-merge__action-zone-status-label';
  labelSpan.textContent = args.label;
  root.appendChild(labelSpan);

  for (const remove of args.removable) {
    const sep = document.createElement('span');
    sep.className = 'oh-merge__action-zone-sep';
    sep.textContent = ' | ';
    sep.setAttribute('aria-hidden', 'true');
    root.appendChild(sep);

    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'oh-merge__action-zone-btn oh-merge__action-zone-btn-remove';
    btn.textContent = remove.label;
    btn.title = `Revert ${remove.label.replace(/^Remove\s+/, '').toLowerCase()} to pending so you can re-decide`;
    btn.addEventListener('mousedown', eatMouseDown);
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      args.controller.revert(args.hunkId, remove.slot);
    });
    root.appendChild(btn);
  }
  return wrapper;
}

// ── Hashed alignment placeholders ──────────────────────────────────

type PlaceholderKind = 'action-slot' | 'stacked-content' | 'missing-side';

export interface BuildPlaceholderArgs {
  kind: PlaceholderKind;
  variant?: MissingVariant;
  /** Adds the diagonal hash pattern to a `missing-side` placeholder.
   *  Reserved for the RESULT pane — there the rectangle represents
   *  "content will arrive here from one of the sources." Source-pane
   *  placeholders stay flat: this side simply doesn't have content. */
  hashed?: boolean;
  /** Right-aligned kind label inside an action-slot placeholder
   *  (decided side). Mirrors the action zone's kind label so the
   *  per-side header pattern stays uniform across pending and
   *  decided states. */
  kindLabel?: string;
}

export function buildPlaceholderDom(args: BuildPlaceholderArgs): HTMLElement {
  const { kind, variant = 'neutral', hashed = false, kindLabel } = args;
  const wrapper = document.createElement('div');
  wrapper.className = 'oh-merge__action-zone-wrapper';
  const root = document.createElement('div');
  const classes = ['oh-merge__alignment-placeholder', `oh-merge__alignment-placeholder-${kind}`];
  // Red `-removal` modifier applies only to the action-slot header +
  // missing-side body (the two parts of the bordered missing-side
  // rectangle). Stacked-content is alignment padding and stays neutral.
  if (variant === 'removal' && (kind === 'missing-side' || kind === 'action-slot')) {
    classes.push(`oh-merge__alignment-placeholder-${kind}-removal`);
  }
  if (hashed && kind === 'missing-side') {
    classes.push('oh-merge__alignment-placeholder-missing-side-hashed');
  }
  root.className = classes.join(' ');
  if (kindLabel && kind === 'action-slot') {
    const labelSpan = document.createElement('span');
    labelSpan.className = 'oh-merge__action-zone-kind';
    labelSpan.textContent = kindLabel;
    root.appendChild(labelSpan);
  }
  wrapper.appendChild(root);
  return wrapper;
}
