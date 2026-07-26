/**
 * org-scope-vocabulary — two decoupled vocabularies the workspace
 * org-binding UI reads from (UNIFIED_ORACLE_MODEL.md §6.2 / §6.4):
 *
 *   - sync-reach    — keyed by {@link OrgScopeKind}: the one-line reach
 *                     explanation and the tag colour.
 *   - host-kind     — keyed by {@link HostKind}: the base identity glyph
 *                     for the host process that minted the Org.
 *
 * The identity *label* itself is `orgIdentityLabel` from core — every Org
 * reads by its stored `name`; `orgHostHintText` (org-copy.ts) adds the
 * home Org's second-person host-kind sub-label. `isPrivate` drives
 * neither vocabulary; it records whether a backend hosts the Org.
 *
 * Per-scope describers — separation of concerns: each scope kind owns
 * its own description function (`describeLocalScope`, `describePersonalScope`,
 * `describeTeamScope`). `describeOrgScope` is the public dispatcher; the
 * `orgScopeVisual` accessor composes the tag colour from the static
 * {@link SCOPE_TAG_COLOR} with the contextual description. All copy is
 * t-first — descriptions render in the viewer's locale.
 */

import { CloudServerOutlined, DesktopOutlined, GlobalOutlined } from '@ant-design/icons';
import type { OrgDescriptor, OrgScopeKind } from '@openheaders/core/identity';
import type { BackendReach } from '@openheaders/core/protocol';
import type { HostKind } from '@openheaders/core/types';
import type { MessageKey } from '@openheaders/i18n';
import type { Translate } from '@openheaders/ui/context/LocaleContext';
import type { BackendMode } from '@openheaders/ui/workbench/settings/schema/backend';
import type * as React from 'react';

type IconComponent = React.ComponentType<{ style?: React.CSSProperties; className?: string }>;

/** The sync-reach vocabulary for one scope kind. */
export interface OrgScopeVisual {
  /** One-line explanation of the scope's reach, translated. */
  description: string;
  /** antd `Tag` colour token. */
  tagColor: string;
}

const SCOPE_TAG_COLOR: Record<OrgScopeKind, string> = {
  local: 'default',
  personal: 'blue',
  team: 'purple',
};

/** Generic fallback descriptions when no `OrgScopeContext` is available. */
const SCOPE_FALLBACK_KEY: Record<OrgScopeKind, MessageKey> = {
  local: 'shared.org.scope.local.generic',
  personal: 'shared.org.scope.personal.generic',
  team: 'shared.org.scope.team.generic',
};

/** Context a contextual scope description needs to read accurately. */
export interface OrgScopeContext {
  /** This host's effective backend role. */
  mode: BackendMode;
  /** Bind tier of the locally-effective backend; null when none. */
  reach: BackendReach | null;
}

/**
 * **Local** scope = the host's private home Org, no backend connected.
 * Stays on this device, never crosses any wire. Wording specializes on
 * `hostKind` (browser vs. desktop vs. daemon-admin view) — what "this
 * device" actually means depends on which host minted the Org.
 *
 * Joined Orgs **cannot** classify as `local` (registry boundary
 * guarantees `isPrivate: false` on every joined Org), so this describer
 * never needs a `!isHome` branch.
 *
 * Mode semantics referenced here:
 *   - `desktop-app` — self-hosting desktop (its ws-server is accepting joins)
 */
function describeLocalScope(t: Translate, descriptor: OrgDescriptor, ctx: OrgScopeContext): string {
  const { hostKind } = descriptor;
  const { mode, reach } = ctx;

  if (hostKind === 'browser') {
    return t('shared.org.scope.local.browser');
  }
  if (hostKind === 'desktop') {
    if (mode !== 'desktop-app') {
      // Desktop in daemon-client mode — its own ws-server isn't
      // accepting joins, so the home Org stays put.
      return t('shared.org.scope.local.desktopClient');
    }
    // Self-hosting; `ws-server` only emits `loopback` or `lan`.
    if (reach === 'lan') return t('shared.org.scope.local.desktopLan');
    return t('shared.org.scope.local.desktopLoopback');
  }
  // daemon, isHome — admin view.
  if (reach === 'lan') return t('shared.org.scope.local.serverLan');
  if (reach === 'wan') return t('shared.org.scope.local.serverWan');
  return t('shared.org.scope.local.serverLoopback');
}

/**
 * **Personal** scope = a single-user Org that *does* have a backend —
 * either the user's own connected home Org (a desktop they self-host)
 * or a joined peer of theirs (the loopback desktop seen from the
 * extension, a LAN/WAN personal daemon). Wording specializes on the
 * Org's `hostKind` first (what kind of backend hosts it) and on the
 * viewer's connection mode/reach for the daemon case.
 */
function describePersonalScope(t: Translate, descriptor: OrgDescriptor, ctx: OrgScopeContext): string {
  const { hostKind } = descriptor;
  const { mode } = ctx;

  if (hostKind === 'desktop') {
    // The most common case in v5: extension joined to its loopback
    // desktop. Honest, accurate, no caveat about "this device" vs "your
    // devices" — the user is on both ends.
    return t('shared.org.scope.personal.desktop');
  }
  if (hostKind === 'daemon') {
    if (mode === 'remote-self-hosted') return t('shared.org.scope.personal.serverWan');
    return t('shared.org.scope.personal.serverLan');
  }
  // hostKind === 'browser' here = a connected browser Org (future). Generic
  // is fine — the home browser Org doesn't connect on its own today.
  return t(SCOPE_FALLBACK_KEY.personal);
}

/**
 * **Team** scope = a multi-user daemon Org. Wording specializes on the
 * viewer's connection reach.
 */
function describeTeamScope(t: Translate, _descriptor: OrgDescriptor, ctx: OrgScopeContext): string {
  if (ctx.mode === 'remote-self-hosted') return t('shared.org.scope.team.wan');
  return t('shared.org.scope.team.lan');
}

/**
 * Public dispatcher — pick the right per-scope describer for `descriptor`.
 * Returns a generic fallback when no context is supplied.
 */
export function describeOrgScope(t: Translate, descriptor: OrgDescriptor, ctx?: OrgScopeContext): string {
  if (!ctx) return t(SCOPE_FALLBACK_KEY[descriptor.scopeKind]);
  switch (descriptor.scopeKind) {
    case 'local':
      return describeLocalScope(t, descriptor, ctx);
    case 'personal':
      return describePersonalScope(t, descriptor, ctx);
    case 'team':
      return describeTeamScope(t, descriptor, ctx);
  }
}

/**
 * Resolve the sync-reach visual for an Org. Composes the static tag
 * colour from {@link SCOPE_TAG_COLOR} with the contextual
 * {@link describeOrgScope} description. Surfaces without the live
 * signal can omit `ctx`; the description falls back to a generic
 * per-scope line.
 */
export function orgScopeVisual(t: Translate, descriptor: OrgDescriptor, ctx?: OrgScopeContext): OrgScopeVisual {
  return { tagColor: SCOPE_TAG_COLOR[descriptor.scopeKind], description: describeOrgScope(t, descriptor, ctx) };
}

/** The base identity glyph for the host process that minted the Org. */
const HOST_KIND_ICON: Record<HostKind, IconComponent> = {
  browser: GlobalOutlined,
  desktop: DesktopOutlined,
  daemon: CloudServerOutlined,
};

export function hostKindIcon(hostKind: HostKind): IconComponent {
  return HOST_KIND_ICON[hostKind];
}
