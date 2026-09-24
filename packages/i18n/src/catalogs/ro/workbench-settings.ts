/**
 * Workbench settings — shell chrome — Romanian. Mirrors
 * `catalogs/en/workbench-settings.ts` key for key. Raw by design:
 * `MCP` / `Git` / `TLS` / `HTTP` / `SSE` / `gRPC` / `WebSocket` / `MQTT`
 * as dev tokens (serverul MCP / cereri API with a head noun), the
 * DevTools-panel tab names in category labels (Network, Headers,
 * Initiator, Cookies, Timing, Waterfall — panel parity vocabulary),
 * `MIME` / `Hash` / multipart / build, and the {version} / {when} /
 * {message} / {filename} / {sessionId} / {installId} holes with a
 * head noun or a colon frame (versiunea {version}, sesiunea
 * {sessionId}, instalarea {installId}, Ultima verificare: {when}).
 * Category labels quoted by shipped files copy them verbatim: „Copie
 * de rezervă și sincronizare” (shared-workspace), „Dispozitivele dvs.”
 * (shared-components' „… › Dispozitivele dvs.”), „Instrumente ›
 * Trafic” (workbench-chrome-sidebar), Modul Depanare, Interceptor de
 * browser (workbench-chrome), Controlul versiunilor, Actualizare și
 * repornire + note de lansare (shared-chrome), Certificate de
 * încredere (trusted-roots). MINTS: setare = a countable setting row
 * (the page stays Setări; {count} setare / setări / de setări);
 * resetare = reset; panoul DevTools = the DevTools panel; Aspect = the
 * Layout nav label (carried from panel.ts); bara de stare = status
 * bar; bara de sus = top bar; subsol carried; Vizualizator Diff =
 * Diff Viewer (diff-urile in prose — a loanword enclitic); profil =
 * terminal profile; contorizarea utilizării = usage counting
 * (telemetry); Conectivitate = Connectivity (category — the editors'
 * Conexiune stays the connection GROUP) / Sincronizare = Sync;
 * Aplicația desktop / Avansat = the Desktop app / Advanced categories;
 * Motorul de reguli = Rules Engine; Shell raw (shell-ul); loc = a
 * seat, nivel = tier (nivelul gratuit); Mediu de rulare = the About
 * Environment sub (mediu alone is the variable environment); Software
 * liber = Open-Source Software; soluție de rezervă offline = offline
 * fallback; depozit la distanță = remote (carried from the git log);
 * peeri = peers (the ledger's raw peer).
 */

import { plural } from '../../runtime';
import type { Catalog } from '../../types';

