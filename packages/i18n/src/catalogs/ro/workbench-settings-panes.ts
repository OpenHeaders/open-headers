/**
 * Workbench settings — custom pane components — Romanian. Mirrors
 * `catalogs/en/workbench-settings-panes.ts` key for key; see that file
 * for the pane rules. Raw by design: `ws://` / `wss://`, PAC / SOCKS5 /
 * SOCKS4 / NSS / certutil, SHA-256, HEAD, `--no-verify`, `git remote
 * add` / `git push -u`, workspace.yaml, claude_desktop_config.json,
 * /mcp, the port boundaries 1024 / 49152 / 65535 (protocol constants,
 * literal — never regrouped), oh / oh-license., macOS Login Items,
 * Pull / Push / Merge / Commit as the git verbs (S117), Live Workflow
 * = flux de lucru Live. Quoted OH labels copy the shipped ro files:
 * „Copie de rezervă și sincronizare › Sincronizare” (the settings
 * path — Sincronizare is the batch-4 category label), „Necesită
 * asociere verificată” (settings defs), Modul Reguli Live, the trusted
 * -roots mints depozit de încredere / autoritate de certificare, the
 * chrome mints stocare temporară = stash, Renunțare = discard,
 * emitere = mint, acordare de acces, furnizorul de identitate,
 * Administrare server (Administrare… = the tier-zero Administer…
 * row). MINTS: rotire = rotate (a token); revocare = revoke; Conectare
 * = Sign in AND Connect (ro collapses them — the pairing wizard's
 * credential step reads Autentificare so the two steps stay apart;
 * Deconectare = Sign out / Disconnect per shared-chrome); Se
 * sincronizează cu = Synced with; Unde ajung = Where they go;
 * Conectare automată = Auto-connect; Reasociere = Re-pair; Asociere
 * prin cod = Pair with a code (the button the pairing intro quotes);
 * Lipire token = Paste a token; Generare token; Asociere dispozitiv =
 * Pair a device; Dispozitive asociate = Paired devices; Sesiuni SSO;
 * Acces CLI; keychain-ul de conectare / keychain-ul de sistem = the
 * login / system keychain (a loanword enclitic); ajutor privilegiat =
 * Privileged Helper; previzualizarea rutei = Route Preview; listă de
 * excepții = bypass list; modificări fără commit = uncommitted
 * changes; ramură de salvare = rescue branch; Legare folder = Bind
 * Folder / Dezlegare = Unbind; arbore de lucru = working tree; commit
 * automat = Auto-commit; loc = seat, nivelul gratuit = the free tier,
 * perioadă de grație = grace period; fișă = keymap (harta de taste
 * rejected — Presetare de taste = the keymap preset); combinație =
 * chord. Hole shapes: `{workspaces}` / `{orgs}` / `{label}` take colon
 * frames (Eliminat: {label}; Sincronizarea pentru {orgs} s-a oprit; pe
 * acest dispozitiv rămâne: {workspaces}); the pairing intro sandwich
 * reads `Pe celălalt dispozitiv, deschideți` + [path] + `, indicați în
 * câmpul` + [Adresă backend] + `această aplicație, apoi apăsați` +
 * [button] + `și introduceți:`; the remove-body sandwich `Această
 * conexiune furnizează` + [orgs] + `și are sincronizate pe acest
 * dispozitiv: {workspaces}. …`; the fallback `Nu există opțiunea` +
 * [button] + `pe acel dispozitiv? …`; the discardStayedTitle template
 * reads `Eliminat: ${label}, dar {count} spațiu de lucru a rămas /
 * spații de lucru au rămas / de spații de lucru au rămas`; git holes
 * take head nouns (ramura {branch}, procesul {pid}, Git {version}
 * găsit, La fiecare {minutes} min, {upstream}: înainte cu {ahead}, în
 * urmă cu {behind}).
 */

import { formatMessage, plural } from '../../runtime';
import type { Catalog } from '../../types';

