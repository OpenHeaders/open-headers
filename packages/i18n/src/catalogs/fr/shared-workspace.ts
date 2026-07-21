/**
 * Workspace-org family — French. Mirrors `catalogs/en/shared-workspace.ts`
 * key for key; Org names, workspace names, backend labels/URLs, LAN/WAN
 * and the → glyph stay raw.
 */

import type { Catalog } from '../../types';

export const sharedWorkspace = {
  // ── Org host-kind hints (second-person home-Org sub-labels) ────────
  'shared.org.hint.browser': 'Ce navigateur',
  'shared.org.hint.desktop': 'Cet appareil',
  'shared.org.hint.daemonLocal': 'Serveur local',
  'shared.org.hint.daemonRemote': 'Serveur distant',
  'shared.org.fullLabel': '{hint} : {name}',

  // ── Org sync-provenance annotations ("via <backend>") ──────────────
  'shared.org.sync.removed': 'ne se synchronise plus',
  'shared.org.sync.off': 'via {label} — désactivé, pas de synchronisation',
  'shared.org.sync.connecting': 'via {label} — connexion…',
  'shared.org.sync.synced': 'via {label}',
  'shared.org.sync.repair': 'via {label} — réassociation nécessaire',
  'shared.org.sync.disconnected': 'via {label} — déconnecté',
  'shared.org.sync.orphaned': 'back-end supprimé — copies locales',

  // ── Org scope descriptions (WorkspaceOrgBadge tooltip) ─────────────
  'shared.org.scope.local.browser': 'Reste sur cet appareil, dans ce navigateur. Jamais synchronisé nulle part.',
  'shared.org.scope.local.desktopClient':
    "Reste sur cet appareil, dans l'application de bureau. Jamais synchronisé nulle part.",
  'shared.org.scope.local.desktopLan': 'Reste sur vos appareils. Synchronisé via le réseau local (LAN).',
  'shared.org.scope.local.desktopLoopback':
    "Reste sur cet appareil — synchronisé entre l'application de bureau et les navigateurs connectés.",
  'shared.org.scope.local.daemonLan': 'Partagé sur ce serveur. Synchronisé via le réseau local (LAN).',
  'shared.org.scope.local.daemonWan': 'Partagé sur ce serveur. Synchronisé via internet (WAN).',
  'shared.org.scope.local.daemonLoopback': 'Réside sur ce serveur — seule cette machine peut se connecter.',
  'shared.org.scope.local.generic': 'Reste sur cet appareil.',
  'shared.org.scope.personal.desktop':
    "Reste sur cet appareil — synchronisé entre ce navigateur et l'application de bureau.",
  'shared.org.scope.personal.daemonWan': 'Synchronisé avec votre serveur via internet (WAN).',
  'shared.org.scope.personal.daemonLan': 'Synchronisé avec votre serveur via le réseau local (LAN).',
  'shared.org.scope.personal.generic': 'Synchronisé entre vos appareils.',
  'shared.org.scope.team.wan': "Partagé avec l'équipe via internet (WAN).",
  'shared.org.scope.team.lan': "Partagé avec l'équipe via le réseau local (LAN).",
  'shared.org.scope.team.generic': 'Partagé avec tous les membres de cette équipe.',

  // ── Workspace dropdown body ─────────────────────────────────────────
  'shared.workspaceDropdown.searchPlaceholder': 'Rechercher des espaces de travail…',
  'shared.workspaceDropdown.noMatch': 'Aucun espace de travail ne correspond à votre recherche.',
  'shared.workspaceDropdown.empty': "Aucun espace de travail pour l'instant.",
  'shared.workspaceDropdown.activeTag': 'ACTIF',
  'shared.workspaceDropdown.activePopoverTitle': 'Espace de travail actif',
  'shared.workspaceDropdown.activePopoverBody':
    'Le moteur de règles injecte les règles http de cet espace de travail pour modifier le trafic en direct. Un ' +
    'seul espace de travail peut être actif à la fois, par navigateur.',
  'shared.workspaceDropdown.setActiveTooltip': 'Définir comme actif',
  'shared.workspaceDropdown.checkActiveTooltip': 'Espace de travail actif',
  'shared.workspaceDropdown.makeActiveAria': "Faire de « {name} » l'espace de travail actif",
  'shared.workspaceDropdown.orphanedOrgHeader': 'Ne se synchronise plus',
  'shared.workspaceDropdown.activeFooterLabel': 'Actif :',
  'shared.workspaceDropdown.export': 'Exporter',
  'shared.workspaceDropdown.import': 'Importer',
  'shared.workspaceDropdown.manage': 'Gérer les espaces de travail',

  // ── "Extend your reach" footer rows + popovers ──────────────────────
  'shared.workspaceDropdown.reach.multiBrowser': 'Synchroniser entre les navigateurs de cet appareil',
  'shared.workspaceDropdown.reach.multiBrowserTitle': 'Multi-navigateur',
  'shared.workspaceDropdown.reach.multiBrowserBody':
    "Installez l'application de bureau — chaque navigateur de cet appareil partage alors les mêmes espaces de " +
    'travail.',
  'shared.workspaceDropdown.reach.multiDevice': 'Synchroniser entre vos appareils',
  'shared.workspaceDropdown.reach.multiDeviceTitle': 'Multi-appareil',
  'shared.workspaceDropdown.reach.multiDeviceBody':
    "Dans l'application de bureau, activez « Synchroniser avec les appareils de votre réseau » pour que vos " +
    'appareils sur le même réseau partagent les espaces de travail.',
  'shared.workspaceDropdown.reach.multiUser': 'Synchroniser avec votre équipe',
  'shared.workspaceDropdown.reach.multiUserTitle': 'Multi-utilisateur',
  'shared.workspaceDropdown.reach.multiUserBody':
    'Connectez-vous à un serveur partagé — sur votre réseau ou via internet — pour que tous ses membres ' +
    'travaillent dans les mêmes espaces de travail.',

  // ── Org-switch header (inline landing annotation + why-tooltip) ─────
  'shared.workspaceDropdown.orgSwitch.aria': 'Passer à {label}',
  'shared.workspaceDropdown.orgSwitch.ariaWithTarget': 'Passer à {label} → {name}',
  'shared.workspaceDropdown.orgSwitch.landsOnInline': '→ {name}',
  'shared.workspaceDropdown.orgSwitch.landsOnLastUsed':
    "Arrive sur « {name} » parce que c'est le dernier espace de travail que vous avez utilisé dans cette Org.",
  'shared.workspaceDropdown.orgSwitch.landsOnDefault':
    "Arrive sur « {name} » parce que c'est l'espace de travail par défaut de cette Org.",
  'shared.workspaceDropdown.orgSwitch.landsOnFirst':
    "Arrive sur « {name} » parce que c'est le premier espace de travail de cette Org.",
} as const satisfies Catalog;
