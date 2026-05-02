/**
 * Surface-kind presentation primitives.
 *
 * Surfaces report their `surfaceKind` (`workbench` / `popup` /
 * `devpanel` / `sidepanel`) and a free-form `label` that already
 * embeds entity context (e.g. "Workbench — Rule X"). The label is
 * authored at the source — UI consumers display it verbatim.
 *
 * Color and one-letter initial fall out of the kind so badges stay
 * visually consistent across surfaces without each surface having to
 * agree on a palette.
 */

import type { SurfaceKind } from '@openheaders/core/protocol';

const KIND_COLORS: Record<SurfaceKind, string> = {
  workbench: '#1677ff',
  popup: '#52c41a',
  devpanel: '#722ed1',
  sidepanel: '#fa8c16',
};

const KIND_INITIALS: Record<SurfaceKind, string> = {
  workbench: 'W',
  popup: 'P',
  devpanel: 'D',
  sidepanel: 'S',
};

const KIND_LABELS: Record<SurfaceKind, string> = {
  workbench: 'Workbench',
  popup: 'Popup',
  devpanel: 'DevTools panel',
  sidepanel: 'Side panel',
};

export function surfaceKindColor(kind: SurfaceKind): string {
  return KIND_COLORS[kind];
}

export function surfaceKindInitial(kind: SurfaceKind): string {
  return KIND_INITIALS[kind];
}

export function surfaceKindLabel(kind: SurfaceKind): string {
  return KIND_LABELS[kind];
}
