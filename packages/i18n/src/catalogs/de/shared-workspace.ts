/**
 * Workspace-org family — German. Mirrors `catalogs/en/shared-workspace.ts`
 * key for key; Org names (diese Org, f.), workspace names, backend
 * labels/URLs, LAN/WAN and the → glyph stay raw. Mints: via = über;
 * multi-* titles = Multi-Browser / Multi-Gerät / Multi-User; "Lands
 * on" = Du landest auf; ACTIVE tag = AKTIV; rule engine =
 * Regel-Engine (f.).
 */

import type { Catalog } from '../../types';

export const sharedWorkspace = {
  // ── Org host-kind hints (second-person home-Org sub-labels) ────────
  'shared.org.hint.browser': 'Dieser Browser',
  'shared.org.hint.desktop': 'Dieses Gerät',
  'shared.org.hint.daemonLocal': 'Lokaler Server',
  'shared.org.hint.daemonRemote': 'Remote-Server',
  'shared.org.fullLabel': '{hint}: {name}',

  // ── Org sync-provenance annotations ("via <backend>") ──────────────
  'shared.org.sync.removed': 'wird nicht mehr synchronisiert',
  'shared.org.sync.off': 'über {label} — aus, keine Synchronisierung',
  'shared.org.sync.connecting': 'über {label} — verbindet…',
  'shared.org.sync.synced': 'über {label}',
  'shared.org.sync.repair': 'über {label} — erneutes Koppeln nötig',
  'shared.org.sync.disconnected': 'über {label} — getrennt',
  'shared.org.sync.orphaned': 'Back-end entfernt — lokale Kopien',

  // ── Org scope descriptions (WorkspaceOrgBadge tooltip) ─────────────
  'shared.org.scope.local.browser':
    'Bleibt auf diesem Gerät, innerhalb dieses Browsers. Wird nie irgendwohin synchronisiert.',
  'shared.org.scope.local.desktopClient':
    'Bleibt auf diesem Gerät, innerhalb der Desktop-App. Wird nie irgendwohin synchronisiert.',
  'shared.org.scope.local.desktopLan': 'Bleibt auf deinen Geräten. Synchronisiert über das lokale Netzwerk (LAN).',
  'shared.org.scope.local.desktopLoopback':
    'Bleibt auf diesem Gerät — synchronisiert zwischen der Desktop-App und verbundenen Browsern.',
  'shared.org.scope.local.daemonLan': 'Geteilt auf diesem Server. Synchronisiert über das lokale Netzwerk (LAN).',
  'shared.org.scope.local.daemonWan': 'Geteilt auf diesem Server. Synchronisiert über das Internet (WAN).',
  'shared.org.scope.local.daemonLoopback': 'Lebt auf diesem Server — nur diese Maschine kann sich verbinden.',
  'shared.org.scope.local.generic': 'Bleibt auf diesem Gerät.',
  'shared.org.scope.personal.desktop':
    'Bleibt auf diesem Gerät — synchronisiert zwischen diesem Browser und der Desktop-App.',
  'shared.org.scope.personal.daemonWan': 'Synchronisiert mit deinem Server über das Internet (WAN).',
  'shared.org.scope.personal.daemonLan': 'Synchronisiert mit deinem Server über das lokale Netzwerk (LAN).',
  'shared.org.scope.personal.generic': 'Synchronisiert über deine Geräte hinweg.',
  'shared.org.scope.team.wan': 'Geteilt mit dem Team über das Internet (WAN).',
  'shared.org.scope.team.lan': 'Geteilt mit dem Team über das lokale Netzwerk (LAN).',
  'shared.org.scope.team.generic': 'Geteilt mit allen in diesem Team.',

  // ── Workspace dropdown body ─────────────────────────────────────────
  'shared.workspaceDropdown.searchPlaceholder': 'Arbeitsbereiche durchsuchen…',
  'shared.workspaceDropdown.noMatch': 'Keine Arbeitsbereiche passen zu deiner Suche.',
  'shared.workspaceDropdown.empty': 'Noch keine Arbeitsbereiche.',
  'shared.workspaceDropdown.activeTag': 'AKTIV',
  'shared.workspaceDropdown.activePopoverTitle': 'Aktiver Arbeitsbereich',
  'shared.workspaceDropdown.activePopoverBody':
    'Die Regel-Engine injiziert die http-Regeln dieses Arbeitsbereichs, um Live-Traffic zu verändern. Pro ' +
    'Browser kann immer nur ein Arbeitsbereich aktiv sein.',
  'shared.workspaceDropdown.setActiveTooltip': 'Als aktiv festlegen',
  'shared.workspaceDropdown.checkActiveTooltip': 'Aktiver Arbeitsbereich',
  'shared.workspaceDropdown.makeActiveAria': '„{name}“ zum aktiven Arbeitsbereich machen',
  'shared.workspaceDropdown.orphanedOrgHeader': 'Wird nicht mehr synchronisiert',
  'shared.workspaceDropdown.activeFooterLabel': 'Aktiv:',
  'shared.workspaceDropdown.export': 'Exportieren',
  'shared.workspaceDropdown.import': 'Importieren',
  'shared.workspaceDropdown.manage': 'Arbeitsbereiche verwalten',

  // ── "Extend your reach" footer rows + popovers ──────────────────────
  'shared.workspaceDropdown.reach.multiBrowser': 'Über Browser auf diesem Gerät synchronisieren',
  'shared.workspaceDropdown.reach.multiBrowserTitle': 'Multi-Browser',
  'shared.workspaceDropdown.reach.multiBrowserBody':
    'Installiere die Desktop-App — jeder Browser auf diesem Gerät teilt dann dieselben Arbeitsbereiche.',
  'shared.workspaceDropdown.reach.multiDevice': 'Über deine Geräte hinweg synchronisieren',
  'shared.workspaceDropdown.reach.multiDeviceTitle': 'Multi-Gerät',
  'shared.workspaceDropdown.reach.multiDeviceBody':
    'Schalte in der Desktop-App „Mit Geräten in deinem Netzwerk synchronisieren“ ein, damit deine Geräte im ' +
    'selben Netzwerk Arbeitsbereiche teilen.',
  'shared.workspaceDropdown.reach.multiUser': 'Mit deinem Team synchronisieren',
  'shared.workspaceDropdown.reach.multiUserTitle': 'Multi-User',
  'shared.workspaceDropdown.reach.multiUserBody':
    'Verbinde dich mit einem gemeinsamen Server — in deinem Netzwerk oder über das Internet — damit alle darauf ' +
    'in denselben Arbeitsbereichen arbeiten.',

  // ── Org-switch header (inline landing annotation + why-tooltip) ─────
  'shared.workspaceDropdown.orgSwitch.aria': 'Zu {label} wechseln',
  'shared.workspaceDropdown.orgSwitch.ariaWithTarget': 'Zu {label} → {name} wechseln',
  'shared.workspaceDropdown.orgSwitch.landsOnInline': '→ {name}',
  'shared.workspaceDropdown.orgSwitch.landsOnLastUsed':
    'Du landest auf „{name}“, weil das der Arbeitsbereich ist, den du in dieser Org zuletzt verwendet hast.',
  'shared.workspaceDropdown.orgSwitch.landsOnDefault':
    'Du landest auf „{name}“, weil das der Standard-Arbeitsbereich dieser Org ist.',
  'shared.workspaceDropdown.orgSwitch.landsOnFirst':
    'Du landest auf „{name}“, weil das der erste Arbeitsbereich dieser Org ist.',
} as const satisfies Catalog;
