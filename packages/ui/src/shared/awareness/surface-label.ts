/**
 * Surface-kind presentation primitives.
 *
 * Surfaces report their `surfaceKind` (`workbench` / `popup` /
 * `devpanel` / `sidepanel`) plus a raw `labelContext` (tab title,
 * inspected-page title, hostname). The display label is composed
 * VIEWER-side from the viewer's translation of the kind and the raw
 * context — see {@link surfaceDisplayLabel} — so peers render in the
 * viewer's locale, never the author's.
 *
 * Color falls out of the kind so badges stay visually consistent
 * across surfaces without each surface having to agree on a palette.
 * Pure module: kind labels are `MessageKey`s; translation happens at
 * render with the caller's `t`.
 */

import type { PresenceIdentity, SurfaceKind } from '@openheaders/core/protocol';
import type { MessageKey } from '@openheaders/i18n';
import type { Translate } from '@openheaders/ui/context/LocaleContext';

const KIND_COLORS: Record<SurfaceKind, string> = {
  workbench: '#1677ff',
  popup: '#52c41a',
  devpanel: '#722ed1',
  sidepanel: '#fa8c16',
};

const KIND_LABEL_KEYS: Record<SurfaceKind, MessageKey> = {
  workbench: 'shared.awareness.kind.workbench',
  popup: 'shared.awareness.kind.popup',
  devpanel: 'shared.awareness.kind.devpanel',
  sidepanel: 'shared.awareness.kind.sidepanel',
};

export function surfaceKindColor(kind: SurfaceKind): string {
  return KIND_COLORS[kind];
}

export function surfaceKindLabel(kind: SurfaceKind): MessageKey {
  return KIND_LABEL_KEYS[kind];
}

/**
 * Compose a peer surface's display label in the viewer's locale.
 *
 * Own-tab surfaces (workbench / popup / sidepanel) advertise their tab
 * title as `labelContext` — it already names the surface the way the
 * user sees it on the tab strip, so it renders verbatim. DevTools
 * panels advertise the inspected page's title/hostname; the "DevTools"
 * framing is viewer-side chrome. Without any context the translated
 * kind label stands alone.
 */
export function surfaceDisplayLabel(
  t: Translate,
  identity: Pick<PresenceIdentity, 'surfaceKind' | 'labelContext'>,
): string {
  const context = identity.labelContext;
  if (!context) return t(surfaceKindLabel(identity.surfaceKind));
  if (identity.surfaceKind === 'devpanel') {
    return t('shared.awareness.surface.devpanelContext', { title: context });
  }
  return context;
}