export const workbenchSettingsPanes = {
  // ── Backend pane body ──────────────────────────────────────────────
  'workbench.settings.backendPane.learnMore': 'Aflați mai multe',
  'workbench.settings.backendPane.rowMenuAria': 'Acțiuni pentru {label}',
  'workbench.settings.backendPane.tierZero.title.extension': 'Acest browser',
  'workbench.settings.backendPane.tierZero.title.desktop': 'Acest computer',
  'workbench.settings.backendPane.tierZero.title.web': 'Acest server',
  'workbench.settings.backendPane.tierZero.copy.extension':
    'Spațiile dvs. de lucru se află aici. Copiile de rezervă și sincronizarea trec doar prin locurile de mai jos.',
  'workbench.settings.backendPane.tierZero.copy.desktop':
    'Spațiile dvs. de lucru se află în aplicația desktop de pe acest computer. Copiile de rezervă și sincronizarea trec doar prin locurile de mai jos.',
  'workbench.settings.backendPane.tierZero.copy.web':
    'Spațiile dvs. de lucru se află pe acest server. Fiecare browser și dispozitiv care se conectează aici lucrează pe aceleași copii.',
  'workbench.settings.backendPane.tierZero.alwaysOn': 'Mereu activ',
  'workbench.settings.backendPane.tierZero.administer': 'Administrare…',
  'workbench.settings.backendPane.wizard.step.connect': 'Conectare',
  'workbench.settings.backendPane.wizard.editTitle': 'Editare {label}',
  'workbench.settings.backendPane.wizard.title.desktop': 'Conectare aplicație desktop',
  'workbench.settings.backendPane.wizard.title.server': 'Conectare la un server',
  'workbench.settings.backendPane.wizard.step.address': 'Adresă',
  'workbench.settings.backendPane.wizard.step.signIn': 'Autentificare',
  'workbench.settings.backendPane.wizard.connect': 'Conectare',
  'workbench.settings.backendPane.wizard.checkAgain': 'Verificare din nou',
  'workbench.settings.backendPane.wizard.checking': 'Se verifică gazda {host}…',
  'workbench.settings.backendPane.wizard.verdict.needsPairing': 'Gazda {host} cere conectarea acestui dispozitiv.',
  'workbench.settings.backendPane.wizard.verdict.signedIn': 'Conectat la {name}.',
  'workbench.settings.backendPane.wizard.verdict.signedInUnnamed': 'Conectat.',
  'workbench.settings.backendPane.wizard.verdict.signedInAs': 'Conectat ca {person} · {name}.',
  'workbench.settings.backendPane.wizard.verdict.signedInAsUnnamed': 'Conectat ca {person}.',
  'workbench.settings.backendPane.wizard.signIn.primary': 'Conectare pe {host}',
  'workbench.settings.backendPane.wizard.signIn.intro':
    'O pagină de pe {host} se deschide în browserul dvs. Conectați-vă acolo cu propriul cont și aprobați acest dispozitiv — aici nu se tastează nimic.',
  'workbench.settings.backendPane.wizard.signIn.codeLabel': 'Cod de conectare',
  'workbench.settings.backendPane.wizard.signIn.waiting': 'Se așteaptă să aprobați acest dispozitiv în browser…',
  'workbench.settings.backendPane.wizard.signIn.openAgain': 'Redeschidere pagină',
  'workbench.settings.backendPane.wizard.signIn.waitingBrowser':
    'Finalizați conectarea în browser, apoi reveniți aici…',
  'workbench.settings.backendPane.wizard.signIn.linkHint':
    'Browserul nu s-a deschis? Deschideți acest link în orice browser:',
  'workbench.settings.backendPane.wizard.signIn.tryAgain': 'Reîncercare',
  'workbench.settings.backendPane.wizard.signIn.cancelSignIn': 'Anulare conectare',
  'workbench.settings.backendPane.wizard.signIn.unclaimed':
    'Acest server nu are încă un administrator. Configurați-l mai întâi la {url}, apoi conectați-vă de aici.',
  'workbench.settings.backendPane.wizard.signIn.noLogin':
    'Nimeni nu se poate conecta la {host} dintr-un browser, așa că un cod de asociere sau un token de la administratorul său este singura cale.',
  'workbench.settings.backendPane.wizard.signIn.secondary':
    'Aveți un cod de asociere sau un token de la un administrator?',
  'workbench.settings.backendPane.wizard.signIn.fail.denied': 'Conectarea a fost refuzată pe pagina serverului.',
  'workbench.settings.backendPane.wizard.signIn.fail.expired':
    'Cererea de conectare a expirat înainte de a fi aprobată.',
  'workbench.settings.backendPane.wizard.signIn.fail.lost':
    'Serverul nu mai păstrează această cerere de conectare. Porniți-o din nou.',
  'workbench.settings.backendPane.wizard.signIn.fail.abandoned':
    'Conectarea nu s-a finalizat în browser. Încercați din nou.',
  'workbench.settings.backendPane.wizard.signIn.fail.tooManyPending':
    'Gazda {host} are prea multe conectări în așteptare. Reîncercați peste câteva minute.',
  'workbench.settings.backendPane.wizard.signIn.fail.throttled':
    'Gazda {host} refuză deocamdată cererile de la acest dispozitiv. Reîncercați mai târziu.',
  'workbench.settings.backendPane.wizard.signIn.fail.forbidden':
    'Gazda {host} a refuzat cererea de conectare a acestui dispozitiv.',
  'workbench.settings.backendPane.wizard.signIn.fail.offline': 'Nimic nu a răspuns la {host}. Rulează la acea adresă?',
  'workbench.settings.backendPane.wizard.signIn.fail.generic': 'Conectarea nu a putut fi pornită. Reîncercați.',
  'workbench.settings.backendPane.wizard.next': 'Înainte',
  'workbench.settings.backendPane.wizard.connectIntro':
    'Adresa la care se conectează acest dispozitiv. Nimic nu se conectează până când ultimul pas nu o verifică.',
  'workbench.settings.backendPane.wizard.autoPairFallback':
    'Asocierea automată cu aplicația desktop nu a reușit — este posibil să nu ruleze sau acest browser nu a putut fi verificat. Asociați în schimb cu codul sau cu tokenul.',
  'workbench.settings.backendPane.wizard.readyIntroPaired':
    'Pregătit: {label} la {url}, autentificat. Conectarea verifică mai întâi adresa și autentificarea; apoi spațiile ei de lucru se sincronizează local și rămân utilizabile offline.',
  'workbench.settings.backendPane.wizard.readyIntroPairedUnnamed':
    'Pregătit: {url}, autentificat. Conectarea verifică mai întâi adresa și autentificarea; apoi spațiile ei de lucru se sincronizează local și rămân utilizabile offline.',
  'workbench.settings.backendPane.wizard.additionalConnection':
    'Aceasta este o conexiune suplimentară. Spațiile ei de lucru apar ca un grup nou în comutatorul de spații de lucru, popover-ul de stare primește un rând pentru ea și fiecare grup se sincronizează dintr-un singur loc — un grup furnizat deja de altă conexiune nu se alătură de două ori.',
  'workbench.settings.backendPane.wizard.disableFirst':
    'Conexiunea {label} este activă. Editarea conexiunii înseamnă mutarea unui fir viu, așa că se deconectează mai întâi — setările și asocierea se păstrează, iar reactivarea verifică noua configurație înainte ca ceva să se conecteze.',
  'workbench.settings.backendPane.wizard.disconnectEdit': 'Deconectare și editare',

  // ── Backend pane: connections list ─────────────────────────────────
  'workbench.settings.backendPane.connections.title': 'Se sincronizează cu',
  'workbench.settings.backendPane.connections.connectDesktop': 'Conectare aplicație desktop',
  'workbench.settings.backendPane.connections.signInServer': 'Conectare la un server…',
  'workbench.settings.backendPane.connections.emptyDesktopLine':
    'Sincronizare între browserele de pe acest computer: conectați aplicația desktop.',
  'workbench.settings.backendPane.connections.emptyServerLine':
    'Sincronizare între dispozitivele dvs. sau cu o echipă: conectați-vă la un OpenHeaders Server.',
  'workbench.settings.backendPane.connections.menu.connect': 'Conectare',
  'workbench.settings.backendPane.connections.menu.disconnect': 'Deconectare',
  'workbench.settings.backendPane.connections.menu.edit': 'Editare…',
  'workbench.settings.backendPane.connections.menu.remove': 'Eliminare…',
  'workbench.settings.backendPane.connections.place.desktopApp': 'Aplicația desktop de pe acest computer',
  'workbench.settings.backendPane.placement.section': 'Spații de lucru noi',
  'workbench.settings.backendPane.placement.label': 'Unde ajung',
  'workbench.settings.backendPane.placement.description':
    'Puteți schimba oricând. Spațiile de lucru existente rămân unde sunt.',
  'workbench.settings.backendPane.connections.writeFailed': 'Conexiunea nu a putut fi salvată',
  'workbench.settings.backendPane.connections.status.connected': 'Conectat',
  'workbench.settings.backendPane.connections.status.connecting': 'Se conectează…',
  'workbench.settings.backendPane.connections.status.authRequired': 'Necesită reasociere',
  'workbench.settings.backendPane.connections.status.error': 'Conexiune căzută',
  'workbench.settings.backendPane.connections.status.off': 'Dezactivat',
  'workbench.settings.backendPane.connections.repair': 'Reasociere',
  'workbench.settings.backendPane.connections.autoConnect': 'Conectare automată',
  'workbench.settings.backendPane.connections.orgConflict':
    'Org „{org}” este furnizată deja de {provider} — nu s-a alăturat',
  'workbench.settings.backendPane.connections.removedBackend': 'o conexiune eliminată',

  // ── Backend pane: probe-gated enable ───────────────────────────────
  'workbench.settings.backendPane.enable.connectingTo': 'Se conectează la {label}…',
  'workbench.settings.backendPane.enable.connected': 'Conectat la {label}.',
  'workbench.settings.backendPane.enable.orgNotJoined':
    'Conexiunea {label} este activă, dar Org-ul ei nu s-a alăturat — vedeți rândul conexiunii.',

  // ── Backend pane: remove flow ──────────────────────────────────────
  'workbench.settings.backendPane.remove.confirmTitle': 'Eliminare {label}?',
  'workbench.settings.backendPane.remove.confirmBody':
    'Adresa și asocierea ei sunt uitate. Nu s-a sincronizat încă nimic de la ea.',
  'workbench.settings.backendPane.remove.aria': 'Eliminare {label}',
  'workbench.settings.backendPane.remove.removed': 'Eliminat: {label}.',
  'workbench.settings.backendPane.remove.workspaceCount': ({ count }, locale) =>
    plural(locale, Number(count), {
      one: '{count} spațiu de lucru',
      few: '{count} spații de lucru',
      other: '{count} de spații de lucru',
    }),
  'workbench.settings.backendPane.remove.body.prefix': 'Această conexiune furnizează',
  'workbench.settings.backendPane.remove.body.suffix':
    'și are sincronizate pe acest dispozitiv: {workspaces}. Datele ei proprii nu sunt atinse niciodată — alegeți ce se întâmplă cu copiile locale.',
  'workbench.settings.backendPane.remove.outcomeAria': 'Rezultatul eliminării',
  'workbench.settings.backendPane.remove.recommendedBadge': 'Recomandat',
  'workbench.settings.backendPane.remove.keep.title': 'Păstrare copii locale',
  'workbench.settings.backendPane.remove.keep.description':
    'Sincronizarea pentru {orgs} se oprește. Pe acest dispozitiv rămân ca date locale offline: {workspaces}.',
  'workbench.settings.backendPane.remove.discard.title': 'Renunțare la copiile locale',
  'workbench.settings.backendPane.remove.discard.description':
    'Fiecare spațiu de lucru este mai întâi salvat ca fișier descărcat, apoi șters de pe acest dispozitiv. O reconectare ulterioară le sincronizează din nou local.',
  'workbench.settings.backendPane.remove.discard.includeSecrets':
    'Includere secrete din vault în fișierele de rezervă (text clar — păstrați fișierele în siguranță)',
  'workbench.settings.backendPane.remove.removeBackend': 'Eliminare conexiune',
  'workbench.settings.backendPane.remove.backupThenRemove': 'Copie de rezervă, apoi eliminare',
  'workbench.settings.backendPane.remove.progress.removing': 'Se elimină conexiunea…',
  'workbench.settings.backendPane.remove.progress.preparing': 'Se pregătesc copiile de rezervă…',
  'workbench.settings.backendPane.remove.progress.backingUp': 'Se salvează copia de rezervă „{name}”…',
  'workbench.settings.backendPane.remove.progress.deleting': 'Se șterge „{name}”…',
  'workbench.settings.backendPane.remove.keepDone':
    'Eliminat: {label}. Sincronizarea pentru {orgs} s-a oprit; pe acest dispozitiv rămâne: {workspaces}.',
  'workbench.settings.backendPane.remove.discardDone':
    'Eliminat: {label}. Salvate și șterse: {workspaces}; dezlegate: {orgs}.',
  'workbench.settings.backendPane.remove.discardStayedTitle': ({ label, count }, locale) =>
    plural(locale, Number(count), {
      one: `Eliminat: ${String(label)}, dar {count} spațiu de lucru a rămas`,
      few: `Eliminat: ${String(label)}, dar {count} spații de lucru au rămas`,
      other: `Eliminat: ${String(label)}, dar {count} de spații de lucru au rămas`,
    }),
  'workbench.settings.backendPane.remove.discardStayedBody': 'Nu s-au putut șterge: {names}. Rămân ca date locale.',
  'workbench.settings.backendPane.remove.backupFailedTitle': 'Copia de rezervă „{name}” a eșuat',
  'workbench.settings.backendPane.remove.backupFailedBody': 'Exportul nu s-a încheiat. Nimic nu a fost eliminat.',

  // ── Backend pane: pair with a code ─────────────────────────────────
  'workbench.settings.backendPane.pair.pairWithCode': 'Asociere prin cod',
  'workbench.settings.backendPane.pair.pasteTokenTitle': 'Lipire token',
  'workbench.settings.backendPane.pair.codeBlurb':
    'Introduceți codul afișat pe aplicația desktop sau pe server. Este schimbat pe un token care conectează acest dispozitiv.',
  'workbench.settings.backendPane.pair.tokenBlurb':
    'Lipiți tokenul afișat pe aplicația desktop sau pe server — o rotire afișează noul secret o singură dată. Este salvat ca acreditare a acestui dispozitiv.',
  'workbench.settings.backendPane.pair.codePlaceholder': 'Cod din 6 cifre',
  'workbench.settings.backendPane.pair.deviceNamePlaceholder': 'Nume dispozitiv (opțional)',
  'workbench.settings.backendPane.pair.codeRequired':
    'Introduceți codul de asociere afișat pe aplicația desktop sau pe server.',
  'workbench.settings.backendPane.pair.pasteTokenRequired': 'Lipiți tokenul afișat pe aplicația desktop sau pe server.',
  'workbench.settings.backendPane.pair.pairAction': 'Asociere',
  'workbench.settings.backendPane.pair.saveToken': 'Salvare token',
  'workbench.settings.backendPane.pair.tokenSaved': 'Tokenul de autentificare a fost salvat.',
  'workbench.settings.backendPane.pair.pairedSaved': 'Asociat — tokenul de autentificare a fost salvat.',
  'workbench.settings.backendPane.pair.switchToToken': 'Aveți un token? Lipiți-l în schimb',
  'workbench.settings.backendPane.pair.switchToCode': 'Aveți mai degrabă un cod de asociere?',
  'workbench.settings.backendPane.pair.fail.unknown':
    'Acest cod este necunoscut sau a expirat. Cereți un cod nou și încercați din nou.',
  'workbench.settings.backendPane.pair.fail.expired':
    'Acest cod de asociere a expirat. Generați unul nou pe aplicația desktop sau pe server.',
  'workbench.settings.backendPane.pair.fail.consumed':
    'Acest cod a fost deja folosit. Generați unul nou pe aplicația desktop sau pe server.',
  'workbench.settings.backendPane.pair.fail.unreachable': 'Nimic nu a răspuns la {url}. Rulează ceva la acea adresă?',
  'workbench.settings.backendPane.pair.fail.generic': 'Asocierea a eșuat. Încercați din nou.',
  'workbench.settings.backendPane.pair.nmRequired':
    'Asocierea manuală cu aplicația desktop este dezactivată — acest browser se conectează doar prin asociere verificată. Vedeți setarea „Necesită asociere verificată”.',

  // ── Backend pane: record field editors ─────────────────────────────
  'workbench.settings.backendPane.field.label.label': 'Nume',
  'workbench.settings.backendPane.field.label.description':
    'Cum se numește această conexiune în aplicație. Implicit, adresa ei.',
  'workbench.settings.backendPane.field.label.placeholder': 'VM de lucru',
  'workbench.settings.backendPane.field.label.aria': 'Numele conexiunii',
  'workbench.settings.backendPane.field.url.label': 'Adresa serverului',
  'workbench.settings.backendPane.field.url.description':
    'Adresa sau adresa URL primită de la administrator. `http` sau `ws` pentru acest computer sau rețeaua dvs., `https` sau `wss` pentru un server la distanță.',
  'workbench.settings.backendPane.field.url.invalid': 'Introduceți un host, host:port sau o adresă URL.',
  'workbench.settings.backendPane.field.auth.label': 'Autentificare',
  'workbench.settings.backendPane.field.auth.description':
    'Cum se autentifică acest dispozitiv. Asociați prin cod sau lipiți direct un token.',
  'workbench.settings.backendPane.field.auth.codeAria': 'Cod de asociere',
  'workbench.settings.backendPane.field.auth.tokenAria': 'Token de autentificare',
  'workbench.settings.backendPane.field.auth.tokenPlaceholder': 'Lipiți un token',
  'workbench.settings.backendPane.field.auth.paired': 'Asociat — tokenul de acces a fost salvat',
  'workbench.settings.backendPane.field.auth.useToken': 'Folosire token de autentificare în schimb',
  'workbench.settings.backendPane.field.auth.useCode': 'Asociere prin cod în schimb',

  // ── Backend pane: port validation hints ────────────────────────────
  // The IANA boundary numbers (1024 / 49152 / 65535) are protocol
  // constants, embedded literally rather than interpolated.
  'workbench.settings.backendPane.port.missing': 'Introduceți un port.',
  'workbench.settings.backendPane.port.notInteger': 'Portul trebuie să fie un număr întreg.',
  'workbench.settings.backendPane.port.privileged':
    'Porturile sub 1024 sunt privilegiate și necesită permisiuni ridicate — alegeți 1024 sau mai mare.',
  'workbench.settings.backendPane.port.aboveMax': 'Portul trebuie să fie cel mult 65535.',
  'workbench.settings.backendPane.port.ephemeral':
    'Porturile 49152–65535 sunt intervalul pe care sistemul de operare îl alocă conexiunilor de ieșire; un ascultător de aici poate eșua intermitent la legare. Un port din 1024–49151 este mai fiabil.',

  // ── Backend pane: LAN-peers confirm ────────────────────────────────
  'workbench.settings.backendPane.lan.confirmTitle': 'Permiteți peerii din LAN?',
  'workbench.settings.backendPane.lan.confirmOk': 'Permitere peeri din LAN',
  'workbench.settings.backendPane.lan.confirmCancel': 'Păstrare doar loopback',
  'workbench.settings.backendPane.lan.confirmBody':
    'Aplicația desktop va asculta pe fiecare interfață de rețea locală, astfel încât alte dispozitive din rețeaua dvs. să se poată conecta. Fiecare conexiune, din rețea sau de pe acest computer, trebuie să prezinte un token asociat; nu există nicio cale fără token. Dispozitivele se asociază cu codul afișat de aplicație (sau lipesc un token în Copie de rezervă și sincronizare › Sincronizare).',

  // ── Backend pane: offline fallback order ───────────────────────────
  'workbench.settings.backendPane.fallback.empty':
    'Nicio gazdă nu s-a înscris încă. Un browser se alătură acestei liste odată ce deține semințele unui flux de lucru Live exclusiv din acest spațiu de lucru.',
  'workbench.settings.backendPane.fallback.saveFailed': 'Noua ordine nu a putut fi salvată',
  'workbench.settings.backendPane.fallback.removeFailed': 'Gazda nu a putut fi eliminată',
  'workbench.settings.backendPane.fallback.dragAria': 'Trageți pentru reordonare',
  'workbench.settings.backendPane.fallback.selfTag': 'Acest browser',
  'workbench.settings.backendPane.fallback.pruneTitle': 'Eliminați această gazdă?',
  'workbench.settings.backendPane.fallback.pruneBody':
    'Se alătură din nou automat dacă încă deține semințele unui flux de lucru exclusiv.',

  // ── Keymap pane body ───────────────────────────────────────────────
  'workbench.settings.keymapPane.searchPlaceholder': 'Căutare scurtături',
  'workbench.settings.keymapPane.noMatches': 'Nicio scurtătură nu se potrivește cu căutarea dvs.',
  'workbench.settings.keymapPane.recording': 'Apăsați tastele…',
  'workbench.settings.keymapPane.unbound': 'Neasociată',
  'workbench.settings.keymapPane.recordTip': 'Apăsați pentru a înregistra o scurtătură nouă',
  'workbench.settings.keymapPane.recordAria': 'Schimbare scurtătură pentru {label}',
  'workbench.settings.keymapPane.unbind': 'Eliminare scurtătură',
  'workbench.settings.keymapPane.unbindAria': 'Eliminare scurtătură pentru {label}',
  'workbench.settings.keymapPane.resetAria': 'Resetare scurtătură pentru {label}',
  'workbench.settings.keymapPane.conflictSummary': ({ count }, locale) =>
    plural(locale, Number(count), {
      one: '{count} scurtătură are o atribuire în conflict',
      few: '{count} scurtături au atribuiri în conflict',
      other: '{count} de scurtături au atribuiri în conflict',
    }),
  'workbench.settings.keymapPane.conflictShowOnly': 'Afișare conflicte',
  'workbench.settings.keymapPane.conflictShowAll': 'Afișare toate scurtăturile',
  'workbench.settings.keymapPane.conflictBadgeAria': 'Conflict de scurtături',
  'workbench.settings.keymapPane.conflictTooltip': 'Atribuită și pentru: {labels}',
  'workbench.settings.keymapPane.reservedBadgeAria': 'Scurtătură rezervată',
  'workbench.settings.keymapPane.reservedBrowser':
    'Browserul rezervă această scurtătură — poate acționa asupra ei înainte să ajungă la aplicație.',
  'workbench.settings.keymapPane.reservedSystem':
    'Sistemul de operare rezervă această scurtătură — poate acționa asupra ei înainte să ajungă la aplicație.',
  'workbench.settings.keymapPane.lookupTip': 'Găsiți acțiunile apăsându-le scurtătura',
  'workbench.settings.keymapPane.lookupAria': 'Găsire acțiune după scurtătură',
  'workbench.settings.keymapPane.lookupEmpty': 'Nicio acțiune nu este asociată cu {chord}.',
  'workbench.settings.keymapPane.conflictPrompt': '{chord} este atribuită deja pentru: {labels}',
  'workbench.settings.keymapPane.conflictReassign': 'Reatribuire',
  'workbench.settings.keymapPane.conflictKeepBoth': 'Păstrare ambele',
  'workbench.settings.keymapPane.presetAria': 'Presetare de taste',
  'workbench.settings.keymapPane.presetSection': 'Presetare de taste',
  'workbench.settings.keymapPane.presetRestore': ({ count }, locale) =>
    plural(locale, Number(count), {
      one: 'Restaurare presetare ({count} personalizare)',
      few: 'Restaurare presetare ({count} personalizări)',
      other: 'Restaurare presetare ({count} de personalizări)',
    }),
  'workbench.settings.keymapPane.presetRestoreTip': 'Readuce fiecare scurtătură personalizată la presetarea activă.',

  // ── Daemon token ledger (shared by Backend + MCP panes) ────────────
  'workbench.settings.backendTokens.sectionTitle': 'Dispozitive asociate',
  'workbench.settings.backendTokens.sectionBlurb':
    'Fiecare dispozitiv care se conectează la acest backend se autentifică cu un token de acces. Dispozitivele conectate sunt evidențiate; rotiți un token pentru a emite un secret nou și a-l retrage pe cel vechi.',
  'workbench.settings.backendTokens.labelPlaceholder': 'Etichetă (opțional) — de ex. „telefonul Anei”',
  'workbench.settings.backendTokens.bindUserPlaceholder': 'Legare de utilizator (opțional)',
  'workbench.settings.backendTokens.generate': 'Generare token',
  'workbench.settings.backendTokens.pairDevice': 'Asociere dispozitiv',
  'workbench.settings.backendTokens.explainer.intro': 'Ambele adaugă un token mai jos.',
  'workbench.settings.backendTokens.explainer.generateText':
    'vă afișează secretul, pe care îl copiați și îl lipiți chiar dvs. pe dispozitiv.',
  'workbench.settings.backendTokens.explainer.pairText':
    'afișează un cod scurt pe care dispozitivul îl introduce la Copie de rezervă și sincronizare › Sincronizare › Asociere prin cod (sau deschide un link, ca soluție de rezervă) — folosiți-l când altcineva configurează dispozitivul.',
  'workbench.settings.backendTokens.empty':
    'Niciun dispozitiv încă. Generați un token și lipiți-l în Copie de rezervă și sincronizare › Sincronizare de pe dispozitiv sau asociați un dispozitiv și puneți-l să introducă acolo codul.',
  'workbench.settings.backendTokens.mintFailed': 'Emiterea tokenului a eșuat: {message}',
  'workbench.settings.backendTokens.rotateFailed': 'Rotirea a eșuat: {message}',
  'workbench.settings.backendTokens.revokeFailed': 'Revocarea a eșuat: {message}',
  'workbench.settings.backendTokens.revokedDevice':
    'Token revocat. Orice dispozitiv care îl folosea a fost deconectat.',
  'workbench.settings.backendTokens.revokedSession': 'Sesiune revocată. Utilizatorul a fost deconectat.',
  'workbench.settings.backendTokens.rotate': 'Rotire',
  'workbench.settings.backendTokens.revoke': 'Revocare',
  'workbench.settings.backendTokens.rotateConfirmTitle': 'Rotiți acest token?',
  'workbench.settings.backendTokens.rotateConfirmBody':
    'Se emite un secret nou, iar cel curent este revocat. Dispozitivul trebuie să primească noul token înainte de a se putea reconecta.',
  'workbench.settings.backendTokens.revokeConfirmTitle': 'Revocați acest token?',
  'workbench.settings.backendTokens.revokeConfirmBody':
    'Orice dispozitiv care îl folosește acum este deconectat imediat și nu se mai poate reconecta.',
  'workbench.settings.backendTokens.revokeSessionConfirmTitle': 'Revocați această sesiune?',
  'workbench.settings.backendTokens.revokeSessionConfirmBody':
    'Utilizatorul este deconectat imediat. Trebuie să se autentifice din nou prin furnizorul de identitate.',
  'workbench.settings.backendTokens.revokedTag': 'Revocat {when}',
  'workbench.settings.backendTokens.connectedTag': 'Conectat',
  'workbench.settings.backendTokens.expiredTag': 'Expirat',
  'workbench.settings.backendTokens.unlabeled': '(fără etichetă)',
  'workbench.settings.backendTokens.unbound': '(nelegat)',
  'workbench.settings.backendTokens.meta.device': 'id {id} · creat {created} · ultima utilizare {lastUsed}',
  'workbench.settings.backendTokens.meta.boundUser': 'utilizator {user}',
  'workbench.settings.backendTokens.meta.session':
    'autentificat {signedIn} · expiră {expires} · văzut ultima dată {lastSeen} · id {id}',
  'workbench.settings.backendTokens.ssoTitle': 'Sesiuni SSO',
  'workbench.settings.backendTokens.ssoBlurb':
    'Fiecare autentificare SSO emite o sesiune care expiră de la sine. Revocați una pentru a deconecta utilizatorul imediat — trebuie să se autentifice din nou prin furnizorul de identitate.',
  'workbench.settings.backendTokens.secretTitle': 'Copiați acest token acum',
  'workbench.settings.backendTokens.secretTitleRotated': 'Copiați tokenul rotit acum',
  'workbench.settings.backendTokens.secretBody':
    'Backend-ul stochează doar un hash al acestei valori. Odată închis acest dialog, secretul nu mai poate fi recuperat — dacă îl pierdeți, revocați tokenul și emiteți unul nou.',
  'workbench.settings.backendTokens.secretBodyRotated':
    'Tokenul anterior este acum revocat — dați acest secret nou dispozitivului, ca să se poată reconecta. Backend-ul stochează doar un hash al acestei valori. Odată închis acest dialog, secretul nu mai poate fi recuperat — dacă îl pierdeți, revocați tokenul și emiteți unul nou.',
  'workbench.settings.backendTokens.secretSaved': 'L-am salvat',

  // ── Daemon pairing modal ────────────────────────────────────────────
  'workbench.settings.backendTokens.pairModal.done': 'Gata',
  'workbench.settings.backendTokens.pairModal.allocating': 'Se alocă codul…',
  'workbench.settings.backendTokens.pairModal.startFailed': 'Asocierea nu a putut fi pornită',
  'workbench.settings.backendTokens.pairModal.expiredTitle': 'Asocierea a expirat',
  'workbench.settings.backendTokens.pairModal.expiredBody':
    'Fereastra de 5 minute s-a scurs fără confirmare. Închideți acest dialog și apăsați din nou Asociere dispozitiv pentru a o lua de la capăt.',
  'workbench.settings.backendTokens.pairModal.pairedTitle': 'Asociat',
  'workbench.settings.backendTokens.pairModal.pairedBody':
    'Dispozitivul a confirmat codul. Un token de acces nou a fost emis și salvat pe acel dispozitiv; apare în lista de mai jos. Dacă dispozitivul nu se poate conecta, revocați intrarea și asociați din nou.',
  'workbench.settings.backendTokens.pairModal.intro.part1': 'Pe celălalt dispozitiv, deschideți',
  'workbench.settings.backendTokens.pairModal.intro.settingsPath': 'Copie de rezervă și sincronizare › Sincronizare',
  'workbench.settings.backendTokens.pairModal.intro.part2': ', indicați în câmpul',
  'workbench.settings.backendTokens.pairModal.intro.address': 'Adresă backend',
  'workbench.settings.backendTokens.pairModal.intro.part3': 'această aplicație, apoi apăsați',
  'workbench.settings.backendTokens.pairModal.intro.part4': 'și introduceți:',
  'workbench.settings.backendTokens.pairModal.codeLabel': 'Cod de asociere',
  'workbench.settings.backendTokens.pairModal.expiresIn': 'expiră în {remaining}',
  'workbench.settings.backendTokens.pairModal.addressListLabel': 'Adresa backend a acestei aplicații',
  'workbench.settings.backendTokens.pairModal.fallback.prefix': 'Nu există opțiunea',
  'workbench.settings.backendTokens.pairModal.fallback.suffix':
    'pe acel dispozitiv? Deschideți acolo, în schimb, unul dintre aceste linkuri — servește o pagină care predă un token de lipit manual.',

  // ── Command-line access card (MCP pane) ────────────────────────────
  'workbench.settings.cliAccess.sectionTitle': 'Acces CLI',
  'workbench.settings.cliAccess.sectionBlurb':
    'Un singur clic conectează instrumentul de linie de comandă oh de pe acest computer la aplicație — un token de acces este creat și salvat pentru el, fără copiere.',
  'workbench.settings.cliAccess.statusUnconfigured': 'Instrumentul CLI de pe acest computer nu este conectat încă.',
  'workbench.settings.cliAccess.statusConfigured': 'CLI conectat ca {label}.',
  'workbench.settings.cliAccess.statusStale':
    'Tokenul CLI salvat nu mai este valid — configurați din nou accesul pentru reconectare.',
  'workbench.settings.cliAccess.statusExternal':
    'Instrumentul CLI este conectat în prezent la alt backend ({url}). Configurarea accesului aici îl îndreaptă în schimb către această aplicație.',
  'workbench.settings.cliAccess.statusMalformed': 'Fișierul de configurare CLI nu poate fi citit: {message}',
  'workbench.settings.cliAccess.pathNote': 'Salvat în {path}',
  'workbench.settings.cliAccess.setUp': 'Configurare acces CLI',
  'workbench.settings.cliAccess.rotate': 'Rotire acces CLI',
  'workbench.settings.cliAccess.connectHere': 'Conectare la această aplicație',
  'workbench.settings.cliAccess.provisioned':
    'Acces CLI configurat — oh funcționează acum în orice terminal de pe acest computer.',
  'workbench.settings.cliAccess.rotated': 'Token CLI rotit — tokenul anterior este revocat.',
  'workbench.settings.cliAccess.provisionFailed': 'Configurarea CLI a eșuat: {message}',

  // ── MCP pane body ──────────────────────────────────────────────────
  'workbench.settings.mcpPane.connect.title': 'Conectare client',
  'workbench.settings.mcpPane.connect.blurb':
    'Alegeți clientul, înlocuiți substituentul tokenului cu un token de acces și ajustați calea aplicației dacă ați instalat-o în altă parte. Aplicația trebuie să ruleze pentru ca clienții să se poată conecta.',
  'workbench.settings.mcpPane.tokensHome': 'Tokenurile de acces se emit și se revocă la',
  'workbench.settings.mcpPane.snippet.claudeDesktopTitle': 'claude_desktop_config.json — îmbinați în fișierul existent',
  'workbench.settings.mcpPane.snippet.runOnceTitle': 'Rulați o dată într-un terminal',
  'workbench.settings.mcpPane.snippet.cliTitle':
    'Rulați o dată într-un terminal — rulările oh ulterioare nu au nevoie de indicatori',
  'workbench.settings.mcpPane.snippet.httpTitle': 'Pentru clienții care vorbesc direct HTTP streamable',

  // ── MCP consent (Add-ons popover dialog + TUI-gate checkbox info) ──
  'workbench.settings.mcpConsent.title': 'Activați serverul MCP',
  'workbench.settings.mcpConsent.body':
    'Clienții-agent și interfața oh TUI comunică cu această aplicație prin serverul MCP, care este momentan dezactivat.',
  'workbench.settings.mcpConsent.info.title': 'Server MCP',
  'workbench.settings.mcpConsent.info.summary':
    'Clienții MCP ajung la această aplicație prin punctul final /mcp al backend-ului (Model Context Protocol peste HTTP streamable). Setarea mcp.enabled controlează acel punct final — cât timp este dezactivată, punctul final returnează 404. Clienții se autentifică cu aceleași tokenuri de acces ca orice altă conexiune.',
  'workbench.settings.mcpConsent.ok': 'Activare',

  // ── License pane body ──────────────────────────────────────────────
  'workbench.settings.licensePane.invalid.malformed': 'Fișierul instalat nu este o cheie de licență.',
  'workbench.settings.licensePane.invalid.schema-mismatch':
    'Licența instalată nu corespunde niciunei scheme acceptate de această versiune.',
  'workbench.settings.licensePane.invalid.unknown-kid':
    'Licența instalată este semnată cu o cheie în care acest build nu are încredere.',
  'workbench.settings.licensePane.invalid.bad-signature':
    'Licența instalată a picat verificarea semnăturii — textul a fost modificat după semnare.',
  'workbench.settings.licensePane.installed': 'Licență instalată',
  'workbench.settings.licensePane.removed': 'Licență eliminată — înapoi la nivelul gratuit',
  'workbench.settings.licensePane.removeFailed': 'Eliminarea licenței a eșuat: {message}',
  'workbench.settings.licensePane.freeTier.title': 'Nivelul gratuit',
  'workbench.settings.licensePane.freeTier.body':
    'Tot ce oferă Open Headers astăzi este inclus — nivelul gratuit admite până la {limit} utilizatori activi per server. Instalați o cheie de licență pentru a ridica limita de locuri.',
  'workbench.settings.licensePane.invalidAlert.title': 'Licența instalată nu poate fi folosită',
  'workbench.settings.licensePane.invalidAlert.body':
    'Aplicația continuă să ruleze la nivelul gratuit (până la {limit} utilizatori activi). Lipiți o cheie nouă mai jos sau contactați asistența.',
  'workbench.settings.licensePane.grace.title': 'Licență expirată — perioadă de grație activă',
  'workbench.settings.licensePane.grace.body':
    'Această licență a expirat la {expiredOn}. Reînnoiți înainte de {graceEndsOn} — după aceea, crearea sau reactivarea utilizatorilor revine la limita gratuită de {limit}. Utilizatorii existenți se pot autentifica în continuare și nicio dată nu este afectată vreodată.',
  'workbench.settings.licensePane.expired.title': 'Licența și perioada de grație s-au încheiat',
  'workbench.settings.licensePane.expired.body':
    'Crearea și reactivarea utilizatorilor urmează acum limita gratuită de {limit} utilizatori activi. Utilizatorii existenți se pot autentifica în continuare, spațiile de lucru existente funcționează în continuare și nicio dată nu este afectată vreodată. Instalați o cheie reînnoită pentru a restaura numărul de locuri licențiat.',
  'workbench.settings.licensePane.getLicenseCta': 'Obținere licență',
  'workbench.settings.licensePane.renewLicenseCta': 'Reînnoire licență',
  'workbench.settings.licensePane.detailsSection': 'Licență',
  'workbench.settings.licensePane.detail.licensedTo': 'Licențiat pentru',
  'workbench.settings.licensePane.detail.contact': 'Contact',
  'workbench.settings.licensePane.detail.seats': 'Locuri',
  'workbench.settings.licensePane.detail.validUntil': 'Valabilă până la',
  'workbench.settings.licensePane.detail.licenseId': 'Id licență',
  'workbench.settings.licensePane.tag.active': 'Activă',
  'workbench.settings.licensePane.tag.offline': 'Licență offline',
  'workbench.settings.licensePane.removeConfirm.title': 'Eliminați această licență?',
  'workbench.settings.licensePane.removeConfirm.body':
    'Aplicația revine la nivelul gratuit (până la {limit} utilizatori activi). Nicio dată nu este afectată.',
  'workbench.settings.licensePane.removeConfirm.ok': 'Eliminare',
  'workbench.settings.licensePane.removeButton': 'Eliminare licență',
  'workbench.settings.licensePane.replaceTitle': 'Înlocuire licență',
  'workbench.settings.licensePane.installTitle': 'Instalare licență',
  'workbench.settings.licensePane.pastePlaceholder': 'Lipiți cheia de licență (oh-license.…)',
  'workbench.settings.licensePane.installButton': 'Instalare',
  'workbench.settings.licensePane.loadFromFile': 'Încărcare din fișier…',

  // ── System-plane proxy section (the request-engine proxy design P3) ─
  'workbench.settings.systemProxy.section': 'Proxy',
  'workbench.settings.systemProxy.previewSection': 'Previzualizarea rutei',
  'workbench.settings.systemProxy.introNote':
    'Local pe dispozitiv și niciodată sincronizat — totul îl urmează, cu excepția cererilor care își setează propriul mod de proxy.',
  'workbench.settings.systemProxy.mode.label': 'Mod',
  'workbench.settings.systemProxy.mode.infoTitle': 'Moduri de proxy',
  'workbench.settings.systemProxy.mode.infoSummary':
    'Cum decide acest dispozitiv ruta pe care o ia fiecare cerere, sesiune WebSocket și apel gRPC.',
  'workbench.settings.systemProxy.mode.infoHeading': 'Moduri',
  'workbench.settings.systemProxy.mode.system': 'Sistem',
  'workbench.settings.systemProxy.mode.systemDesc':
    'Urmează configurația de proxy a acestui computer — setările de sistem, fișierele PAC și descoperirea automată — exact ca browserul. Valoarea implicită; un computer neadministrat se conectează pur și simplu direct.',
  'workbench.settings.systemProxy.system.valuesLabel': 'Valorile sistemului',
  'workbench.settings.systemProxy.system.sourcedNote':
    'Citite de pe acest computer ({source}) — rezolvarea răspunde în continuare per adresă URL.',
  'workbench.settings.systemProxy.system.unavailable': 'Configurația sistemului nu a putut fi citită: {message}',
  'workbench.settings.systemProxy.mode.manual': 'Manual',
  'workbench.settings.systemProxy.mode.manualDesc':
    'Un singur proxy pentru tot — HTTP, HTTPS sau SOCKS5 după schema adresei URL — cu acreditări din vault și o listă de excepții.',
  'workbench.settings.systemProxy.mode.pac': 'PAC',
  'workbench.settings.systemProxy.mode.pacDesc':
    'Un fișier PAC, prin adresă URL sau cale locală, decide per adresă URL. Scriptul rulează doar în stiva de rețea izolată a browserului, niciodată în aplicație.',
  'workbench.settings.systemProxy.mode.off': 'Dezactivat',
  'workbench.settings.systemProxy.mode.offDesc': 'Conectare directă întotdeauna, indiferent ce spune computerul.',
  'workbench.settings.systemProxy.manual.url': 'Proxy',
  'workbench.settings.systemProxy.manual.urlPlaceholder': 'Fără proxy — conexiune directă',
  'workbench.settings.systemProxy.manual.urlExample':
    'de ex. http://proxy.example:8080 sau socks5://proxy.example:1080',
  'workbench.settings.systemProxy.manual.urlError':
    'Introduceți gazdă:port sau o adresă URL de proxy http://, https:// ori socks5:// — SOCKS4 nu este acceptat.',
  'workbench.settings.systemProxy.manual.credentials': 'Acreditări',
  'workbench.settings.systemProxy.manual.credentialsPlaceholder': 'Fără autentificare',
  'workbench.settings.systemProxy.manual.credentialsEmpty':
    'Nicio intrare de tip șir în vault-ul acestui dispozitiv încă.',
  'workbench.settings.systemProxy.manual.credentialsManage': 'Gestionare acreditări în vault',
  'workbench.settings.systemProxy.manual.bypass': 'Listă de excepții',
  'workbench.settings.systemProxy.manual.bypassPlaceholder': 'Fără excepții — fiecare gazdă folosește proxy-ul',
  'workbench.settings.systemProxy.manual.bypassExample': 'de ex. localhost, .internal.example, 10.0.0.0/8',
  'workbench.settings.systemProxy.manual.bypassError':
    'Doar intrări separate prin virgulă — fără spații în interiorul unei intrări, fără schemă.',
  'workbench.settings.systemProxy.manual.supported': 'Acceptat',
  'workbench.settings.systemProxy.pac.source': 'PAC',
  'workbench.settings.systemProxy.pac.sourcePlaceholder': 'Fără adresă URL PAC — conexiune directă',
  'workbench.settings.systemProxy.pac.sourceExample': 'de ex. https://proxy.example/proxy.pac',
  'workbench.settings.systemProxy.pac.sourceError': 'Trebuie să fie o adresă URL PAC http:// sau https://.',
  'workbench.settings.systemProxy.pac.kindUrl': 'URL',
  'workbench.settings.systemProxy.pac.kindFile': 'Fișier',
  'workbench.settings.systemProxy.pac.filePlaceholder': 'Fără fișier PAC — conexiune directă',
  'workbench.settings.systemProxy.pac.fileExample': 'de ex. /path/to/proxy.pac',
  'workbench.settings.systemProxy.pac.fileError': 'Trebuie să fie o cale de fișier absolută.',
  'workbench.settings.systemProxy.pac.browse': 'Răsfoire…',
  'workbench.settings.systemProxy.saveFailed': 'Setarea nu a putut fi salvată: {message}',
  'workbench.settings.systemProxy.previewPlaceholder': 'Previzualizați o adresă URL — ce rută ar lua?',
  'workbench.settings.systemProxy.previewButton': 'Rezolvare',

  // ── Proxy trust pane body (the proxy-security design §2.3 consent posture) ─
  'workbench.settings.proxyTrustPane.intro':
    'Decriptarea traficului HTTPS necesită o autoritate de certificare creată pe acest computer. Nimic nu se instalează până nu configurați încrederea aici, iar tot ce se instalează aici poate fi eliminat de aici.',
  'workbench.settings.proxyTrustPane.refresh': 'Reverificare',
  'workbench.settings.proxyTrustPane.loadFailed': 'Starea de încredere nu a putut fi citită: {message}',
  'workbench.settings.proxyTrustPane.ca.title': 'Autoritate de certificare',
  'workbench.settings.proxyTrustPane.ca.none':
    'Nu există încă nicio autoritate de certificare. Una este creată pe acest computer prima dată când configurați încrederea — nu este livrată niciodată cu aplicația, iar cheia ei privată nu părăsește niciodată acest computer.',
  'workbench.settings.proxyTrustPane.ca.subject': 'Subiect',
  'workbench.settings.proxyTrustPane.ca.fingerprint': 'Amprentă SHA-256',
  'workbench.settings.proxyTrustPane.ca.validity': 'Valabil',
  'workbench.settings.proxyTrustPane.ca.validityRange': '{from} până la {until}',
  'workbench.settings.proxyTrustPane.ca.deleteButton': 'Ștergere autoritate de certificare',
  'workbench.settings.proxyTrustPane.ca.deleteConfirm.title': 'Ștergeți autoritatea de certificare?',
  'workbench.settings.proxyTrustPane.ca.deleteConfirm.body':
    'Perechea de chei este ștearsă de pe acest computer. O nouă configurare a încrederii creează o autoritate nouă.',
  'workbench.settings.proxyTrustPane.ca.deleteConfirm.ok': 'Ștergere',
  'workbench.settings.proxyTrustPane.ca.deleted': 'Autoritatea de certificare a fost ștearsă',
  'workbench.settings.proxyTrustPane.ca.deleteFailed': 'Autoritatea de certificare nu a putut fi ștearsă: {message}',
  'workbench.settings.proxyTrustPane.stores.title': 'Depozite de încredere',
  'workbench.settings.proxyTrustPane.stores.loginKeychain': 'Keychain-ul de conectare',
  'workbench.settings.proxyTrustPane.stores.systemKeychain': 'Keychain-ul de sistem',
  'workbench.settings.proxyTrustPane.stores.firefoxProfile': 'Profil Firefox',
  'workbench.settings.proxyTrustPane.stores.firefox': 'Firefox',
  'workbench.settings.proxyTrustPane.stores.state.trusted': 'De încredere',
  'workbench.settings.proxyTrustPane.stores.state.absent': 'Neinstalat',
  'workbench.settings.proxyTrustPane.stores.state.untrusted': 'Prezent, fără încredere',
  'workbench.settings.proxyTrustPane.stores.state.mismatch': 'Certificat diferit',
  'workbench.settings.proxyTrustPane.stores.state.unavailable': 'Ilizibil',
  'workbench.settings.proxyTrustPane.stores.state.covered': 'Acoperit prin depozitul sistemului de operare',
  'workbench.settings.proxyTrustPane.stores.empty': 'Niciun depozit de încredere nu este vizibil pe acest computer.',
  'workbench.settings.proxyTrustPane.mismatchAlert.title': 'Un depozit de încredere conține un certificat diferit',
  'workbench.settings.proxyTrustPane.mismatchAlert.body':
    'Este instalat un certificat care poartă numele autorității noastre, dar amprenta lui nu este a autorității acestui computer. Această aplicație nu l-a instalat și nu îl folosește niciodată — verificați depozitul în care se află.',
  'workbench.settings.proxyTrustPane.recordedCount': ({ count }, locale) =>
    plural(locale, Number(count), {
      one: '{count} instalare înregistrată',
      few: '{count} instalări înregistrate',
      other: '{count} de instalări înregistrate',
    }),
  'workbench.settings.proxyTrustPane.installButton': 'Configurare încredere…',
  'workbench.settings.proxyTrustPane.wizard.title': 'Instalarea autorității de certificare a proxy-ului',
  'workbench.settings.proxyTrustPane.wizard.explain.whatTitle': 'Ce se instalează',
  'workbench.settings.proxyTrustPane.wizard.explain.whatBody':
    'Un certificat rădăcină creat pe acest computer, unic pentru această instalare. Cheia lui privată este criptată în repaus și nu este trimisă nicăieri.',
  'workbench.settings.proxyTrustPane.wizard.explain.enablesTitle': 'Ce permite',
  'workbench.settings.proxyTrustPane.wizard.explain.enablesBody':
    'Depozitele de încredere care îl conțin acceptă certificatele proxy-ului de captură, astfel încât acesta poate decripta HTTPS — doar pentru gazdele pe care le delimitați explicit. Tot restul trece neatins.',
  'workbench.settings.proxyTrustPane.wizard.explain.removeTitle': 'Cum se elimină',
  'workbench.settings.proxyTrustPane.wizard.explain.removeBody':
    'Fiecare modificare este înregistrată, iar un singur clic pe această pagină anulează exact acele modificări. Dezinstalarea aplicației face același lucru.',
  'workbench.settings.proxyTrustPane.wizard.explain.next': 'Alegere depozite de încredere',
  'workbench.settings.proxyTrustPane.wizard.choose.blurb':
    'Alegeți unde se instalează. Nimic nu se schimbă până nu confirmați.',
  'workbench.settings.proxyTrustPane.wizard.choose.loginNote':
    'Aplicațiile care rulează ca dvs. — fără aprobare de administrator.',
  'workbench.settings.proxyTrustPane.wizard.choose.systemNote':
    'Fiecare utilizator de pe acest computer — cere aprobare de administrator.',
  'workbench.settings.proxyTrustPane.wizard.choose.systemUnavailable':
    'Încrederea la nivel de sistem nu este disponibilă încă în acest build — necesită ajutorul OpenHeaders. Folosiți deocamdată keychain-ul de conectare.',
  'workbench.settings.proxyTrustPane.wizard.choose.firefoxNote':
    'Firefox își păstrează propriul depozit de încredere — se instalează în fiecare profil găsit.',
  'workbench.settings.proxyTrustPane.wizard.choose.firefoxNone':
    'Nu s-a găsit niciun profil Firefox pe acest computer.',
  'workbench.settings.proxyTrustPane.wizard.choose.firefoxUnavailable':
    'S-au găsit profiluri Firefox, dar certutil (instrumentele NSS) nu este instalat — depozitele lor de încredere nu pot fi gestionate de pe acest computer.',
  'workbench.settings.proxyTrustPane.wizard.choose.firefoxOsNote':
    'Firefox are încredere automat în depozitul sistemului de operare (Firefox 120+) — keychain-urile de mai sus îl acoperă.',
  'workbench.settings.proxyTrustPane.wizard.choose.confirm': ({ count }, locale) =>
    plural(locale, Number(count), {
      one: 'Instalare în {count} depozit',
      few: 'Instalare în {count} depozite',
      other: 'Instalare în {count} de depozite',
    }),
  'workbench.settings.proxyTrustPane.wizard.results.allOk': 'Încrederea este instalată în fiecare depozit ales.',
  'workbench.settings.proxyTrustPane.wizard.results.partial':
    'Unele depozite au rămas neschimbate. Nimic nu reîncearcă de la sine — remediați cauza și configurați din nou încrederea sau eliminați încrederea pentru a reveni.',
  'workbench.settings.proxyTrustPane.wizard.results.ok': 'Instalat și de încredere',
  'workbench.settings.proxyTrustPane.wizard.results.elevation':
    'Aprobarea de administrator a fost refuzată — depozitul a rămas neschimbat.',
  'workbench.settings.proxyTrustPane.wizard.results.residue':
    'Certificatul a fost adăugat, dar nu a putut primi încredere. Folosiți „Eliminare încredere” pentru curățare.',
  'workbench.settings.proxyTrustPane.wizard.results.failed': 'Eșuat: {message}',
  'workbench.settings.proxyTrustPane.wizard.installFailed': 'Configurarea încrederii a eșuat: {message}',
  'workbench.settings.proxyTrustPane.wizard.done': 'Gata',
  'workbench.settings.proxyTrustPane.removeButton': 'Eliminare încredere',
  'workbench.settings.proxyTrustPane.removeConfirm.title': 'Eliminați certificatul din fiecare depozit înregistrat?',
  'workbench.settings.proxyTrustPane.removeConfirm.body':
    'Fiecare instalare înregistrată este anulată și verificată ca fiind curată înainte ca înregistrarea ei să fie eliminată. Autoritatea de certificare în sine este păstrată pentru o reinstalare ulterioară.',
  'workbench.settings.proxyTrustPane.removeConfirm.ok': 'Eliminare',
  'workbench.settings.proxyTrustPane.removed':
    'Încredere eliminată — fiecare depozit înregistrat este verificat ca fiind curat.',
  'workbench.settings.proxyTrustPane.removePartial':
    'Unele depozite nu au putut fi verificate ca fiind curate. Înregistrările lor sunt păstrate — rulați din nou eliminarea odată ce cauza este remediată.',
  'workbench.settings.proxyTrustPane.removeFailed': 'Eliminarea a eșuat: {message}',
  'workbench.settings.proxyTrustPane.helper.title': 'Ajutor privilegiat',
  'workbench.settings.proxyTrustPane.helper.blurb':
    'Încrederea în keychain-ul de sistem trece printr-un ajutor semnat, înregistrat în macOS ca element de fundal. Mută doar octeții certificatelor — fiecare decizie de încredere trece în continuare prin dialogul de administrator al macOS.',
  'workbench.settings.proxyTrustPane.helper.notPresent':
    'Nu este inclus în acest build — doar în build-urile macOS împachetate.',
  'workbench.settings.proxyTrustPane.helper.registrationLabel': 'Înregistrare',
  'workbench.settings.proxyTrustPane.helper.serverLabel': 'Server',
  'workbench.settings.proxyTrustPane.helper.state.enabled': 'Înregistrat',
  'workbench.settings.proxyTrustPane.helper.state.requiresApproval': 'Așteaptă aprobarea',
  'workbench.settings.proxyTrustPane.helper.state.notRegistered': 'Neînregistrat',
  'workbench.settings.proxyTrustPane.helper.state.notFound':
    'Negăsit — macOS nu are nicio înregistrare a lui; înregistrați-l din nou',
  'workbench.settings.proxyTrustPane.helper.state.unknown': 'Necunoscut',
  'workbench.settings.proxyTrustPane.helper.probe.ok': 'Răspunde',
  'workbench.settings.proxyTrustPane.helper.probe.down': 'Nu răspunde',
  'workbench.settings.proxyTrustPane.helper.approvalHint':
    'macOS așteaptă aprobarea: activați OpenHeaders la Login Items › „Allow in the Background”, apoi verificați din nou.',
  'workbench.settings.proxyTrustPane.helper.registerButton': 'Înregistrare',
  'workbench.settings.proxyTrustPane.helper.unregisterButton': 'Anulare înregistrare',
  'workbench.settings.proxyTrustPane.helper.loginItemsButton': 'Deschidere Login Items',
  'workbench.settings.proxyTrustPane.helper.actionFailed': 'Acțiunea ajutorului a eșuat: {message}',

  // ── Git pane (workspace-tree binding card, the git-sync plan §9) ─────────
  'workbench.settings.gitPane.notBound.title': 'Niciun folder legat',
  'workbench.settings.gitPane.notBound.body':
    'Legați acest spațiu de lucru de un folder pentru a păstra un arbore YAML viu al fiecărei reguli, cereri și fiecărui mediu — gata pentru copii de rezervă, diff-uri, editări manuale și (în curând) git.',
  'workbench.settings.gitPane.pathPlaceholder': 'Cale absolută a folderului',
  'workbench.settings.gitPane.chooseFolder': 'Alegere folder…',
  'workbench.settings.gitPane.bindButton': 'Legare folder',
  'workbench.settings.gitPane.bound': 'Folder legat.',
  'workbench.settings.gitPane.boundInitialized': 'Folderul a fost inițializat ca arbore nou de spațiu de lucru.',
  'workbench.settings.gitPane.boundBody':
    'Editările se materializează continuu în acest folder; modificările făcute în fișiere ajung înapoi în aplicație.',
  'workbench.settings.gitPane.unbindButton': 'Dezlegare',
  'workbench.settings.gitPane.unbindConfirm.title': 'Dezlegați acest folder?',
  'workbench.settings.gitPane.unbindConfirm.body':
    'Folderul rămâne un arbore valid de spațiu de lucru pe disc; aplicația doar încetează să îl citească și să scrie în el.',
  'workbench.settings.gitPane.unbindConfirm.ok': 'Dezlegare',
  'workbench.settings.gitPane.unbound': 'Folder dezlegat.',
  'workbench.settings.gitPane.issuesTitle': ({ count }, locale) =>
    plural(locale, Number(count), {
      one: '{count} fișier nu a putut fi citit și este lăsat neatins',
      few: '{count} fișiere nu au putut fi citite și sunt lăsate neatinse',
      other: '{count} de fișiere nu au putut fi citite și sunt lăsate neatinse',
    }),
  'workbench.settings.gitPane.refusal.locked':
    'Acest folder este legat deja de alt motor în execuție (procesul {pid}).',
  'workbench.settings.gitPane.refusal.uuidCollision':
    'Acest folder conține un spațiu de lucru care există deja pe această gazdă printr-o altă sursă.',
  'workbench.settings.gitPane.refusal.identityMismatch': 'Acest folder aparține altui spațiu de lucru ({uid}).',
  'workbench.settings.gitPane.refusal.invalidManifest':
    'Fișierul workspace.yaml al folderului nu a putut fi citit: {message}',
  'workbench.settings.gitPane.refusal.alreadyBound': 'Acest spațiu de lucru este legat deja de un folder.',
  'workbench.settings.gitPane.refusal.unknownWorkspace': 'Niciun spațiu de lucru activ de legat.',
  'workbench.settings.gitPane.git.available': 'Git {version} găsit',
  'workbench.settings.gitPane.needsRepo': 'Această pagină necesită un folder legat, cu un depozit — legați unul la',
  'workbench.settings.gitPane.section.workingTree': 'Arbore de lucru',
  'workbench.settings.gitPane.section.branches': 'Ramuri',
  'workbench.settings.gitPane.section.commit': 'Commit',
  'workbench.settings.gitPane.section.history': 'Istoric',
  'workbench.settings.gitPane.git.missing.title': 'Git nu este instalat',
  'workbench.settings.gitPane.git.missing.body':
    'Instalați git pentru a face commit istoricului acestui folder. Tot restul funcționează și fără el.',
  'workbench.settings.gitPane.git.belowFloor.body':
    'Versiunea de git instalată ({version}) este prea veche pentru această funcție. Actualizați git pentru a activa commit-urile.',
  'workbench.settings.gitPane.git.dirtyCount': ({ count }, locale) =>
    plural(locale, Number(count), {
      one: '{count} modificare fără commit',
      few: '{count} modificări fără commit',
      other: '{count} de modificări fără commit',
    }),
  'workbench.settings.gitPane.git.clean': 'Arbore de lucru curat',
  'workbench.settings.gitPane.git.indexBusy':
    'Commit-ul automat este în pauză cât timp propriul dvs. index git are modificări pregătite.',
  'workbench.settings.gitPane.git.messagePlaceholder': 'Mesaj de commit',
  'workbench.settings.gitPane.git.commitButton': 'Commit',
  'workbench.settings.gitPane.git.committed': 'Commit efectuat: {sha}.',
  'workbench.settings.gitPane.git.nothingToCommit':
    'Nimic de trimis prin commit — arborele corespunde ultimului commit.',
  'workbench.settings.gitPane.git.commitFailed': 'Commit-ul a eșuat: {detail}',
  'workbench.settings.gitPane.git.cadenceLabel': 'Commit automat',
  'workbench.settings.gitPane.git.cadenceDescription':
    'Când înregistrează motorul editările dvs. drept commit-uri de la sine. Dezactivat păstrează fiecare commit ca gest explicit.',
  'workbench.settings.gitPane.git.cadenceOff': 'Dezactivat — commit manual',
  'workbench.settings.gitPane.git.cadenceAuto': 'După editări în liniște',
  'workbench.settings.gitPane.git.cadenceOnBlur': 'Când focalizarea părăsește aplicația',
  'workbench.settings.gitPane.git.cadenceEvery': 'La fiecare {minutes} min',
  'workbench.settings.gitPane.git.bypassHooksLabel': 'Ocolire hook-uri git',
  'workbench.settings.gitPane.git.bypassHooksDescription':
    'Rulează commit-urile motorului cu --no-verify, sărind peste hook-urile dvs. pre-commit și commit-msg.',
  'workbench.settings.gitPane.git.bypassHooksWarning':
    'Cât timp este activă, commit-urile motorului sar peste hook-urile dvs. pre-commit și commit-msg.',
  'workbench.settings.gitPane.git.remoteInSync': '{upstream}: sincronizat',
  'workbench.settings.gitPane.git.remoteStatus': '{upstream}: înainte cu {ahead}, în urmă cu {behind}',
  'workbench.settings.gitPane.git.noUpstream':
    'Niciun depozit la distanță configurat — adăugați unul cu git remote add și git push -u pentru a activa Pull.',
  'workbench.settings.gitPane.git.pullButton': 'Pull',
  'workbench.settings.gitPane.git.pulled': 'Îmbinat: {sha}.',
  'workbench.settings.gitPane.git.upToDate': 'Deja la zi.',
  'workbench.settings.gitPane.git.pullFailed': 'Pull eșuat: {detail}',
  'workbench.settings.gitPane.git.pushButton': 'Push',
  'workbench.settings.gitPane.git.pushed': 'Push efectuat: {sha}.',
  'workbench.settings.gitPane.git.nothingToPush': 'Nimic de trimis prin push — deja sincronizat.',
  'workbench.settings.gitPane.git.pushFailed': 'Push eșuat: {detail}',
  'workbench.settings.gitPane.git.pushRejected':
    'Depozitul la distanță are commit-uri noi — faceți mai întâi pull, apoi push din nou.',
  'workbench.settings.gitPane.git.pushNoPermission.title': 'Fără acces de push',
  'workbench.settings.gitPane.git.pushNoPermission.body':
    'Acest depozit la distanță este doar în citire pentru dvs. Commit-urile dvs. rămân locale; le puteți publica pe o ramură nouă și deschide o cerere de îmbinare de pe gazda dvs. git.',
  'workbench.settings.gitPane.git.exportBranchPlaceholder': 'nume-ramură-nouă',
  'workbench.settings.gitPane.git.exportBranchButton': 'Push ca ramură nouă',
  'workbench.settings.gitPane.git.exportedBranch': 'Push efectuat pe ramura {branch}.',
  'workbench.settings.gitPane.git.autoPushLabel': 'Push după fiecare commit',
  'workbench.settings.gitPane.git.autoPushDescription':
    'Face push ramurii curente către ramura din amonte imediat după fiecare commit înregistrat de motor.',
  'workbench.settings.gitPane.git.branch.current': 'Pe ramura {branch}',
  'workbench.settings.gitPane.git.branch.detached': 'HEAD detașat — creați o ramură pentru a păstra acest istoric.',
  'workbench.settings.gitPane.git.branch.switchLabel': 'Comutare la',
  'workbench.settings.gitPane.git.branch.switched': 'Comutat la ramura {branch}.',
  'workbench.settings.gitPane.git.branch.switchFailed': 'Comutarea a eșuat: {detail}',
  'workbench.settings.gitPane.git.branch.dirtyTitle': 'Aveți modificări fără commit',
  'workbench.settings.gitPane.git.branch.dirtyBody': ({ count, branch }, locale) =>
    formatMessage(
      plural(locale, Number(count), {
        one: 'Faceți commit, stocați temporar sau renunțați la {count} modificare fără commit înainte de a comuta la ramura {branch}.',
        few: 'Faceți commit, stocați temporar sau renunțați la cele {count} modificări fără commit înainte de a comuta la ramura {branch}.',
        other:
          'Faceți commit, stocați temporar sau renunțați la cele {count} de modificări fără commit înainte de a comuta la ramura {branch}.',
      }),
      { branch: String(branch) },
    ),
  'workbench.settings.gitPane.git.branch.dirtyCommit': 'Commit și comutare',
  'workbench.settings.gitPane.git.branch.dirtyStash': 'Stocare temporară și comutare',
  'workbench.settings.gitPane.git.branch.dirtyDiscard': 'Renunțare la modificări',
  'workbench.settings.gitPane.git.branch.dirtyDiscardConfirm.title': 'Renunțați la modificările fără commit?',
  'workbench.settings.gitPane.git.branch.dirtyDiscardConfirm.body':
    'Fiecare modificare fără commit este ștearsă, inclusiv fișierele noi. Această acțiune nu poate fi anulată.',
  'workbench.settings.gitPane.git.branch.dirtyDiscardConfirm.ok': 'Renunțare',
  'workbench.settings.gitPane.git.branch.createPlaceholder': 'nume-ramură-nouă',
  'workbench.settings.gitPane.git.branch.createButton': 'Creare și comutare',
  'workbench.settings.gitPane.git.branch.created': 'Ramura {branch} a fost creată.',
  'workbench.settings.gitPane.git.branch.createFailed': 'Ramura nu a putut fi creată: {detail}',
  'workbench.settings.gitPane.git.branch.mergeLabel': 'Îmbinare în ramura curentă',
  'workbench.settings.gitPane.git.branch.mergeButton': 'Îmbinare',
  'workbench.settings.gitPane.git.branch.merged': 'Îmbinat: {sha}.',
  'workbench.settings.gitPane.git.branch.mergeUpToDate': 'Deja la zi.',
  'workbench.settings.gitPane.git.branch.mergeFailed': 'Îmbinarea a eșuat: {detail}',
  'workbench.settings.gitPane.git.forcePush.title': 'Istoricul de la distanță a fost rescris',
  'workbench.settings.gitPane.git.forcePush.body':
    'Ramura de la distanță nu mai conține istoricul sincronizat ultima dată ({sha}). Alegeți cum continuați — nimic nu se schimbă până nu decideți.',
  'workbench.settings.gitPane.git.forcePush.abandon': 'Abandonare modificări locale',
  'workbench.settings.gitPane.git.forcePush.abandonConfirm.title': 'Abandonați modificările locale?',
  'workbench.settings.gitPane.git.forcePush.abandonConfirm.body':
    'Commit-urile locale de la ultima sincronizare sunt eliminate, iar istoricul rescris de la distanță devine starea spațiului de lucru.',
  'workbench.settings.gitPane.git.forcePush.abandonConfirm.ok': 'Abandonare',
  'workbench.settings.gitPane.git.forcePush.rescue': 'Păstrare pe o ramură de salvare',
  'workbench.settings.gitPane.git.forcePush.reapply': 'Reaplicare deasupra',
  'workbench.settings.gitPane.git.forcePush.resolved': 'Istoricul rescris a fost acceptat ({sha}).',
  'workbench.settings.gitPane.git.forcePush.rescued': 'Istoricul local a fost păstrat pe ramura {branch}.',
  'workbench.settings.gitPane.git.forcePush.failed': 'Nu s-a putut rezolva: {detail}',
  'workbench.settings.gitPane.git.history.show': 'Afișare istoric',
  'workbench.settings.gitPane.git.history.hide': 'Ascundere',
  'workbench.settings.gitPane.git.history.empty': 'Niciun commit încă.',
  'workbench.settings.gitPane.git.history.loadFailed': 'Istoricul nu a putut fi citit: {detail}',
  'workbench.settings.gitPane.git.history.authorLine': '{author} · {date}',
  'workbench.settings.gitPane.git.history.coAuthors': 'Coautori: {authors}',
  'workbench.settings.gitPane.git.history.fileTitle': 'Istoric — {path}',
  'workbench.settings.gitPane.git.history.fileEmpty': 'Niciun commit nu atinge încă acest fișier.',
} as const satisfies Catalog;
