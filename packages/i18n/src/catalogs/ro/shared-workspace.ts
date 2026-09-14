/**
 * Workspace-org family — Romanian. Mirrors
 * `catalogs/en/shared-workspace.ts` key for key; see that file for the
 * viewer-side composition rules and the raw plane (Org names,
 * workspace names, backend labels / URLs, LAN / WAN, the → glyph).
 * Mints: prin {label} = via; reasociere = re-pair; copii locale = local
 * copies; rețeaua locală (LAN) / internet (WAN); ACTIV = ACTIVE; Ajunge
 * la „{name}” = lands on; Org raw (f., această Org); „Copie de rezervă
 * și sincronizare…” = the Backup and Sync entry row (the
 * shared-components mint, quoted verbatim).
 */

import type { Catalog } from '../../types';

export const sharedWorkspace = {
  // ── Org host-kind hints (second-person home-Org sub-labels) ────────
  'shared.org.hint.browser': 'Acest browser',
  'shared.org.hint.desktop': 'Acest computer',
  'shared.org.hint.serverLocal': 'Server local',
  'shared.org.hint.serverRemote': 'Server la distanță',

  // ── Org places — what a joined Org's group header reads as ─────────
  'shared.org.place.desktopApp': 'Acest computer · aplicația desktop',
  'shared.org.place.desktopAppNamed': '{name} · aplicația desktop',
  'shared.org.place.server': '{name} · server',

  // ── Org sync-provenance annotations ("via <backend>") ──────────────
  'shared.org.sync.removed': 'nu se mai sincronizează',
  'shared.org.sync.off': 'prin {label} — oprit, nu se sincronizează',
  'shared.org.sync.connecting': 'prin {label} — se conectează…',
  'shared.org.sync.synced': 'prin {label}',
  'shared.org.sync.repair': 'prin {label} — necesită reasociere',
  'shared.org.sync.disconnected': 'prin {label} — deconectat',
  'shared.org.sync.orphaned': 'conexiune eliminată — copii locale',

  // ── Org states beside a place (the switcher headers name the place) ─
  'shared.org.state.off': 'oprit, nu se sincronizează',
  'shared.org.state.repair': 'necesită reasociere',
  'shared.org.state.disconnected': 'deconectat',

  // ── Org scope descriptions (WorkspaceOrgBadge tooltip) ─────────────
  'shared.org.scope.local.browser': 'Rămâne pe acest dispozitiv, în acest browser. Nu se sincronizează nicăieri.',
  'shared.org.scope.local.desktopClient':
    'Rămâne pe acest dispozitiv, în aplicația desktop. Nu se sincronizează nicăieri.',
  'shared.org.scope.local.desktopLan': 'Rămâne pe dispozitivele dvs. Sincronizat prin rețeaua locală (LAN).',
  'shared.org.scope.local.desktopLoopback':
    'Rămâne pe acest dispozitiv — sincronizat între aplicația desktop și browserele conectate.',
  'shared.org.scope.local.serverLan': 'Partajat pe acest server. Sincronizat prin rețeaua locală (LAN).',
  'shared.org.scope.local.serverWan': 'Partajat pe acest server. Sincronizat prin internet (WAN).',
  'shared.org.scope.local.serverLoopback': 'Se află pe acest server — doar acest computer se poate conecta.',
  'shared.org.scope.local.generic': 'Rămâne pe acest dispozitiv.',
  'shared.org.scope.personal.desktop':
    'Rămâne pe acest dispozitiv — sincronizat între acest browser și aplicația desktop.',
  'shared.org.scope.personal.serverWan': 'Sincronizat cu serverul dvs. prin internet (WAN).',
  'shared.org.scope.personal.serverLan': 'Sincronizat cu serverul dvs. prin rețeaua locală (LAN).',
  'shared.org.scope.personal.generic': 'Sincronizat între dispozitivele dvs.',
  'shared.org.scope.team.wan': 'Partajat cu echipa prin internet (WAN).',
  'shared.org.scope.team.lan': 'Partajat cu echipa prin rețeaua locală (LAN).',
  'shared.org.scope.team.generic': 'Partajat cu toți membrii acestei echipe.',

  // ── Workspace dropdown body ─────────────────────────────────────────
  'shared.workspaceDropdown.searchPlaceholder': 'Căutare spații de lucru…',
  'shared.workspaceDropdown.noMatch': 'Niciun spațiu de lucru nu corespunde căutării.',
  'shared.workspaceDropdown.empty': 'Niciun spațiu de lucru încă.',
  'shared.workspaceDropdown.activeTag': 'ACTIV',
  'shared.workspaceDropdown.activePopoverTitle': 'Spațiu de lucru activ',
  'shared.workspaceDropdown.activePopoverBody':
    'Motorul de reguli injectează regulile http ale acestui spațiu de lucru pentru a modifica traficul în timp real. ' +
    'Un singur spațiu de lucru poate fi activ la un moment dat, per browser.',
  'shared.workspaceDropdown.setActiveTooltip': 'Setare ca activ',
  'shared.workspaceDropdown.checkActiveTooltip': 'Spațiu de lucru activ',
  'shared.workspaceDropdown.makeActiveAria': 'Setați „{name}” ca spațiu de lucru activ',
  'shared.workspaceDropdown.orphanedOrgHeader': 'Nu se mai sincronizează',
  'shared.workspaceDropdown.activeFooterLabel': 'Activ:',
  'shared.workspaceDropdown.export': 'Export',
  'shared.workspaceDropdown.import': 'Import',
  'shared.workspaceDropdown.manage': 'Gestionare spații de lucru',

  // ── The one entry row into Backup and Sync (the plan D2) ────────────
  'shared.workspaceDropdown.backupAndSync': 'Copie de rezervă și sincronizare…',

  // ── Org-switch header (inline landing annotation + why-tooltip) ─────
  'shared.workspaceDropdown.orgSwitch.aria': 'Comutare la {label}',
  'shared.workspaceDropdown.orgSwitch.ariaWithTarget': 'Comutare la {label} → {name}',
  'shared.workspaceDropdown.orgSwitch.landsOnInline': '→ {name}',
  'shared.workspaceDropdown.orgSwitch.landsOnLastUsed':
    'Ajunge la „{name}” pentru că este spațiul de lucru pe care l-ați folosit ultima dată în această Org.',
  'shared.workspaceDropdown.orgSwitch.landsOnDefault':
    'Ajunge la „{name}” pentru că este spațiul de lucru implicit al acestei Org.',
  'shared.workspaceDropdown.orgSwitch.landsOnFirst':
    'Ajunge la „{name}” pentru că este primul spațiu de lucru al acestei Org.',
} as const satisfies Catalog;
