/**
 * Shared chrome family — Romanian. Mirrors
 * `catalogs/en/shared-chrome.ts` key for key; see that file for the
 * family rules and the raw-by-design plane (browser banner quoted
 * verbatim raw en, nav / worker / OOPIF, xhr/fetch, boot.interactive).
 * Mints: modul Depanare = Debug mode (carried); rază de acțiune = the
 * debug REACH (the reach referent — distinct from sferă = the variable
 * scope; the de Reichweite / ru область действия split); atașare =
 * attach (Chrome's ro DevTools verb; Atașare la = Attach to, filele
 * atașate carried from the panel tour); aspect = layout (carried from
 * panel.ts); sursă de aspect = layout donor; Schiță = Scratch (unsaved
 * tier — decided over ciornă nesalvată) vs Ciornă = Draft (saved tier,
 * carried); pornire la rece = cold start / trezire la rece = cold wake;
 * Procese = Processes; ciclu de viață = lifecycle; note de lansare =
 * release notes (carried); Deconectare = Sign out (distinct from the
 * tray's Ieșire = Quit); Suplimente = Add-ons; Aspect vizual =
 * Appearance (the gear-menu row — aspect alone is the layout);
 * Tur ghidat carried; Sănătos / Eșec / Probleme = Healthy / Failure /
 * Issues; the subsystem pills TRANSLATE in the status popover
 * (Sincronizare / Reguli / Cereri / Permisiuni / Secrete / Live /
 * Activitate / Modul Depanare) while the popup tour keeps them raw (the
 * S115 choice stands); Activat / Dezactivat = the On / Off STATES here
 * (the same pair the cookies round-trip uses — one ro pair, no split);
 * Configurat / Neconfigurat = the CLI Set up / Not set up states (CLI
 * n.) vs Neconfigurat = Not configured (MCP n. — the same form); Live
 * raw with a head noun (starea Live). The {unit} / {units} holes carry
 * localized host nouns and take element ({unit}) as in panel.ts, never
 * an agreeing adjective; {version} holes take versiunea (Actualizare la
 * versiunea {version}); the update-dialog sandwich reads `v{version}
 * este acum disponibilă!` (versiune f.).
 */

import type { Catalog } from '../../types';

