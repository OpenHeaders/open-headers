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
 * second-person host-kind sub-label. `isSynthetic` drives neither
 * vocabulary; it records trust-by-process.
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

const SCOPE_VOCABULARY: Record<OrgScopeKind, Omit<OrgScopeVisual, 'description'> & { description: string }> = {
  local: {
    pickerLabel: 'Local to this device',
    description: 'Stays on this device.',
    tagColor: 'default',
  },
  personal: {
    pickerLabel: 'Synced across my devices',
    description: 'Reaches every device signed in as you.',
    tagColor: 'blue',
  },
  team: {
    pickerLabel: 'Shared with team',
    description: 'Shared with everyone in this team.',
    tagColor: 'purple',
  },
};

/** Context the local-scope description needs to read accurately. */
export interface OrgScopeContext {
  /** This host's effective backend role. */
  mode: BackendMode;
  /** Bind tier of the locally-effective backend; null when none. */
  reach: BackendReach | null;
}

/**
 * Local-scope description, decided by the Org's identity first
 * (`isHome` + `hostKind`) and refined by the viewer's connection
 * (`mode` + `reach`).
 *
 * The Org's identity matters because the synthetic local-org of a
 * client-only host (a browser; a desktop in daemon-client mode) never
 * accepts joins — its workspaces stay in that vessel regardless of what
 * backend the user has connected to *for other Orgs*. The connection
 * then decides the wording for the cases that do sync.
 *
 * Mode semantics:
 *   - `in-browser`           — SW is the backend (extension only)
 *   - `desktop-app`          — paired with the desktop app on this
 *                              device (extension as client, OR desktop
 *                              self-hosting; disambiguated by `isHome`)
 *   - `local-self-hosted`    — client of a self-hosted server on the LAN
 *   - `remote-self-hosted`   — client of a self-hosted server over WAN
 */
function describeLocalScope(descriptor: OrgDescriptor, ctx: OrgScopeContext): string {
  const { hostKind, isHome } = descriptor;
  const { mode, reach } = ctx;

  if (isHome) {
    // The viewer is on the host that minted this Org. The Org's sync
    // footprint depends on whether this host accepts joins — only
    // self-hosting desktops/daemons do.
    if (hostKind === 'browser') {
      // Browser never accepts joins, regardless of what backend is
      // connected for *other* Orgs.
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
    // daemon, isHome=true — admin view.
    if (reach === 'lan') return 'Shared on this server. Synced over local network (LAN).';
    if (reach === 'wan') return 'Shared on this server. Synced over the internet (WAN).';
    return 'Lives on this server — only this machine can connect.';
  }

  // isHome=false — a joined peer's synthetic Org. Mode tells us what
  // kind of peer we're paired with.
  if (hostKind === 'desktop') {
    return 'Stays on this device — synced between this browser and the desktop app.';
  }
  if (hostKind === 'daemon') {
    if (mode === 'remote-self-hosted') return 'Shared with the server. Synced over the internet (WAN).';
    return 'Shared with the server. Synced over local network (LAN).';
  }
  // hostKind === 'browser' && !isHome — browsers never accept joins, so
  // this combination shouldn't reach the catalogue. Defensive fallback.
  return 'Stays on this device.';
}

/**
 * Resolve the sync-reach visual for an Org. The `local` scope's
 * description varies with the viewer's {@link OrgScopeContext} — its
 * host process, mode, and bind reach. Personal / team scopes ignore
 * `ctx`. Surfaces without the live signal can omit `ctx`; the local
 * description falls back to the generic "Stays on this device" line.
 */
export function orgScopeVisual(descriptor: OrgDescriptor, ctx?: OrgScopeContext): OrgScopeVisual {
  const base = SCOPE_VOCABULARY[descriptor.scopeKind];
  if (descriptor.scopeKind !== 'local' || !ctx) return base;
  return { ...base, description: describeLocalScope(descriptor, ctx) };
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
