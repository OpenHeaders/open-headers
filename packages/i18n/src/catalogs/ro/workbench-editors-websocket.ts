/**
 * Workbench editors — the WebSocket client editor — Romanian. Mirrors
 * `catalogs/en/workbench-editors-websocket.ts` key for key. Wire
 * vocabulary rides raw inside keyed values: ws/wss schemes,
 * subprotocol identifiers, AsyncAPI, Socket.IO / CONNECT / engine.io
 * tokens, the sio decoded rows (verbatim wire), `Arg`, Bearer / token,
 * long-polling, `Ack`. The Params tab and Docs tab ride raw
 * (tab.params / Docs law); Settings tab = Setări; spec-browser section
 * headers mirror AsyncAPI document keywords and ride raw (spec outline
 * law) while prose says canal / operație (editors-spec donor). cadru =
 * frame; handshake raw (the register ledger); sesiune = session;
 * cronologie = timeline; captură = capture; Autorizare = the
 * Authorization tab; Antete = Headers tab; conținut util = payload.
 * MINTS: subprotocol (carried from workbench-editors); Ascultare = the
 * Listen column; confirmare = ack (prose; the sio row `ack` stays
 * verbatim wire); Evenimente = the Events tab noun; spațiu de nume =
 * namespace (carried from workbench-editors-rule); cadre heartbeat =
 * heartbeat frames (raw apposition); inactivitate = idle; runtime-ul
 * node = the node runtime — the future editors-request ro reuses
 * Autorizare / Antete / Params for its twin tabs. Every raw token
 * takes a head noun (sesiunea Socket.IO, handshake-ul engine.io,
 * opțiunea Ack, adresa URL).
 */

import type { Catalog } from '../../types';

