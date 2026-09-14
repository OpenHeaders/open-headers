/**
 * Shared notifications family — Romanian. Mirrors
 * `catalogs/en/shared-notifications.ts` key for key; see that file for
 * the push-time capture rule. Mints: sugestie = suggestion; cronologie
 * = timeline; Respingere = Dismiss; Nu se mai afișează = Don't show
 * again; note de lansare = release notes; keychain / keyring raw as the
 * OS store names (keychain-ul de sistem, un backend de keyring);
 * depozitul de acreditări = credential store; the 'Open Headers' brand
 * and GitHub / Linux / GNOME Keyring / KWallet ride raw.
 */

import type { Catalog } from '../../types';

export const sharedNotifications = {
  // ── Tool window chrome ─────────────────────────────────────────────
  'shared.notifications.title': 'Notificări',
  'shared.notifications.info.summary':
    'Sugestii despre configurația dvs. și o cronologie de sesiune a evenimentelor aplicației — disponibilitatea actualizărilor, rezultatele sarcinilor din fundal și alte înștiințări, adunate aici în loc să vă întrerupă lucrul.',
  'shared.notifications.suggestionsHeading': 'Sugestii',
  'shared.notifications.timelineHeading': 'Cronologie',
  'shared.notifications.clearAll': 'Ștergere toate',
  'shared.notifications.suggestionsEmpty.title': 'Nicio sugestie',
  'shared.notifications.suggestionsEmpty.description': 'Sfaturile despre configurația dvs. vor apărea aici.',
  'shared.notifications.timelineEmpty.title': 'Nicio notificare',
  'shared.notifications.timelineEmpty.description': 'Evenimentele și actualizările aplicației vor apărea aici.',
  'shared.notifications.dismiss': 'Respingere',
  'shared.notifications.moreActions': 'Mai multe acțiuni',

  // ── Mute ("Don't show again") flow ─────────────────────────────────
  'shared.notifications.dontShowAgain': 'Nu se mai afișează',
  'shared.notifications.muted.title': 'Notificări dezactivate',
  'shared.notifications.muted.description': '„{title}” nu va mai fi afișată.',
  'shared.notifications.muted.reEnable': 'Reactivare',
  'shared.notifications.muted.reEnableTooltip': 'Permiteți acestei notificări să se afișeze din nou',

  // ── Seed nudges ────────────────────────────────────────────────────
  'shared.notifications.seed.website.title': 'Descoperiți Open Headers',
  'shared.notifications.seed.website.description':
    'Vedeți interactiv toate funcțiile noastre, plus cele mai noi actualizări.',
  'shared.notifications.seed.website.action': 'Vizitați site-ul nostru',
  'shared.notifications.seed.website.tooltip': 'Deschide site-ul și șterge notificarea',
  'shared.notifications.seed.star.title': 'Ajutați-ne să creștem',
  'shared.notifications.seed.star.description': 'Recomandați-ne prietenilor și colegilor',
  'shared.notifications.seed.star.action': 'Dați-ne o stea pe GitHub',
  'shared.notifications.seed.star.tooltip': 'Deschide GitHub și șterge notificarea',

  // ── Desktop-app suggestion (browser hosts without the companion) ───
  'shared.notifications.desktopApp.title': 'O experiență unificată',
  'shared.notifications.desktopApp.rowTerminal': 'Terminal integrat — acces complet la shell în spațiile dvs. de lucru',
  'shared.notifications.desktopApp.rowGit':
    'Control al versiunilor — commit-uri și istoric Git pentru spațiile dvs. de lucru',
  'shared.notifications.desktopApp.rowProxy': 'Capturați traficul în timp real din filele browserului sau din sistem',
  'shared.notifications.desktopApp.rowMcp':
    'Server MCP pentru asistenți AI — analiză și depanare a traficului în timp real',
  'shared.notifications.desktopApp.rowRequests':
    'Construiți și rulați cereri API native — gRPC, WebSocket, SSE și altele',
  'shared.notifications.desktopApp.action': 'Descărcare aplicație desktop',
  'shared.notifications.desktopApp.tooltip': 'Descarcă aplicația și șterge sugestia',

  // ── App-update timeline entries ────────────────────────────────────
  'shared.notifications.appUpdate.title': '{version} este disponibilă',
  'shared.notifications.appUpdate.securityTitle': 'Actualizarea de securitate {version} este disponibilă',
  'shared.notifications.appUpdate.securityDescription':
    'Această versiune remediază o problemă de securitate care afectează versiunea pe care o rulați. Actualizați cât mai curând posibil.',
  'shared.notifications.appUpdate.download': 'Descărcare…',

  // ── Update corner balloon (AppUpdateToast) ─────────────────────────
  'shared.notifications.toast.settings': 'Setări…',
  'shared.notifications.toast.dontShowAgain': 'Nu se mai afișează',
  'shared.notifications.toast.optionsTooltip': 'Dezactivați sau schimbați comportamentul',
  'shared.notifications.toast.optionsAria': 'Opțiuni pentru notificarea de actualizare',
  'shared.notifications.toast.close': 'Închidere',
  'shared.notifications.toast.upToDateTitle': 'Sunteți la zi',
  'shared.notifications.toast.upToDateDescription': '{version} este cea mai recentă versiune.',
  'shared.notifications.toast.checkFailed': 'Căutarea actualizărilor a eșuat',
  'shared.notifications.toast.downloadFailed': 'Descărcarea actualizării a eșuat',
  'shared.notifications.toast.available': '{version} este disponibilă',
  'shared.notifications.toast.update': 'Actualizare…',
  'shared.notifications.toast.packageManager': 'Actualizați prin managerul de pachete Linux.',
  'shared.notifications.toast.releaseNotes': 'Note de lansare',
  'shared.notifications.toast.readyToInstall': '{version} este gata de instalare',
  'shared.notifications.toast.restartToInstall': 'Repornire pentru instalare',
  'shared.notifications.toast.updatedTo': 'Actualizat la {version}',
  'shared.notifications.toast.seeWhatsNew': 'Vedeți noutățile',

  // ── Security-floor entry banner ────────────────────────────────────
  'shared.notifications.securityBanner.messageWithVersion':
    '{availableVersion} remediază o problemă de securitate care afectează versiunea pe care o rulați ({currentVersion}). Actualizați cât mai curând posibil.',
  'shared.notifications.securityBanner.messageNoVersion':
    'A fost publicată o remediere de securitate pentru versiunea pe care o rulați ({currentVersion}). Actualizați cât mai curând posibil.',
  'shared.notifications.securityBanner.update': 'Actualizare…',

  // ── Secrets-storage suggestion ─────────────────────────────────────
  'shared.notifications.secrets.title': 'Stocarea secretelor este blocată',
  'shared.notifications.secrets.description':
    'Secretele din Vault și tokenurile OAuth nu pot fi citite sau salvate în această sesiune. {remedy}',
  'shared.notifications.secrets.relaunch': 'Relansare aplicație',
  'shared.notifications.secrets.remedy.darwin':
    'Aplicației Open Headers i s-a refuzat accesul la keychain-ul de sistem. Relansați aplicația și permiteți accesul la keychain când vi se cere.',
  'shared.notifications.secrets.remedy.linux':
    'Nu este disponibil niciun backend de keyring utilizabil. Configurați unul (GNOME Keyring sau KWallet), apoi relansați aplicația.',
  'shared.notifications.secrets.remedy.other':
    'Open Headers nu a putut accesa depozitul de acreditări al sistemului. Relansați aplicația pentru a încerca din nou.',
} as const satisfies Catalog;
