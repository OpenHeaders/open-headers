/**
 * Workspace-org family — the shared workspace dropdown body (popup +
 * sidepanel + devpanel + workbench), the Org identity plane it renders
 * (host-kind hints, places, sync-provenance annotations), and the
 * org-scope vocabulary behind the WorkspaceOrgBadge tooltip.
 *
 * Display labels compose viewer-side: core classifies (`orgHostHintKind`,
 * `OrgSyncAnnotation.kind`) and these keys word each classification, so
 * the raw Org / workspace / backend names ride inside keyed values.
 *
 * Raw by design inside keyed values: Org names (Chrome, my-mac, Acme),
 * workspace names, backend labels/URLs, LAN/WAN acronyms, the → glyph.
 */

import type { Catalog } from '../../types';

export const sharedWorkspace = {
  // ── Org host-kind hints (second-person home-Org sub-labels) ────────
  'shared.org.hint.browser': 'This browser',
  'shared.org.hint.desktop': 'This computer',
  'shared.org.hint.serverLocal': 'Local server',
  'shared.org.hint.serverRemote': 'Remote server',

  // ── Org places — what a joined Org's group header reads as ─────────
  'shared.org.place.desktopApp': 'This computer · desktop app',
  'shared.org.place.desktopAppNamed': '{name} · desktop app',
  'shared.org.place.server': '{name} · server',

  // ── Org sync-provenance annotations ("via <backend>") ──────────────
  'shared.org.sync.removed': 'no longer syncing',
  'shared.org.sync.off': 'via {label} — off, not syncing',
  'shared.org.sync.connecting': 'via {label} — connecting…',
  'shared.org.sync.synced': 'via {label}',
  'shared.org.sync.repair': 'via {label} — re-pair needed',
  'shared.org.sync.disconnected': 'via {label} — disconnected',
  'shared.org.sync.orphaned': 'connection removed — local copies',

  // ── Org states beside a place (the switcher headers name the place) ─
  'shared.org.state.off': 'off, not syncing',
  'shared.org.state.repair': 're-pair needed',
  'shared.org.state.disconnected': 'disconnected',

  // ── Org scope descriptions (WorkspaceOrgBadge tooltip) ─────────────
  'shared.org.scope.local.browser': 'Stays on this device, inside this browser. Never synced anywhere.',
  'shared.org.scope.local.desktopClient': 'Stays on this device, inside the desktop app. Never synced anywhere.',
  'shared.org.scope.local.desktopLan': 'Stays on your devices. Synced over local network (LAN).',
  'shared.org.scope.local.desktopLoopback':
    'Stays on this device — synced between the desktop app and connected browsers.',
  'shared.org.scope.local.serverLan': 'Shared on this server. Synced over local network (LAN).',
  'shared.org.scope.local.serverWan': 'Shared on this server. Synced over the internet (WAN).',
  'shared.org.scope.local.serverLoopback': 'Lives on this server — only this machine can connect.',
  'shared.org.scope.local.generic': 'Stays on this device.',
  'shared.org.scope.personal.desktop': 'Stays on this device — synced between this browser and the desktop app.',
  'shared.org.scope.personal.serverWan': 'Synced with your server over the internet (WAN).',
  'shared.org.scope.personal.serverLan': 'Synced with your server over the local network (LAN).',
  'shared.org.scope.personal.generic': 'Synced across your devices.',
  'shared.org.scope.team.wan': 'Shared with the team over the internet (WAN).',
  'shared.org.scope.team.lan': 'Shared with the team over the local network (LAN).',
  'shared.org.scope.team.generic': 'Shared with everyone in this team.',

  // ── Workspace dropdown body ─────────────────────────────────────────
  'shared.workspaceDropdown.searchPlaceholder': 'Search workspaces…',
  'shared.workspaceDropdown.noMatch': 'No workspaces match your search.',
  'shared.workspaceDropdown.empty': 'No workspaces yet.',
  'shared.workspaceDropdown.activeTag': 'ACTIVE',
  'shared.workspaceDropdown.activePopoverTitle': 'Active workspace',
  'shared.workspaceDropdown.activePopoverBody':
    'The rule engine is injecting this workspace’s http rules for changing live traffic. Only one workspace can ' +
    'be active at a time, per browser.',
  'shared.workspaceDropdown.setActiveTooltip': 'Set active',
  'shared.workspaceDropdown.checkActiveTooltip': 'Active workspace',
  'shared.workspaceDropdown.makeActiveAria': 'Make "{name}" the active workspace',
  'shared.workspaceDropdown.orphanedOrgHeader': 'No longer syncing',
  'shared.workspaceDropdown.activeFooterLabel': 'Active:',
  'shared.workspaceDropdown.export': 'Export',
  'shared.workspaceDropdown.import': 'Import',
  'shared.workspaceDropdown.manage': 'Manage workspaces',

  // ── The one entry row into Backup and Sync (the plan D2) ────────────
  'shared.workspaceDropdown.backupAndSync': 'Backup and Sync…',

  // ── Org-switch header (inline landing annotation + why-tooltip) ─────
  'shared.workspaceDropdown.orgSwitch.aria': 'Switch to {label}',
  'shared.workspaceDropdown.orgSwitch.ariaWithTarget': 'Switch to {label} → {name}',
  'shared.workspaceDropdown.orgSwitch.landsOnInline': '→ {name}',
  'shared.workspaceDropdown.orgSwitch.landsOnLastUsed':
    'Lands on “{name}” because it’s the workspace you last used in this Org.',
  'shared.workspaceDropdown.orgSwitch.landsOnDefault': 'Lands on “{name}” because it’s this Org’s default workspace.',
  'shared.workspaceDropdown.orgSwitch.landsOnFirst': 'Lands on “{name}” because it’s this Org’s first workspace.',
} as const satisfies Catalog;