export const workbenchSettings = {
  // ── Shell chrome ───────────────────────────────────────────────────
  'workbench.settings.shell.title': 'Setări',
  'workbench.settings.shell.openInEditor': 'Deschidere în editor',
  'workbench.settings.shell.openInEditorSoon': 'Deschidere în editor (în curând)',
  'workbench.settings.shell.maximize': 'Maximizare',
  'workbench.settings.shell.restoreWindow': 'Restaurare',
  'workbench.settings.shell.hint.search': 'Căutare',
  'workbench.settings.shell.hint.navigate': 'Navigare',
  'workbench.settings.shell.hint.select': 'Selectare',
  'workbench.settings.shell.hint.clearClose': 'Golire / Închidere',
  'workbench.settings.shell.noneRegistered': 'Nicio setare înregistrată.',
  'workbench.settings.shell.resetAll': 'Resetare toate',
  'workbench.settings.shell.resetAllCount': 'Resetare toate ({count})',
  'workbench.settings.shell.resetAllTitle': 'Resetare toate setările?',
  'workbench.settings.shell.resetAllNone': 'Nimic de resetat — toate setările au valorile implicite.',
  'workbench.settings.shell.resetAllDescription': ({ count }, locale) =>
    plural(locale, Number(count), {
      one: 'Restaurarea valorii implicite pentru {count} setare.',
      few: 'Restaurarea valorilor implicite pentru {count} setări.',
      other: 'Restaurarea valorilor implicite pentru {count} de setări.',
    }),
  'workbench.settings.shell.resetConfirm': 'Resetare',
  'workbench.settings.shell.searchResults': 'Rezultatele căutării',
  'workbench.settings.shell.matchesFor': ({ count }, locale) =>
    plural(locale, Number(count), {
      one: '{count} potrivire pentru',
      few: '{count} potriviri pentru',
      other: '{count} de potriviri pentru',
    }),
  'workbench.settings.shell.noMatchesFor': 'Nicio setare nu se potrivește cu',
  'workbench.settings.shell.jumpToCategory': 'Salt la categorie',
  'workbench.settings.shell.navAria': 'Categorii de setări',
  'workbench.settings.shell.showCategoryNames': 'Afișare nume categorii',
  'workbench.settings.shell.otherGroup': 'Altele',

  // ── Shared field-row chrome ────────────────────────────────────────
  'workbench.settings.row.modified': 'Modificat față de valoarea implicită',
  'workbench.settings.row.modifiedAria': 'modificat',
  'workbench.settings.row.resetToDefault': 'Resetare la valoarea implicită',
  'workbench.settings.row.experimental': 'Experimental',
  'workbench.settings.row.desktopBadge': 'Desktop',
  'workbench.settings.row.desktopTip':
    'Necesită o conexiune activă cu aplicația desktop Open Headers. Aplicația desktop păstrează valoarea de referință.',
  'workbench.settings.row.capabilityUnavailable': 'Acest browser nu acceptă această setare.',
  'workbench.settings.row.connectionRequired': 'Conectați aplicația desktop pentru a modifica această setare.',
  'workbench.settings.row.aboutAria': 'Despre {label}',
  'workbench.settings.row.disabledCapabilityAria': 'Dezactivat — indisponibil în acest browser',
  'workbench.settings.row.disabledConnectionAria': 'Dezactivat — necesită conexiunea cu aplicația desktop',
  'workbench.settings.row.managed': 'Gestionat de organizația dvs.',
  'workbench.settings.row.managedBadge': 'Gestionat',
  'workbench.settings.row.disabledManagedAria': 'Dezactivat — gestionat de organizația dvs.',
  'workbench.settings.row.run': 'Rulare',
  'workbench.settings.row.presetsHeading': 'Presetări',

  // ── Categories ─────────────────────────────────────────────────────
  'workbench.settings.category.backend.label': 'Copie de rezervă și sincronizare',
  'workbench.settings.category.backend.description':
    'Unde se păstrează copiile de rezervă ale spațiilor dvs. de lucru și unde se sincronizează — aplicația desktop de pe acest computer sau un server administrat de dvs. ori de echipa dvs.',
  'workbench.settings.category.backendConnections.label': 'Sincronizare',
  'workbench.settings.category.backendConnections.description':
    'Locurile cu care se sincronizează spațiile dvs. de lucru și cum vă conectați la ele.',
  'workbench.settings.category.backendServer.label': 'Dispozitivele dvs.',
  'workbench.settings.category.backendServer.description':
    'Permiteți celorlalte dispozitive ale dvs. să se sincronizeze cu acest computer și vedeți dispozitivele pe care le-ați asociat.',
  'workbench.settings.category.backendServer.sub.network': 'Rețea',
  'workbench.settings.category.backendServer.sub.peer-requests': 'Cereri de la peeri',
  'workbench.settings.category.backendServer.sub.devices': 'Dispozitive',
  'workbench.settings.category.backendPairing.label': 'Aplicația desktop',
  'workbench.settings.category.backendPairing.description':
    'Cum se conectează acest browser la aplicația desktop de pe acest computer și ce poate vedea aplicația.',
  'workbench.settings.category.backendPairing.sub.automatic': 'Automat',
  'workbench.settings.category.backendPairing.sub.policy': 'Politică',
  'workbench.settings.category.backendPairing.sub.sharing': 'Partajare',
  'workbench.settings.category.backendReliability.label': 'Avansat',
  'workbench.settings.category.backendReliability.description':
    'Reconectarea, starea și soluția de rezervă offline pentru fiecare conexiune de sincronizare.',
  'workbench.settings.category.backendReliability.sub.reconnection': 'Reconectare',
  'workbench.settings.category.backendReliability.sub.status': 'Stare',
  'workbench.settings.category.backendReliability.sub.offline-fallback': 'Soluție de rezervă offline',
  'workbench.settings.category.mcp.label': 'AI · Server MCP',
  'workbench.settings.category.mcp.description':
    'Permiteți agenților AI și altor clienți MCP să citească și să controleze această aplicație. Accesul este pe niveluri — citirea, scrierea, executarea și dezvăluirea secretelor sunt comutatoare separate, toate dezactivate implicit.',
  'workbench.settings.category.mcpAccess.label': 'Acces',
  'workbench.settings.category.mcpAccess.description':
    'Activați serverul și alegeți ce pot face agenții conectați. Fiecare nivel este dezactivat implicit.',
  'workbench.settings.category.mcpAccess.sub.server': 'Server',
  'workbench.settings.category.mcpAccess.sub.permissions': 'Permisiuni',
  'workbench.settings.category.mcpClients.label': 'Clienți',
  'workbench.settings.category.mcpClients.description': 'Conectați oh CLI și clienții MCP la această aplicație.',
  'workbench.settings.category.mcpClients.sub.command-line': 'Linie de comandă',
  'workbench.settings.category.mcpClients.sub.configuration': 'Configurare',
  'workbench.settings.category.appearanceBehavior.label': 'Aspect vizual și comportament',
  'workbench.settings.category.appearanceBehavior.description':
    'Cum arată și cum se comportă aplicația — limba, tema și shell-ul Workbench.',
  'workbench.settings.category.general.label': 'General',
  'workbench.settings.category.general.description': 'Comportamentul la nivel de aplicație, pornirea și limba.',
  'workbench.settings.category.general.sub.locale': 'Limbă',
  'workbench.settings.category.general.sub.behavior': 'Comportament',
  'workbench.settings.category.general.sub.settings': 'Setări',
  'workbench.settings.category.general.sub.privacy': 'Confidențialitate',
  'workbench.settings.category.appearance.label': 'Aspect vizual',
  'workbench.settings.category.appearance.description': 'Tema, densitatea și prezentarea vizuală.',
  'workbench.settings.category.appearance.sub.theme': 'Temă',
  'workbench.settings.category.appearance.sub.interface': 'Interfață',
  'workbench.settings.category.workspaceLayout.label': 'Aspectul spațiului de lucru',
  'workbench.settings.category.workspaceLayout.description':
    'Elementele din subsol și comportamentul shell-ului ferestrelor de instrumente.',
  'workbench.settings.category.workspaceLayout.sub.shell': 'Shell',
  'workbench.settings.category.workspaceLayout.sub.topbar': 'Bara de sus',
  'workbench.settings.category.workspaceLayout.sub.footer': 'Subsol',
  'workbench.settings.category.tools.label': 'Instrumente',
  'workbench.settings.category.tools.description':
    'Ferestre de instrumente cu setări proprii — terminalul, monitorul de trafic și serverul MCP.',
  'workbench.settings.category.terminal.label': 'Terminal',
  'workbench.settings.category.terminal.description': 'Comportamentul ferestrei de instrumente Terminal integrate.',
  'workbench.settings.category.terminal.sub.shell': 'Shell',
  'workbench.settings.category.terminal.sub.appearance': 'Aspect vizual',
  'workbench.settings.category.terminal.sub.behavior': 'Comportament',
  'workbench.settings.category.terminal.sub.tabs': 'File',
  'workbench.settings.category.devpanel.label': 'Panoul DevTools',
  'workbench.settings.category.devpanel.description':
    'Valorile implicite pentru panoul DevTools al browserului — shell-ul ferestrei de instrumente și fiecare filă a suprafeței de cereri.',
  'workbench.settings.category.devpanelLayout.label': 'Aspect',
  'workbench.settings.category.devpanelLayout.description':
    'Comportamentul shell-ului ferestrelor de instrumente pentru panoul DevTools al browserului.',
  'workbench.settings.category.devpanelLayout.sub.shell': 'Shell',
  'workbench.settings.category.devpanelLayout.sub.topbar': 'Bara de sus',
  'workbench.settings.category.devpanelLayout.sub.footer': 'Subsol',
  'workbench.settings.category.devpanelNetwork.label': 'Network',
  'workbench.settings.category.devpanelNetwork.description':
    'Valorile implicite pentru tabelul de cereri Network din panoul DevTools — aspect, sortare, coloana de puncte.',
  'workbench.settings.category.devpanelNetwork.sub.table': 'Tabel',
  'workbench.settings.category.devpanelNetwork.sub.sorting': 'Sortare',
  'workbench.settings.category.devpanelNetwork.sub.waterfall': 'Waterfall',
  'workbench.settings.category.devpanelHeaders.label': 'Headers',
  'workbench.settings.category.devpanelHeaders.description':
    'Valorile implicite pentru fila Headers din panoul DevTools — aspect, sortare, filtre, sugestii.',
  'workbench.settings.category.devpanelHeaders.sub.view': 'Vizualizare',
  'workbench.settings.category.devpanelHeaders.sub.filters': 'Filtre',
  'workbench.settings.category.devpanelInitiator.label': 'Initiator',
  'workbench.settings.category.devpanelInitiator.description':
    'Valorile implicite pentru fila Initiator din panoul DevTools — sortare, filtre, sugestii.',
  'workbench.settings.category.devpanelInitiator.sub.view': 'Vizualizare',
  'workbench.settings.category.devpanelInitiator.sub.filters': 'Filtre',
  'workbench.settings.category.devpanelCookies.label': 'Cookies',
  'workbench.settings.category.devpanelCookies.description':
    'Valorile implicite pentru fila Cookies din panoul DevTools — coloane, sortare, filtre, sugestii.',
  'workbench.settings.category.devpanelCookies.sub.view': 'Vizualizare',
  'workbench.settings.category.devpanelCookies.sub.filters': 'Filtre',
  'workbench.settings.category.devpanelTiming.label': 'Timing',
  'workbench.settings.category.devpanelTiming.description':
    'Valorile implicite pentru fila Timing din panoul DevTools — ce benzi sunt vizibile.',
  'workbench.settings.category.devpanelTiming.sub.view': 'Vizualizare',
  'workbench.settings.category.inspection.label': 'Modul Depanare',
  'workbench.settings.category.inspection.description':
    'Calea opțională care atașează protocolul de depanare al browserului dvs. — inspectați și modificați cererile cu aceeași profunzime ca instrumentele pentru dezvoltatori încorporate.',
  'workbench.settings.category.inspection.sub.protocol': 'Protocol de depanare',
  'workbench.settings.category.trafficMonitor.label': 'Trafic',
  'workbench.settings.category.trafficMonitor.description':
    'Valorile implicite pentru gestul de pornire a observării din panoul Trafic și bugetul pe disc al arhivei de sesiuni.',
  'workbench.settings.category.trafficMonitor.sub.layout': 'Aspect',
  'workbench.settings.category.trafficMonitor.sub.capture': 'Captură',
  'workbench.settings.category.trafficMonitor.sub.sessions': 'Sesiuni',
  'workbench.settings.category.editor.label': 'Editor',
  'workbench.settings.category.editor.description': 'Suprafețele de cod și de diff din fiecare filă de editor.',
  'workbench.settings.category.codeEditor.label': 'Editor de cod',
  'workbench.settings.category.codeEditor.description':
    'Fontul, indentarea și opțiunile de afișare pentru suprafețele de editare a codului.',
  'workbench.settings.category.codeEditor.sub.font': 'Font',
  'workbench.settings.category.codeEditor.sub.indentation': 'Indentare',
  'workbench.settings.category.codeEditor.sub.wrapping': 'Încadrare',
  'workbench.settings.category.codeEditor.sub.display': 'Afișare',
  'workbench.settings.category.codeEditor.sub.editing': 'Editare',
  'workbench.settings.category.requests.label': 'Cereri API',
  'workbench.settings.category.requests.description':
    'Trimiterea cererilor și tratarea răspunsurilor pentru fiecare protocol.',
  'workbench.settings.category.requests.sub.tls': 'TLS',
  'workbench.settings.category.requests.sub.http': 'HTTP',
  'workbench.settings.category.requests.sub.sse': 'SSE',
  'workbench.settings.category.requests.sub.grpc': 'gRPC',
  'workbench.settings.category.requests.sub.websocket': 'WebSocket',
  'workbench.settings.category.requests.sub.mqtt': 'MQTT',
  'workbench.settings.category.browserInterceptor.label': 'Interceptor de browser',
  'workbench.settings.category.browserInterceptor.description':
    'Planul din browser — motorul de reguli care rescrie traficul, atașarea la protocolul de depanare și panoul DevTools.',
  'workbench.settings.category.rulesEngine.label': 'Motorul de reguli',
  'workbench.settings.category.rulesEngine.description': 'Cum sunt evaluate, compilate și arbitrate regulile.',
  'workbench.settings.category.rulesEngine.sub.engine': 'Motor',
  'workbench.settings.category.rulesEngine.sub.caching': 'Stocare în cache',
  'workbench.settings.category.rulesEngine.sub.warnings': 'Avertismente',
  'workbench.settings.category.rulesEngine.sub.drafting': 'Redactarea regulilor',
  'workbench.settings.category.rulesEngine.sub.display': 'Afișare',
  'workbench.settings.category.keyboard.label': 'Tastatură',
  'workbench.settings.category.keyboard.description': 'Personalizați scurtăturile de tastatură.',
  'workbench.settings.category.keyboard.sub.global': 'Toate suprafețele',
  'workbench.settings.category.keyboard.sub.workbench-general': 'Workbench',
  'workbench.settings.category.keyboard.sub.workbench-layout': 'Workbench · Aspect',
  'workbench.settings.category.keyboard.sub.workbench-tabs': 'Workbench · File',
  'workbench.settings.category.keyboard.sub.workbench-focus': 'Workbench · Focalizare',
  'workbench.settings.category.keyboard.sub.workbench-editor': 'Workbench · Editor',
  'workbench.settings.category.keyboard.sub.popup-general': 'Fereastra popup și panoul lateral',
  'workbench.settings.category.keyboard.sub.popup-navigation': 'Fereastra popup și panoul lateral · Navigare',
  'workbench.settings.category.keyboard.sub.popup-rows': 'Fereastra popup și panoul lateral · Acțiuni pe rânduri',
  'workbench.settings.category.keyboard.sub.popup-tabs': 'Fereastra popup și panoul lateral · File',
  'workbench.settings.category.diffViewer.label': 'Vizualizator Diff',
  'workbench.settings.category.diffViewer.description':
    'Cum se redau diff-urile — aspectul, spațiile albe și marginea — oriunde aplicația compară două versiuni.',
  'workbench.settings.category.diffViewer.sub.view': 'Vizualizare',
  'workbench.settings.category.diffViewer.sub.importPreview': 'Previzualizare import',
  'workbench.settings.category.versionControl.label': 'Controlul versiunilor',
  'workbench.settings.category.versionControl.description':
    'Spații de lucru pe bază de Git — istoricul și arborele de lucru din spatele lor.',
  'workbench.settings.category.git.label': 'Git',
  'workbench.settings.category.git.description':
    'Legați acest spațiu de lucru de un folder de pe disc — un arbore YAML viu, prietenos cu Git.',
  'workbench.settings.category.gitFolder.label': 'Folder',
  'workbench.settings.category.gitFolder.description': 'Folderul de pe disc de care este legat acest spațiu de lucru.',
  'workbench.settings.category.gitFolder.sub.binding': 'Legare',
  'workbench.settings.category.gitFolder.sub.requirements': 'Cerințe',
  'workbench.settings.category.gitAutomation.label': 'Automatizare',
  'workbench.settings.category.gitAutomation.description': 'Ce face motorul de la sine prin commit și push.',
  'workbench.settings.category.gitAutomation.sub.commits': 'Commit-uri',
  'workbench.settings.category.gitAutomation.sub.remote': 'Depozit la distanță',
  'workbench.settings.category.proxy.label': 'Proxy',
  'workbench.settings.category.proxy.description':
    'Proxy-ul de ieșire al acestui dispozitiv — cum ajung cererile în rețea — și configurarea încrederii pentru proxy-ul de captură.',
  'workbench.settings.category.proxyOutbound.label': 'Cereri de ieșire',
  'workbench.settings.category.proxyOutbound.description':
    'Proxy-ul de ieșire al acestui dispozitiv — cum ajung în rețea cererile, sesiunile WebSocket și apelurile gRPC.',
  'workbench.settings.category.proxyTrust.label': 'Încredere HTTPS',
  'workbench.settings.category.proxyTrust.description':
    'Autoritatea de certificare și depozitele de încredere care permit decriptarea traficului HTTPS pentru inspecție — create pe acest computer, eliminabile de aici.',
  'workbench.settings.category.application.label': 'Aplicație',
  'workbench.settings.category.application.description':
    'Aplicația în sine — datele, actualizările, licența și versiunea ei.',
  'workbench.settings.category.data.label': 'Date',
  'workbench.settings.category.data.description': 'Diagnostic, import/export și întreținere distructivă.',
  'workbench.settings.category.data.sub.settings': 'Setări',
  'workbench.settings.category.data.sub.diagnostics': 'Diagnostic',
  'workbench.settings.category.data.sub.importReports': 'Rapoarte de import',
  'workbench.settings.category.data.sub.files': 'Fișiere',
  'workbench.settings.category.license.label': 'Licență',
  'workbench.settings.category.license.description':
    'Tot ce oferă Open Headers astăzi este inclus la fiecare nivel — planurile plătite acoperă locurile pentru echipe. Nivelul gratuit admite până la 6 utilizatori activi per server.',
  'workbench.settings.category.updates.label': 'Actualizări',
  'workbench.settings.category.updates.description':
    'Verificarea actualizărilor, canalul și comportamentul la descărcare.',
  'workbench.settings.category.updates.sub.status': 'Stare',
  'workbench.settings.category.updates.sub.behavior': 'Comportament',
  'workbench.settings.category.about.label': 'Despre',
  'workbench.settings.category.about.description': 'Versiunea, licențele și informațiile despre build.',
  'workbench.settings.category.about.sub.application': 'Aplicație',
  'workbench.settings.category.about.sub.environment': 'Mediu de rulare',
  'workbench.settings.category.about.sub.openSource': 'Software liber',
  'workbench.settings.thirdParty.software': 'Software',
  'workbench.settings.thirdParty.license': 'Licență',

  // ── App-update row (updates.state custom editor) ───────────────────
  'workbench.settings.updatesRow.unsupported':
    'În acest build, actualizările sunt gestionate de canalul dvs. de instalare.',
  'workbench.settings.updatesRow.checking': 'Se caută actualizări…',
  'workbench.settings.updatesRow.securityFix':
    'Versiunea {version} remediază o problemă de securitate care afectează această versiune.',
  'workbench.settings.updatesRow.available': 'Versiunea {version} este disponibilă.',
  'workbench.settings.updatesRow.packageManager': 'Instalați-o prin managerul de pachete Linux.',
  'workbench.settings.updatesRow.updateAndRestart': 'Actualizare și repornire',
  'workbench.settings.updatesRow.downloading': 'Se descarcă versiunea {version}…',
  'workbench.settings.updatesRow.readyToInstall': 'Versiunea {version} este gata de instalare.',
  'workbench.settings.updatesRow.restartToInstall': 'Repornire pentru instalare',
  'workbench.settings.updatesRow.checkFailed': 'Verificarea actualizărilor a eșuat: {message}',
  'workbench.settings.updatesRow.retry': 'Reîncercare',
  'workbench.settings.updatesRow.upToDate': 'Aveți cea mai recentă versiune ({version}).',
  'workbench.settings.updatesRow.checkNow': 'Verificare acum',
  'workbench.settings.updatesRow.releaseNotes': 'Note de lansare',
  'workbench.settings.updatesRow.lastChecked': 'Ultima verificare: {when}',

  // ── Terminal profiles row ──────────────────────────────────────────
  'workbench.settings.terminalProfiles.systemDefault': 'Shell-ul implicit al sistemului',
  'workbench.settings.terminalProfiles.add': 'Adăugare profil',
  'workbench.settings.terminalProfiles.edit': 'Editare profil',
  'workbench.settings.terminalProfiles.remove': 'Eliminare profil',
  'workbench.settings.terminalProfiles.addTitle': 'Adăugare profil de terminal',
  'workbench.settings.terminalProfiles.editTitle': 'Editare profil de terminal',
  'workbench.settings.terminalProfiles.name': 'Nume',
  'workbench.settings.terminalProfiles.shell': 'Calea shell-ului',
  'workbench.settings.terminalProfiles.args': 'Argumente',
  'workbench.settings.terminalProfiles.cwd': 'Director de pornire',
  'workbench.settings.terminalProfiles.cwdPlaceholder': 'Directorul personal',
  'workbench.settings.terminalProfiles.save': 'Salvare',

  // ── Settings field widgets ─────────────────────────────────────────
  'workbench.settings.fields.files.renameTooltip': 'Redenumire fișier',
  'workbench.settings.fields.files.renameMissing': 'Fișierul nu mai există în acest spațiu de lucru',
  'workbench.settings.fields.files.renameFailed': 'Fișierul nu a putut fi redenumit',
  'workbench.settings.fields.files.renameFailedReason': 'Fișierul nu a putut fi redenumit: {message}',
  'workbench.settings.fields.files.colFilename': 'Nume fișier',
  'workbench.settings.fields.files.colSize': 'Dimensiune',
  'workbench.settings.fields.files.colMime': 'MIME',
  'workbench.settings.fields.files.colHash': 'Hash',
  'workbench.settings.fields.files.colActions': 'Acțiuni',
  'workbench.settings.fields.files.download': 'Descărcare',
  'workbench.settings.fields.files.deleteTitle': 'Ștergere {filename}?',
  'workbench.settings.fields.files.deleteWarning':
    'Părțile multipart care fac referire la acest fișier vor da eroare la trimitere.',
  'workbench.settings.fields.files.loading': 'Se încarcă fișierele…',
  'workbench.settings.fields.files.empty': 'Niciun fișier încă — folosiți acțiunea Încărcare fișier de mai sus.',
  'workbench.settings.fields.keyValue.keyPlaceholder': 'cheie',
  'workbench.settings.fields.keyValue.valuePlaceholder': 'valoare',
  'workbench.settings.fields.keyValue.addEntry': 'Adăugare intrare',
  'workbench.settings.fields.keybinding.pressCombo': 'Apăsați o combinație de taste…',
  'workbench.settings.fields.keybinding.record': 'Înregistrare',
  'workbench.settings.fields.keybinding.cancel': 'Anulare',

  // ── Product-telemetry toggle row ───────────────────────────────────
  'workbench.settings.telemetryRow.viewEvents': 'Vizualizare evenimente',
  'workbench.settings.telemetryRow.modalTitle': 'Evenimente de telemetrie din această sesiune',
  'workbench.settings.telemetryRow.sessionOn': 'Sesiunea {sessionId} — contorizarea este activată',
  'workbench.settings.telemetryRow.sessionOff': 'Sesiunea {sessionId} — contorizarea este dezactivată',
  'workbench.settings.telemetryRow.install':
    'Instalarea {installId} (aleatoriu — identifică această instalare, nu pe dvs.)',
  'workbench.settings.telemetryRow.noInstall': 'Niciun identificator de instalare — contorizarea este dezactivată',
  'workbench.settings.telemetryRow.empty': 'Niciun eveniment de telemetrie înregistrat în această sesiune.',
  'workbench.settings.telemetryRow.confirmTitle': 'Dezactivați contorizarea anonimă a utilizării?',
  'workbench.settings.telemetryRow.confirmHeading': 'Confidențialitatea dvs. este deja protejată',
  'workbench.settings.telemetryRow.confirmIntro':
    'Un identificator aleatoriu contorizează această instalare — niciodată pe dvs. Nu se colectează niciodată date personale. Iată ce face contorizarea:',
  'workbench.settings.telemetryRow.confirmPointFeatures': 'Arată ce funcții merită dezvoltate în continuare',
  'workbench.settings.telemetryRow.confirmPointScope':
    'Contorizează doar utilizarea funcțiilor, platforma și versiunea aplicației',
  'workbench.settings.telemetryRow.confirmPointInspect':
    'Fiecare eveniment rămâne vizibil octet cu octet în „Vizualizare evenimente”',
  'workbench.settings.telemetryRow.confirmBadgePersonal': 'Fără date personale',
  'workbench.settings.telemetryRow.confirmBadgeUrls': 'Fără adrese URL sau antete',
  'workbench.settings.telemetryRow.confirmBadgeContent': 'Fără conținutul cererilor',
  'workbench.settings.telemetryRow.confirmKeep': 'Păstrare contorizare activată',
  'workbench.settings.telemetryRow.confirmDisable': 'Dezactivare oricum',
} as const satisfies Catalog;