export const workbenchEditorsWebsocket = {
  // ── WebSocket request editor ────────────────────────────────────────
  'workbench.editors.websocket.notFound': 'Cererea WebSocket nu a fost găsită.',
  'workbench.editors.websocket.connect.label': 'Conectare',
  'workbench.editors.websocket.connect.disconnect': 'Deconectare',
  'workbench.editors.websocket.connect.cancel': 'Anulare',
  'workbench.editors.websocket.connect.needsUrl': 'Introduceți o adresă URL ws:// sau wss:// pentru a vă conecta.',
  'workbench.editors.websocket.tab.docs': 'Docs',
  'workbench.editors.websocket.tab.message': 'Mesaj',
  'workbench.editors.websocket.tab.events': 'Evenimente',
  'workbench.editors.websocket.tab.auth': 'Autorizare',
  'workbench.editors.websocket.tab.headers': 'Antete',
  'workbench.editors.websocket.tab.params': 'Params',
  'workbench.editors.websocket.tab.settings': 'Setări',
  'workbench.editors.websocket.tab.scripts': 'Scripturi',
  'workbench.editors.websocket.messagePlaceholder': 'Compuneți următorul mesaj de trimis…',
  'workbench.editors.websocket.messagePlaceholderBase64': 'Base64 al mesajului binar, de ex. aGVsbG8=…',
  'workbench.editors.websocket.messagePlaceholderHex': 'Hexazecimalul mesajului binar, de ex. 68656c6c6f…',
  'workbench.editors.websocket.message.formatText': 'Text',
  'workbench.editors.websocket.message.formatJson': 'JSON',
  'workbench.editors.websocket.message.formatXml': 'XML',
  'workbench.editors.websocket.message.formatHtml': 'HTML',
  'workbench.editors.websocket.message.formatBinary': 'Binar',
  'workbench.editors.websocket.message.encodingBase64': 'Base64',
  'workbench.editors.websocket.message.encodingHex': 'Hexazecimal',
  'workbench.editors.websocket.message.invalidGate': 'Corectați mai întâi codificarea mesajului.',
  'workbench.editors.websocket.message.invalidBase64': 'Base64 nevalid — octeții decodați sunt cei care s-ar trimite.',
  'workbench.editors.websocket.message.invalidHex':
    'Hexazecimal nevalid — perechile de cifre 0-9 a-f se decodează în octeții trimiși.',
  'workbench.editors.websocket.auth.helpRaw':
    'Trimis ca antet Authorization: Bearer la handshake — se aplică în aplicația desktop sau pe server; browserele nu îl pot seta pe o conexiune WebSocket. Un rând de antet Authorization explicit are prioritate.',
  'workbench.editors.websocket.auth.helpSocketio':
    'Trimis ca payload auth al pachetului CONNECT ({"token": …}) pe fiecare gazdă și ca antet de handshake Authorization: Bearer în aplicația desktop sau pe server. Un rând de antet Authorization explicit are prioritate față de antet.',
  'workbench.editors.websocket.auth.inheritUnsupported':
    '{type} — de la {source} — nu poate fi aplicat unei sesiuni WebSocket.',
  'workbench.editors.websocket.auth.helpOwn':
    'Emis la fiecare Conectare și la fiecare reconectare: un antet circulă pe handshake în aplicația desktop sau pe server (browserele nu îl pot seta), o plasare în interogare sau adresa URL semnată AWS circulă pe adresa URL de conectare pe fiecare gazdă, iar varianta Socket.IO trimite și un token în formă bearer ca payload auth al pachetului CONNECT. Un rând de antet explicit cu același nume are prioritate.',
  'workbench.editors.websocket.auth.ownUnsupported': '{type} nu poate fi aplicat unei sesiuni WebSocket.',
  'workbench.editors.websocket.events.hint':
    'Evenimentele primite de afișat în cronologia sesiunii. Fără rânduri, se afișează fiecare eveniment; captura înregistrează întotdeauna totul.',
  'workbench.editors.websocket.events.namePlaceholder': 'Nume eveniment',
  'workbench.editors.websocket.events.listenLabel': 'Ascultare',
  'workbench.editors.websocket.event.namePlaceholder': 'Nume eveniment',
  'workbench.editors.websocket.event.ackLabel': 'Așteptare confirmare',
  'workbench.editors.websocket.event.ackHelp':
    'Emite un id de confirmare cu fiecare Trimitere, astfel încât răspunsul ack al serverului să se coreleze în cronologie.',
  'workbench.editors.websocket.event.argsPlaceholder': 'Compuneți vectorul de argumente JSON, de ex. ["hello", 42]…',
  'workbench.editors.websocket.event.argTab': 'Arg {index}',
  'workbench.editors.websocket.event.addArg': 'Arg',
  'workbench.editors.websocket.event.removeArg': 'Eliminare argumentul {index}',
  'workbench.editors.websocket.event.argPlaceholder':
    'Compuneți acest argument ca JSON, de ex. "hello" sau {"id": 42}…',
  'workbench.editors.websocket.headers.keyPlaceholder': 'Nume antet',
  'workbench.editors.websocket.headers.valuePlaceholder': 'Valoare',
  'workbench.editors.websocket.headers.hint.host':
    'Derivat din adresa URL țintă la momentul conectării — gazda căreia îi este adresată cererea de upgrade.',
  'workbench.editors.websocket.headers.hint.connection':
    'Cere serverului să schimbe protocolul; un handshake de deschidere WebSocket poartă întotdeauna Connection: Upgrade.',
  'workbench.editors.websocket.headers.hint.upgrade':
    'Numește protocolul la care se trece — fiecare handshake WebSocket face upgrade conexiunii HTTP la websocket.',
  'workbench.editors.websocket.headers.hint.key':
    'Un nonce aleatoriu generat pentru fiecare conexiune; serverul dovedește că a citit handshake-ul returnând un hash al acestuia în Sec-WebSocket-Accept.',
  'workbench.editors.websocket.headers.hint.version':
    'Versiunea protocolului WebSocket (RFC 6455); 13 este singura versiune în uz.',
  'workbench.editors.websocket.headers.hint.extensions':
    'Oferă compresie per mesaj; serverul poate accepta, restrânge sau ignora oferta în răspunsul său de handshake.',
  'workbench.editors.websocket.headers.hint.origin':
    'Originea paginii pe care browserul o imprimă pe fiecare handshake WebSocket; serverele o folosesc pentru a refuza conexiunile cross-site.',
  'workbench.editors.websocket.headers.hint.userAgent':
    'Browserul se identifică la handshake; codul paginii nu îl poate schimba.',
  'workbench.editors.websocket.headers.hint.cacheControl':
    'Browserul marchează cererea de upgrade ca neplasabilă în cache.',
  'workbench.editors.websocket.headers.hint.acceptEncoding':
    'Codificările de conținut pe care browserul le acceptă în răspunsul de handshake.',
  'workbench.editors.websocket.headers.hint.acceptLanguage':
    'Limbile preferate ale browserului, preluate din setările sale.',
  'workbench.editors.websocket.headers.hint.node.accept':
    'Handshake-ul runtime-ului node acceptă orice tip de media de răspuns.',
  'workbench.editors.websocket.headers.hint.node.acceptLanguage':
    'Handshake-ul runtime-ului node trimite un metacaracter.',
  'workbench.editors.websocket.headers.hint.node.secFetchMode':
    'Imprimat de runtime-ul node pe fiecare handshake WebSocket.',
  'workbench.editors.websocket.headers.hint.node.userAgent':
    'Runtime-ul node identifică această aplicație la handshake. Adăugați propriul rând User-Agent pentru a trimite altul.',
  'workbench.editors.websocket.headers.hint.node.cacheControl':
    'Runtime-ul node marchează cererea de upgrade ca neplasabilă în cache.',
  'workbench.editors.websocket.headers.hint.node.acceptEncoding':
    'Codificările de conținut pe care runtime-ul node le acceptă în răspunsul de handshake.',
  'workbench.editors.websocket.headers.browserNotSent':
    'Netrimise — browserul setează singur antetele de handshake. Antetele personalizate se aplică atunci când sesiunea rulează în aplicația desktop sau pe server.',
  'workbench.editors.websocket.spec.selectLabel': 'Specificație AsyncAPI',
  'workbench.editors.websocket.spec.selectPlaceholder': 'Legați o specificație AsyncAPI',
  'workbench.editors.websocket.spec.summary': 'servere: {servers} · canale: {channels} · operații: {operations}',
  'workbench.editors.websocket.spec.parseFailure': 'Specificația nu s-a parsat: {message}',
  'workbench.editors.websocket.spec.issues': 'probleme în specificație: {count}',
  'workbench.editors.websocket.spec.useExample': 'Utilizare mesaj exemplu…',
  'workbench.editors.websocket.spec.browser.hint': 'Alegeți un mesaj pentru a-i compune conținutul util de exemplu.',
  'workbench.editors.websocket.spec.browser.servers': 'Servers',
  'workbench.editors.websocket.spec.browser.channels': 'Channels',
  'workbench.editors.websocket.spec.browser.operations': 'Operations',
  'workbench.editors.websocket.spec.browser.components': 'Components',
  'workbench.editors.websocket.settings.exampleCaption': 'Exemplu de sesiune',
  'workbench.editors.websocket.settings.group.connection': 'Conexiune',
  'workbench.editors.websocket.settings.group.socketio': 'Socket.IO',
  'workbench.editors.websocket.settings.group.tls': 'TLS și încredere',
  'workbench.editors.websocket.settings.group.resilience': 'Reziliența sesiunii',
  'workbench.editors.websocket.settings.groupInfo.resilience':
    'Ce menține în viață o sesiune lungă: dacă o conexiune căzută se redeschide și cu câtă răbdare, cât poate dura tăcerea înainte ca conexiunea să conteze ca pierdută și heartbeat-ul pe care îl trimite acest client.',
  'workbench.editors.websocket.settings.groupInfo.connection':
    'Cum deschide handshake-ul sesiunea: subprotocoalele pe care le oferă, unde stabilește conexiunea și plafonul pentru deschidere.',
  'workbench.editors.websocket.settings.groupInfo.socketio':
    'Cum se adresează și vorbește sesiunea Socket.IO cu serverul: calea de handshake engine.io pe care o montează, spațiul de nume la care se alătură, revizia protocolului și cât așteaptă un eveniment confirmarea sa.',
  'workbench.editors.websocket.settings.groupInfo.tls':
    'Cum stabilesc încrederea sesiunile wss:: dacă certificatul serverului este verificat față de rădăcinile sistemului, certificatul de client pe care îl prezintă acest dispozitiv, fereastra de versiuni TLS și lista de cifruri la handshake, precum și numele SNI pe care îl oferă.',
  'workbench.editors.websocket.settings.subprotocolsLabel': 'Subprotocoale',
  'workbench.editors.websocket.settings.subprotocolsHelp':
    'Lista de oferte Sec-WebSocket-Protocol, în ordinea preferinței — serverul alege unul în timpul handshake-ului.',
  'workbench.editors.websocket.settings.subprotocolsPlaceholder': 'Niciunul (implicit)',
  'workbench.editors.websocket.settings.subprotocolsExample': 'de ex. graphql-transport-ws',
  'workbench.editors.websocket.settings.unixSocketLabel': 'Socket Unix',
  'workbench.editors.websocket.settings.unixSocketHelp':
    'Stabilește conexiunea prin acest socket local — o cale absolută de socket Unix sau un named pipe Windows precum \\\\.\\pipe\\name — în loc să deschidă o conexiune TCP. Adresa URL decide în continuare antetul Host al handshake-ului, numele de server TLS și verificarea certificatului; se schimbă doar unde ajunge conexiunea. Lăsați gol pentru o conexiune TCP normală.',
  'workbench.editors.websocket.settings.unixSocketPlaceholder': 'Conexiune TCP (implicit)',
  'workbench.editors.websocket.settings.timeoutLabel': 'Timp de așteptare conectare',
  'workbench.editors.websocket.settings.timeoutHelp':
    'Plafon de timp real doar pentru handshake-ul conexiunii — o sesiune deschisă nu are plafon. Gol înseamnă fără termen-limită.',
  'workbench.editors.websocket.settings.timeoutPlaceholder': 'Fără limită (implicit)',
  'workbench.editors.websocket.settings.handshakePathLabel': 'Cale de handshake',
  'workbench.editors.websocket.settings.handshakePathHelp':
    'Calea de pe server pe care o apelează handshake-ul engine.io — punctul de montare Socket.IO, nu spațiul de nume. Gol apelează /socket.io/ standard. Sesiunile apelează direct transportul websocket; nu există o revenire la long-polling.',
  'workbench.editors.websocket.settings.handshakePathPlaceholder': '/socket.io/ (implicit)',
  'workbench.editors.websocket.settings.handshakePathExample': 'de ex. /net/sio-probe',
  'workbench.editors.websocket.settings.namespaceLabel': 'Spațiu de nume',
  'workbench.editors.websocket.settings.namespaceHelp':
    'Spațiul de nume la care se alătură sesiunea — calea din adresa URL, așa cum o citește clientul oficial (ws://host/admin se alătură la /admin). Editați-l aici sau în adresa URL; cele două rămân sincronizate. Gol se alătură rădăcinii /.',
  'workbench.editors.websocket.settings.namespacePlaceholder': '/ (implicit)',
  'workbench.editors.websocket.settings.namespaceExample': 'de ex. /admin',
  'workbench.editors.websocket.settings.socketioProtocolLabel': 'Protocol',
  'workbench.editors.websocket.settings.socketioProtocolHelp':
    'Revizia protocolului Socket.IO pe care o vorbește sesiunea. v5 (engine.io 4) este ceea ce vorbesc serverele Socket.IO 3.x și 4.x; alegeți v4 (engine.io 3) pentru un server 1.x sau 2.x — acolo clientul trimite ping-urile, serverul se alătură singur spațiului de nume rădăcină, iar pachetul connect nu poartă payload auth, așa că acreditarea bearer circulă doar pe antetul de handshake.',
  'workbench.editors.websocket.settings.socketioProtocolPlaceholder': 'v5 (implicit)',
  'workbench.editors.websocket.settings.socketioProtocolV5': 'v5 — servere Socket.IO 3.x / 4.x',
  'workbench.editors.websocket.settings.socketioProtocolV4': 'v4 — servere Socket.IO 1.x / 2.x',
  'workbench.editors.websocket.settings.ackTimeoutLabel': 'Timp de așteptare confirmare',
  'workbench.editors.websocket.settings.ackTimeoutHelp':
    'Cât așteaptă un eveniment trimis cu Ack confirmarea serverului. Când așteptarea expiră, cronologia înregistrează confirmarea ca expirată și nu mai așteaptă; o confirmare întârziată se afișează totuși când sosește. Gol așteaptă la nesfârșit.',
  'workbench.editors.websocket.settings.ackTimeoutPlaceholder': 'Fără timp de așteptare (implicit)',
  'workbench.editors.websocket.toast.deletedOtherTab': 'Această cerere WebSocket a fost ștearsă într-o altă filă.',
  'workbench.editors.websocket.toast.updateFailed': 'Salvarea cererii WebSocket a eșuat',
  'workbench.editors.websocket.toast.updateFailedDetail': 'Salvarea cererii WebSocket a eșuat: {message}',
  'workbench.editors.websocket.toast.savedExample': 'Exemplul {name} a fost salvat',
  'workbench.editors.websocket.toast.saveExampleFailed': 'Salvarea exemplului a eșuat',
  'workbench.editors.websocket.toast.saveExampleFailedDetail': 'Salvarea exemplului a eșuat: {message}',
  // ── Session pane ────────────────────────────────────────────────────
  'workbench.editors.websocket.session.paneTitle': 'Răspuns',
  'workbench.editors.websocket.session.emptyHint': 'Conectați-vă pentru a trimite și a primi mesaje.',
  'workbench.editors.websocket.session.connectFailed': 'Deschiderea sesiunii a eșuat',
  'workbench.editors.websocket.session.connectingBadge': 'Se conectează',
  'workbench.editors.websocket.session.connectedBadge': 'Conectat',
  'workbench.editors.websocket.session.closedTag': 'Închis {code}',
  'workbench.editors.websocket.session.stoppedTag': 'Oprit',
  'workbench.editors.websocket.session.disconnectedTag': 'Deconectat',
  'workbench.editors.websocket.session.connectFailedTag': 'Conectare eșuată',
  'workbench.editors.websocket.session.abortedTag': 'Abandonat',
  'workbench.editors.websocket.session.noCloseFrame': 'Conexiunea s-a încheiat fără un cadru Close',
  'workbench.editors.websocket.session.duration': '{ms} ms',
  'workbench.editors.websocket.session.sendMessage': 'Trimitere',
  'workbench.editors.websocket.session.saveResponse': 'Salvare răspuns',
  'workbench.editors.websocket.session.sendIdle': 'Conectați-vă pentru a trimite mesaje.',
  'workbench.editors.websocket.session.sendFailed': 'Trimiterea mesajului a eșuat',
  'workbench.editors.websocket.session.hostNotice':
    'Rulează pe socketul browserului — {knobs} nu se aplică pe această gazdă.',
  'workbench.editors.websocket.session.knobHeaders': 'antetele de handshake personalizate',
  'workbench.editors.websocket.session.knobSslVerify': 'verificarea SSL dezactivată',
  'workbench.editors.websocket.session.knobAuth': 'antetul de handshake al acreditării',
  'workbench.editors.websocket.session.handshakeNone': 'Nimic negociat',
  'workbench.editors.websocket.session.handshakeNote':
    'Socketul platformei expune doar subprotocolul și extensiile negociate — antetele răspunsului 101 nu sunt disponibile clienților.',
  // ── Message timeline ────────────────────────────────────────────────
  'workbench.editors.websocket.timeline.connecting': 'Se conectează',
  'workbench.editors.websocket.timeline.connected': 'Conectat',
  'workbench.editors.websocket.timeline.disconnected': 'Deconectat',
  'workbench.editors.websocket.timeline.stopped': 'Oprit',
  'workbench.editors.websocket.timeline.aborted': 'Conexiune abandonată',
  'workbench.editors.websocket.connect.reconnectNow': 'Reconectare acum',
  'workbench.editors.websocket.connect.reconnectNowHint':
    'Lansează următoarea încercare de reconectare fără a aștepta expirarea perioadei',
  'workbench.editors.websocket.session.reconnectingBadge': 'Se reconectează',
  'workbench.editors.websocket.session.reconnectExhaustedTag': 'Reconectarea a renunțat',
  'workbench.editors.websocket.session.reconnectExhausted': 'reconectarea a renunțat după {attempts}',
  'workbench.editors.websocket.session.reconnectExhaustedReason': 'reconectarea a renunțat după {attempts}: {reason}',
  'workbench.editors.websocket.session.reconnectAttemptsOne': 'o încercare',
  'workbench.editors.websocket.session.reconnectAttemptsMany': '{count} încercări',
  'workbench.editors.websocket.timeline.lost': 'Conexiune pierdută',
  'workbench.editors.websocket.timeline.lostIdle': 'nimic nu a sosit înainte de expirarea timpului de inactivitate',
  'workbench.editors.websocket.timeline.reconnectingAfter': 'Încercarea de reconectare {attempt} după {delay}',
  'workbench.editors.websocket.timeline.reconnectingNow': 'Încercarea de reconectare {attempt} acum',
  'workbench.editors.websocket.timeline.reconnected': 'Reconectat',
  'workbench.editors.websocket.timeline.reconnectedTo': 'Reconectat la {url}',
  'workbench.editors.websocket.timeline.ackTimeout': 'Confirmarea #{ackId} a expirat după {timeout}',
  'workbench.editors.websocket.timeline.noMatches': 'Niciun mesaj nu corespunde filtrului.',
  'workbench.editors.websocket.timeline.connectedTo': 'Conectat la {url}',
  'workbench.editors.websocket.timeline.copyMessage': 'Copiere mesaj',
  'workbench.editors.websocket.saved.title': 'Mesaje salvate',
  'workbench.editors.websocket.saved.addTooltip': 'Salvați compunerea curentă ca mesaj reutilizabil',
  'workbench.editors.websocket.saved.showRail': 'Afișare mesaje salvate',
  'workbench.editors.websocket.saved.hideRail': 'Ascundere mesaje salvate',
  'workbench.editors.websocket.saved.emptyHint':
    'Salvați mesaje pentru a le reutiliza în timpul unei conexiuni active.',
  'workbench.editors.websocket.saved.defaultName': 'Mesaj',
  'workbench.editors.websocket.saved.rename': 'Redenumire',
  'workbench.editors.websocket.saved.duplicate': 'Duplicare',
  'workbench.editors.websocket.saved.delete': 'Ștergere',
  'workbench.editors.websocket.timeline.saveMessage': 'Salvare mesaj',
  'workbench.editors.websocket.timeline.info.label': 'Detalii mesaj',
  'workbench.editors.websocket.timeline.info.size': 'Dimensiune',
  'workbench.editors.websocket.timeline.info.time': 'Timp',
  'workbench.editors.websocket.timeline.info.frame': 'Cadru',
  'workbench.editors.websocket.timeline.info.frameText': 'Text',
  'workbench.editors.websocket.timeline.info.frameBinary': 'Binar',
  'workbench.editors.websocket.timeline.couldNotConnect': 'Conectarea la {url} a eșuat',
  'workbench.editors.websocket.timeline.errorLabel': 'Eroare',
  'workbench.editors.websocket.timeline.disconnectedFrom': 'Deconectat de la {url}',
  'workbench.editors.websocket.timeline.handshakeDetails': 'Detalii handshake',
  'workbench.editors.websocket.timeline.requestUrl': 'Adresa URL a cererii',
  'workbench.editors.websocket.timeline.requestMethod': 'Metoda cererii',
  'workbench.editors.websocket.timeline.statusCode': 'Cod de stare',
  'workbench.editors.websocket.timeline.requestHeaders': 'Antete de cerere',
  'workbench.editors.websocket.timeline.responseHeaders': 'Antete de răspuns',
  'workbench.editors.websocket.timeline.keyGenerated': '<generat de socket>',
  'workbench.editors.websocket.timeline.stoppedDetail': 'Sesiunea a fost oprită din această aplicație.',
  'workbench.editors.websocket.timeline.closeCode.unknown':
    'Fără semnificație înregistrată — un cod de aplicație sau privat.',
  'workbench.editors.websocket.timeline.closeCode.1000': 'Conexiunea a fost închisă cu succes.',
  'workbench.editors.websocket.timeline.closeCode.1001':
    'Punctul final se retrage — o oprire a serverului sau o navigare a paginii.',
  'workbench.editors.websocket.timeline.closeCode.1002':
    'Punctul final a terminat conexiunea din cauza unei erori de protocol.',
  'workbench.editors.websocket.timeline.closeCode.1003':
    'Punctul final a primit date de un tip pe care nu îl poate accepta.',
  'workbench.editors.websocket.timeline.closeCode.1005': 'Niciun cod de stare nu era prezent în cadrul Close.',
  'workbench.editors.websocket.timeline.closeCode.1006': 'Conexiunea a căzut fără un cadru Close.',
  'workbench.editors.websocket.timeline.closeCode.1007':
    'Un mesaj a purtat date inconsecvente cu tipul său, precum UTF-8 nevalid într-un cadru text.',
  'workbench.editors.websocket.timeline.closeCode.1008': 'Un mesaj a încălcat politica punctului final.',
  'workbench.editors.websocket.timeline.closeCode.1009':
    'Un mesaj a fost prea mare pentru a fi procesat de punctul final.',
  'workbench.editors.websocket.timeline.closeCode.1010': 'Serverul nu a negociat o extensie pe care clientul o cerea.',
  'workbench.editors.websocket.timeline.closeCode.1011':
    'Serverul a întâlnit o condiție neașteptată și nu a putut îndeplini cererea.',
  'workbench.editors.websocket.timeline.closeCode.1012': 'Serverul repornește.',
  'workbench.editors.websocket.timeline.closeCode.1013': 'Serverul este supraîncărcat — reîncercați mai târziu.',
  'workbench.editors.websocket.timeline.closeCode.1014':
    'Un gateway sau un proxy a primit un răspuns nevalid de la serverul din amonte.',
  'workbench.editors.websocket.timeline.closeCode.1015': 'Handshake-ul TLS a eșuat.',
  'workbench.editors.websocket.timeline.searchMessages': 'Căutare mesaje',
  'workbench.editors.websocket.timeline.messageCount': 'mesaje: {count}',
  'workbench.editors.websocket.timeline.dropped': 'mesaje mai vechi ieșite din captură: {count}',
  'workbench.editors.websocket.timeline.script': '{hook} — {levels}',
  'workbench.editors.websocket.timeline.scriptFailed': '{hook} a eșuat — {error}',
  'workbench.editors.websocket.timeline.scriptDropped': '{hook} a eliminat mesajul — {level}',
  'workbench.editors.websocket.timeline.scriptAttempt': 'încercarea {attempt}',
  'workbench.editors.websocket.session.view.timeline': 'Cronologie',
  'workbench.editors.websocket.session.view.scripts': 'Scripturi',
  'workbench.editors.websocket.session.scripts.empty': 'Niciun script nu a rulat în această sesiune.',
  'workbench.editors.websocket.session.scripts.console': 'Consolă',
  'workbench.editors.websocket.session.scripts.tests': 'Tests',
  'workbench.editors.websocket.session.scripts.consoleEmpty': 'Nimic înregistrat în jurnal.',
  'workbench.editors.websocket.session.scripts.testsEmpty': 'Nicio aserțiune înregistrată.',
  'workbench.editors.websocket.session.scripts.attempt': 'încercarea {attempt}',
  'workbench.editors.websocket.session.scripts.atMessage': 'mesajul {index}',
  'workbench.editors.websocket.session.scripts.tag': 'Scripturi · {count}',
  'workbench.editors.websocket.session.scripts.tagTitle': 'Scripturile sesiunii',
  'workbench.editors.websocket.session.scripts.tagSummary':
    'Hook-urile care au rulat în această sesiune, cu nivelurile care au contribuit.',
  'workbench.editors.websocket.session.scripts.tagSummaryFailed':
    'Un hook a eșuat — ultima sa eroare este listată sub el.',
  'workbench.editors.websocket.session.scripts.runs': 'rulări: {count}',
  'workbench.editors.websocket.session.scripts.runsOne': '1 rulare',
  'workbench.editors.websocket.session.scripts.failed': 'eșuate: {count}',
  'workbench.editors.websocket.session.scripts.dropped': 'eliminate: {count}',
  'workbench.editors.websocket.session.scripts.marksCapped':
    'Detaliile per eveniment s-au oprit după {count} rulări; hook-urile rulează în continuare, iar numărătoarea completă apare când sesiunea se încheie.',
  'workbench.editors.websocket.timeline.filterAll': 'Toate',
  'workbench.editors.websocket.timeline.filterSent': 'Trimise',
  'workbench.editors.websocket.timeline.filterReceived': 'Primite',
  'workbench.editors.websocket.timeline.newestFirst': 'Cele mai noi primele',
  'workbench.editors.websocket.timeline.oldestFirst': 'Cele mai vechi primele',
  'workbench.editors.websocket.timeline.sortOrder': 'Sortare și grupare',
  'workbench.editors.websocket.timeline.groupByDirection': 'Grupare după direcție',
  'workbench.editors.websocket.timeline.groupByEvent': 'Grupare după eveniment',
  'workbench.editors.websocket.timeline.hideHeartbeat': 'Ascundere cadre heartbeat (ping / pong)',
  'workbench.editors.websocket.timeline.hideHandshake': 'Ascundere cadre de handshake (open / connect)',
  'workbench.editors.websocket.timeline.rowsPerGroup': 'Rânduri per grup',
  'workbench.editors.websocket.timeline.noLimit': 'Fără limită',
  'workbench.editors.websocket.timeline.clearMessages': 'Golire mesaje',
  'workbench.editors.websocket.timeline.trustCertificate': 'Acordare încredere certificatului',
  'workbench.editors.websocket.timeline.newMessages': 'Mesaje noi',
  'workbench.editors.websocket.timeline.binaryMessage': 'Mesaj binar ({bytes} octeți)',
  'workbench.editors.websocket.timeline.sentAria': 'Trimis',
  'workbench.editors.websocket.timeline.receivedAria': 'Primit',
  // Socket.IO decoded display rows (wire vocabulary rides raw).
  'workbench.editors.websocket.timeline.sio.engineOpen': 'engine.io open',
  'workbench.editors.websocket.timeline.sio.engineClose': 'engine.io close',
  'workbench.editors.websocket.timeline.sio.ping': 'ping',
  'workbench.editors.websocket.timeline.sio.pong': 'pong',
  'workbench.editors.websocket.timeline.sio.connect': 'connect {namespace}',
  'workbench.editors.websocket.timeline.sio.connected': 'connected {namespace}',
  'workbench.editors.websocket.timeline.sio.connectError': 'connect error',
  'workbench.editors.websocket.timeline.sio.disconnect': 'disconnect {namespace}',
  'workbench.editors.websocket.timeline.sio.binaryAttachments': 'Cadru de atașamente binare (atașamente: {count})',
  'workbench.editors.websocket.timeline.sio.ack': 'ack',
  'workbench.editors.websocket.timeline.sio.eventNoName': 'event',
  // ── Response example viewer ─────────────────────────────────────────
  'workbench.editors.wsExample.loading': 'Se încarcă exemplul…',
  'workbench.editors.wsExample.notFound':
    'Acest exemplu nu mai există — este posibil să fi fost șters într-o altă filă.',
  'workbench.editors.wsExample.openInRequest': 'Deschidere în cerere',
  'workbench.editors.wsExample.openInRequestTooltip':
    'Deschide cererea WebSocket părinte cu această formă capturată, ca editări nesalvate.',
  'workbench.editors.wsExample.capturedTooltip': 'Capturat la {date}',
  'workbench.editors.wsExample.toast.deletedOtherTab': 'Acest exemplu a fost șters într-o altă filă.',
  'workbench.editors.wsExample.toast.saveFailed': 'Salvarea exemplului a eșuat',
  'workbench.editors.wsExample.toast.saveFailedDetail': 'Salvarea exemplului a eșuat: {message}',
} as const satisfies Catalog;