export const sharedChrome = {
  // ── Debug mode pill + dormant notice ───────────────────────────────
  'shared.chrome.debug.title': 'Modul Depanare',
  'shared.chrome.debug.titleShort': 'Depanare',
  'shared.chrome.debug.unavailableHint': 'Modul Depanare este disponibil în browserele Chrome și Edge.',
  'shared.chrome.debug.toggleAria': 'Comutare mod Depanare',
  'shared.chrome.debug.aboutTooltip': 'Despre modul Depanare',
  'shared.chrome.debug.openDocsAria': 'Deschidere documentație pentru modul Depanare',
  'shared.chrome.debug.controlsAria': 'Comenzile modului Depanare',
  'shared.chrome.debug.turnOn': 'Activare mod Depanare',
  'shared.chrome.debug.turnOff': 'Dezactivare mod Depanare',
  'shared.chrome.debug.scopeDevtools': 'Unde este deschisă fereastra DevTools',
  'shared.chrome.debug.scopeActive': 'Fila focalizată',
  'shared.chrome.debug.scopeBoth': 'Ambele',
  'shared.chrome.debug.attachTo': 'Atașare la',
  'shared.chrome.debug.includeThisTab': 'Includere această filă de browser',
  'shared.chrome.debug.pinThisTabAria': 'Fixare această filă de browser',
  'shared.chrome.debug.attachedTabs': 'Filele atașate',
  'shared.chrome.debug.noTabsAttached': 'Nicio filă atașată încă',
  'shared.chrome.debug.bannerNote':
    'Cât timp modul Depanare este activ, bannerul browserului „OH started debugging this browser” apare pe fiecare filă — nu doar pe cele atașate.',
  'shared.chrome.debug.tabNumber': 'Fila #{number}',
  'shared.chrome.debug.tabFallback': 'Fila {id}',
  'shared.chrome.debug.onThisTab': 'Sunteți pe această filă',
  'shared.chrome.debug.switchTo': 'Comutare la fila {target}',
  'shared.chrome.debug.dormantTooltip':
    'Modul Depanare este activ, dar această filă este în afara razei sale de acțiune — efectele nav / worker / OOPIF ale regulilor dvs. de nivel depanare sunt inactive aici. Aduceți-o în raza de acțiune din modul Depanare (schimbați raza de acțiune sau fixați această filă). Peste cererile paginii (xhr/fetch) ele rulează în continuare.',
  'shared.chrome.debug.tabOutOfScope': 'Filă în afara razei de acțiune',

  // ── System Status pill ─────────────────────────────────────────────
  'shared.chrome.status.title': 'Sistem',
  'shared.chrome.status.aria': 'Starea sistemului: {summary}',
  'shared.chrome.status.aboutTooltip': 'Despre acest panou',
  'shared.chrome.status.openDocsAria': 'Deschidere documentație pentru starea sistemului',
  'shared.chrome.status.healthy': 'Sănătos',
  'shared.chrome.status.failure': 'Eșec',
  'shared.chrome.status.issues': 'Probleme',
  'shared.chrome.status.noEvents': 'Niciun eveniment încă',
  'shared.chrome.status.subsystemSync': 'Sincronizare',
  'shared.chrome.status.subsystemRules': 'Reguli',
  'shared.chrome.status.subsystemRequests': 'Cereri',
  'shared.chrome.status.subsystemPermissions': 'Permisiuni',
  'shared.chrome.status.subsystemSecrets': 'Secrete',
  'shared.chrome.status.subsystemLive': 'Live',
  'shared.chrome.status.subsystemActivity': 'Activitate',
  'shared.chrome.status.subsystemDebugMode': 'Modul Depanare',
  'shared.chrome.status.buildLine': 'Open Headers · {version}',
  'shared.chrome.status.versionBeta': '{version} (beta)',
  'shared.chrome.status.buildNumber': 'build {build}',

  // ── Status popover product extras ──────────────────────────────────
  'shared.chrome.status.relaunchApp': 'Relansare aplicație',
  'shared.chrome.status.backendOff': 'Dezactivat',
  'shared.chrome.status.backendConnecting': 'Se conectează…',
  'shared.chrome.status.companionDesktopApp': 'Aplicația desktop',
  'shared.chrome.status.companionExtensions': 'Extensii',
  'shared.chrome.status.companionConnected': 'Conectată',
  'shared.chrome.status.companionRunsRequests': 'rulează solicitările',
  'shared.chrome.status.companionNotConnected': 'Neconectată',
  'shared.chrome.status.companionInstalledNotConnected': 'Instalată · neconectată',
  'shared.chrome.status.companionNotInstalled': 'Neinstalată',
  'shared.chrome.status.companionDownload': 'Descărcare',
  'shared.chrome.status.companionPeersConnected': 'Conectate: {count}',
  'shared.chrome.status.companionNoPeers': 'Niciuna conectată',
  'shared.chrome.status.companionConnect': 'Conectare',
  'shared.chrome.status.companionOpenApp': 'Deschidere aplicație',
  'shared.chrome.addons.title': 'Suplimente',
  'shared.chrome.addons.cli': 'CLI',
  'shared.chrome.addons.server': 'Server',
  'shared.chrome.addons.cliSetUp': 'Configurat',
  'shared.chrome.addons.cliNotSetUp': 'Neconfigurat',
  'shared.chrome.addons.cliStale': 'Token revocat — configurați din nou',
  'shared.chrome.addons.cliExternal': 'Configurație externă',
  'shared.chrome.addons.cliMalformed': 'Configurație coruptă',
  'shared.chrome.addons.cliProvision': 'Configurare',
  'shared.chrome.addons.mcp': 'MCP',
  'shared.chrome.addons.mcpOn': 'Activat',
  'shared.chrome.addons.mcpTurnOn': 'Activare',
  'shared.chrome.addons.notConfigured': 'Neconfigurat',
  'shared.chrome.addons.requiresDesktop': 'Necesită aplicația desktop',
  'shared.chrome.addons.cliViaDesktop': 'Configurați din aplicația desktop',
  'shared.chrome.status.coldStart': 'Pornire la rece',
  'shared.chrome.status.coldStartMessage': 'Regresie de performanță detectată — consultați exportul de diagnostic',
  'shared.chrome.status.coldStartTooltip':
    'Trei treziri la rece consecutive au depășit nivelul de referință cu ≥20%. Eșantioane boot.interactive recente (ms): {samples}.',

  // ── Update dialog ──────────────────────────────────────────────────
  'shared.chrome.updates.title': 'Actualizare',
  'shared.chrome.updates.downloading': 'Se descarcă…',
  'shared.chrome.updates.downloadingPercent': 'Se descarcă… {percent}%',
  'shared.chrome.updates.updateAndRestart': 'Actualizare și repornire',
  'shared.chrome.updates.ignore': 'Ignorare această actualizare',
  'shared.chrome.updates.remindLater': 'Reamintire mai târziu',
  'shared.chrome.updates.nowAvailableSuffix': 'este acum disponibilă!',
  'shared.chrome.updates.moreDetailsPrefix': 'Pentru mai multe detalii, consultați',
  'shared.chrome.updates.releaseNotes': 'notele de lansare',
  'shared.chrome.updates.updatingTo': 'Actualizare de la versiunea {from} la versiunea {to}.',
  'shared.chrome.updates.configure': 'Configurare actualizări…',

  // ── Settings gear menu ─────────────────────────────────────────────
  'shared.chrome.gearMenu.downloadVersion': 'Descărcare versiunea {version}',
  'shared.chrome.gearMenu.versionAvailable': 'Versiunea {version} este disponibilă…',
  'shared.chrome.gearMenu.updateAndRestartVersion': 'Actualizare la versiunea {version} și repornire',
  'shared.chrome.gearMenu.downloadingVersion': 'Se descarcă versiunea {version}…',
  'shared.chrome.gearMenu.restartToInstallVersion': 'Repornire pentru instalarea versiunii {version}',
  'shared.chrome.gearMenu.settings': 'Setări…',
  'shared.chrome.gearMenu.keyboardShortcuts': 'Scurtături de tastatură…',
  'shared.chrome.gearMenu.appearance': 'Aspect vizual…',
  'shared.chrome.gearMenu.about': 'Despre Open Headers',
  'shared.chrome.gearMenu.tourGuide': 'Tur ghidat',
  'shared.chrome.gearMenu.signOut': 'Deconectare',
  'shared.chrome.gearMenu.searchPlaceholder': 'Căutare',
  'shared.chrome.gearMenu.noMatches': 'Nicio potrivire',
  'shared.chrome.gearMenu.settingsTooltip': 'Setări',
  'shared.chrome.gearMenu.settingsMenuAria': 'Meniul de setări',

  // ── Background tasks (Processes) ───────────────────────────────────
  'shared.chrome.tasks.processes': 'Procese',
  'shared.chrome.tasks.hidePanelAria': 'Ascundere panou procese',
  'shared.chrome.tasks.allCompleted': 'Toate sarcinile din fundal s-au încheiat',
  'shared.chrome.tasks.aboutNoteAria': 'Despre această notă',
  'shared.chrome.tasks.stop': 'Oprire',
  'shared.chrome.tasks.keepRunning': 'Continuare execuție',
  'shared.chrome.tasks.stopTaskAria': 'Oprire sarcină din fundal',
  'shared.chrome.tasks.hideTaskAria': 'Ascundere sarcină din fundal',
  'shared.chrome.tasks.hideProcesses': 'Ascundere procese',
  'shared.chrome.tasks.hideProcessesCount': 'Ascundere procese ({count})',

  // ── Layout-donor pill ──────────────────────────────────────────────
  'shared.chrome.donor.defaultTooltip': 'Element implicit ({unit}) — noile {units} moștenesc aspectul de aici.',
  'shared.chrome.donor.nonDefaultTooltip':
    'Sursa de aspect implicită este un alt element ({unit}) — noile {units} moștenesc aspectul de acolo.',
  'shared.chrome.donor.isDonorBody':
    'Acest element ({unit}) este cel implicit în prezent. Noile {units} moștenesc acest aspect.',
  'shared.chrome.donor.nonDonorBody':
    'Un alt element ({unit}) este cel implicit în prezent. Noile {units} moștenesc aspectul acelui element ({unit}).',
  'shared.chrome.donor.reset': 'Resetare aspect la valorile implicite',
  'shared.chrome.donor.defaultAria': 'Element implicit ({unit}) de la care noile elemente ({unit}) moștenesc aspectul',
  'shared.chrome.donor.nonDefaultAria':
    'Nu este elementul implicit ({unit}) de la care noile elemente ({unit}) moștenesc aspectul',
  'shared.chrome.donor.defaultLabel': 'Implicit: {unit}',
  'shared.chrome.donor.inheritsLabel': 'Moștenește aspectul',

  // ── Lifecycle pill ─────────────────────────────────────────────────
  'shared.chrome.lifecycle.title': 'Stările ciclului de viață',
  'shared.chrome.lifecycle.scratch': 'Schiță',
  'shared.chrome.lifecycle.scratchBody': 'Ciornă nesalvată. Nimic nu se păstrează până nu apăsați „Salvare”.',
  'shared.chrome.lifecycle.unresolved': 'Nerezolvat',
  'shared.chrome.lifecycle.unresolvedBody': 'Conține referințe {{ref}} care nu se rezolvă în sfera activă.',
  'shared.chrome.lifecycle.draft': 'Ciornă',
  'shared.chrome.lifecycle.draftBody':
    'Salvat, dar încă nu în starea Live — lipsesc câmpuri obligatorii sau nu a fost publicat încă.',
  'shared.chrome.lifecycle.live': 'Live',
  'shared.chrome.lifecycle.liveBody': 'Publicat și activ.',
} as const satisfies Catalog;
