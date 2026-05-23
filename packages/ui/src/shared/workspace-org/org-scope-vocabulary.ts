/**
 * org-scope-vocabulary — two decoupled vocabularies the workspace
 * org-binding UI reads from (UNIFIED_ORACLE_MODEL.md §6.2 / §6.4):
 *
 *   - sync-reach    — keyed by {@link OrgScopeKind}: the picker wording,
 *                     the one-line reach explanation, and the tag colour.
 *   - host-kind     — keyed by {@link HostKind}: the base identity glyph
 *                     for the host process that minted the Org.
 *
 * The identity *label* itself is `orgIdentityLabel` from core — every Org
 * reads by its stored `name`; `orgHostKindHint` adds the home Org's
 * second-person host-kind sub-label. `isPrivate` drives neither
 * vocabulary; it records whether a backend hosts the Org.
 *
 * Per-scope describers — separation of concerns: each scope kind owns
 * its own description function (`describeLocalScope`, `describePersonalScope`,
 * `describeTeamScope`). `describeOrgScope` is the public dispatcher; the
 * `orgScopeVisual` accessor composes (pickerLabel + tagColor) from the
 * static {@link SCOPE_VOCABULARY} with the contextual description.
 */

import { CloudServerOutlined, DesktopOutlined, GlobalOutlined } from '@ant-design/icons';
import type { OrgDescriptor, OrgScopeKind } from '@openheaders/core/identity';
import type { BackendReach } from '@openheaders/core/protocol';
import type { HostKind } from '@openheaders/core/types';
import type { BackendMode } from '@openheaders/ui/workbench/settings/schema/backend';
import type * as React from 'react';

type IconComponent = React.ComponentType<{ style?: React.CSSProperties; className?: string }>;

/** The sync-reach vocabulary for one scope kind. */
export interface OrgScopeVisual {
  /** Sync-scope picker row label, phrased as the §6.4 table. */
  pickerLabel: string;
  /** One-line explanation of the scope's reach. */
  description: string;
  /** antd `Tag` colour token. */
  tagColor: string;
}

/** Picker label + tag colour per scope. Description is contextual — see `describeOrgScope`. */
const SCOPE_VOCABULARY: Record<OrgScopeKind, Omit<OrgScopeVisual, 'description'>> = {
  local: { pickerLabel: 'Local to this device', tagColor: 'default' },
  personal: { pickerLabel: 'Synced across my devices', tagColor: 'blue' },
  team: { pickerLabel: 'Shared with team', tagColor: 'purple' },
};

/** Generic fallback descriptions when no `OrgScopeContext` is available. */
const SCOPE_FALLBACK_DESCRIPTION: Record<OrgScopeKind, string> = {
  local: 'Stays on this device.',
  personal: 'Synced across your devices.',
  team: 'Shared with everyone in this team.',
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
function describeLocalScope(descriptor: OrgDescriptor, ctx: OrgScopeContext): string {
  const { hostKind } = descriptor;
  const { mode, reach } = ctx;

  if (hostKind === 'browser') {
    return 'Stays on this device, inside this browser. Never synced anywhere.';
  }
  if (hostKind === 'desktop') {
    if (mode !== 'desktop-app') {
      // Desktop in daemon-client mode — its own ws-server isn't
      // accepting joins, so the home Org stays put.
      return 'Stays on this device, inside the desktop app. Never synced anywhere.';
    }
    // Self-hosting; `ws-server` only emits `loopback` or `lan`.
    if (reach === 'lan') return 'Stays on your devices. Synced over local network (LAN).';
    return 'Stays on this device — synced between the desktop app and connected browsers.';
  }
  // daemon, isHome — admin view.
  if (reach === 'lan') return 'Shared on this server. Synced over local network (LAN).';
  if (reach === 'wan') return 'Shared on this server. Synced over the internet (WAN).';
  return 'Lives on this server — only this machine can connect.';
}

/**
 * **Personal** scope = a single-user Org that *does* have a backend —
 * either the user's own connected home Org (a desktop they self-host)
 * or a joined peer of theirs (the loopback desktop seen from the
 * extension, a LAN/WAN personal daemon). Wording specializes on the
 * Org's `hostKind` first (what kind of backend hosts it) and on the
 * viewer's connection mode/reach for the daemon case.
 */
function describePersonalScope(descriptor: OrgDescriptor, ctx: OrgScopeContext): string {
  const { hostKind } = descriptor;
  const { mode } = ctx;

  if (hostKind === 'desktop') {
    // The most common case in v5: extension joined to its loopback
    // desktop. Honest, accurate, no caveat about "this device" vs "your
    // devices" — the user is on both ends.
    return 'Stays on this device — synced between this browser and the desktop app.';
  }
  if (hostKind === 'daemon') {
    if (mode === 'remote-self-hosted') return 'Synced with your server over the internet (WAN).';
    return 'Synced with your server over the local network (LAN).';
  }
  // hostKind === 'browser' here = a connected browser Org (future). Generic
  // is fine — the home browser Org doesn't connect on its own today.
  return SCOPE_FALLBACK_DESCRIPTION.personal;
}

/**
 * **Team** scope = a multi-user daemon Org. Wording specializes on the
 * viewer's connection reach.
 */
function describeTeamScope(_descriptor: OrgDescriptor, ctx: OrgScopeContext): string {
  if (ctx.mode === 'remote-self-hosted') return 'Shared with the team over the internet (WAN).';
  return 'Shared with the team over the local network (LAN).';
}

/**
 * Public dispatcher — pick the right per-scope describer for `descriptor`.
 * Returns a generic fallback when no context is supplied.
 */
export function describeOrgScope(descriptor: OrgDescriptor, ctx?: OrgScopeContext): string {
  if (!ctx) return SCOPE_FALLBACK_DESCRIPTION[descriptor.scopeKind];
  switch (descriptor.scopeKind) {
    case 'local':
      return describeLocalScope(descriptor, ctx);
    case 'personal':
      return describePersonalScope(descriptor, ctx);
    case 'team':
      return describeTeamScope(descriptor, ctx);
  }
}

/**
 * Resolve the sync-reach visual for an Org. Composes the static
 * picker-label + tag-colour from {@link SCOPE_VOCABULARY} with the
 * contextual {@link describeOrgScope} description. Surfaces without the
 * live signal can omit `ctx`; the description falls back to a generic
 * per-scope line.
 */
export function orgScopeVisual(descriptor: OrgDescriptor, ctx?: OrgScopeContext): OrgScopeVisual {
  const base = SCOPE_VOCABULARY[descriptor.scopeKind];
  return { ...base, description: describeOrgScope(descriptor, ctx) };
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
