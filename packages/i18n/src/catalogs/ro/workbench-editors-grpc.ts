/**
 * Workbench editors — gRPC client + gRPC response examples — Romanian.
 * Mirrors `catalogs/en/workbench-editors-grpc.ts` key for key. Raw by
 * design: gRPC status-code names (OK, CANCELLED, …) with their
 * lead-ins rendered as Codul de stare N NAME, rpc/service identifiers
 * ({rpc}), Protobuf / `.proto` / TLS / SSL / lowercase `base64`
 * vocabulary, `host:port` and `authorization: Bearer <token>` wire
 * syntax, `Metadata` / `Trailers` tab nouns kept as the gRPC protocol
 * terms, `Docs` / `Streaming` / `Authority` raw, and the {count} /
 * {ms} / {bytes} / {name} / {message} holes. Settings tab = Setări;
 * Mesaj = the Message tab; cronologie = timeline; cadru = frame;
 * streaming modes reuse the editors-spec mints (unar / streaming pe
 * server); Autorizare / Antete family tab nouns per editors-websocket;
 * the TLS scalar twins (Nume de server SNI / Certificat de client /
 * Socket Unix) per shared-conflicts. MINTS: invocare = invoke /
 * apelul = the call (Invocare = the Invoke button); plafonat = capped
 * at (byte cap); ping keepalive = keepalive ping (raw apposition);
 * termen-limită = deadline (the gRPC term); Acordare încredere
 * certificatului = trust certificate; metadate = metadata prose;
 * trailere = trailers prose (a loanword). Every raw token takes a head
 * noun (modul TLS, cadrul HTTP/2 PING, formatul JSON).
 */

import { plural } from '../../runtime';
import type { Catalog } from '../../types';

export const workbenchEditorsGrpc = {
  // ── gRPC request editor ─────────────────────────────────────────────
  'workbench.editors.grpc.notFound': 'Cererea gRPC nu a fost găsită.',
  'workbench.editors.grpc.urlPlaceholder': 'host:port (de ex. grpc.openheaders.com:443)',
  'workbench.editors.grpc.tls.on': 'TLS activat — apăsați pentru a trece la text simplu',
  'workbench.editors.grpc.tls.off': 'TLS dezactivat (text simplu) — apăsați pentru a trece la TLS',
  'workbench.editors.grpc.method.placeholder': 'Selectați o metodă',
  'workbench.editors.grpc.method.noSpecPlaceholder': 'Legați o specificație Protobuf pentru a alege o metodă',
  'workbench.editors.grpc.method.unresolvedGroup': 'Nu este în specificația legată',
  'workbench.editors.grpc.method.unresolvedOption': '{rpc} (nerezolvată)',
  'workbench.editors.grpc.method.linkGroup': 'Legare specificație Protobuf',
  'workbench.editors.grpc.method.importProto': 'Import fișier .proto…',
  'workbench.editors.grpc.invoke.label': 'Invocare',
  'workbench.editors.grpc.invoke.stop': 'Oprire',
  'workbench.editors.grpc.invoke.needsMethod':
    'Alegeți o metodă care se rezolvă față de specificația legată pentru a invoca',
  'workbench.editors.grpc.invoke.needsUrl': 'Introduceți o gazdă țintă pentru a invoca',
  'workbench.editors.grpc.invoke.failed': 'Invocarea a eșuat — gazda nu a răspuns apelului',
  'workbench.editors.grpc.response.title': 'Răspuns',
  'workbench.editors.grpc.response.empty.prompt': 'Invocați o metodă pentru a primi un răspuns.',
  'workbench.editors.grpc.response.empty.invoking': 'Invocare în curs…',
  'workbench.editors.grpc.status.kicker': 'Stare gRPC',
  // Canonical gRPC status vocabulary — the official per-code
  // descriptions, verbatim, so the pill popover reads exactly like the
  // protocol documentation.
  'workbench.editors.grpc.status.desc.unknownCode': 'Un cod de stare nestandard, din afara vocabularului gRPC.',
  'workbench.editors.grpc.status.desc.OK':
    'Codul de stare 0 OK este răspunsul standard pentru invocarea cu succes a unei metode gRPC.',
  'workbench.editors.grpc.status.desc.CANCELLED':
    'Codul de stare 1 CANCELLED este returnat dacă operația este anulată de apelant.',
  'workbench.editors.grpc.status.desc.UNKNOWN':
    'Codul de stare 2 UNKNOWN este returnat dacă operația nu a putut fi finalizată din cauza unei erori necunoscute. De exemplu, această eroare poate fi returnată când o valoare Status primită dintr-un alt spațiu de adrese aparține unui spațiu de erori necunoscut în acest spațiu de adrese. De asemenea, erorile ridicate de interfețe API care nu returnează suficiente informații despre eroare pot fi convertite în această eroare.',
  'workbench.editors.grpc.status.desc.INVALID_ARGUMENT':
    'Codul de stare 3 INVALID_ARGUMENT este returnat dacă clientul a specificat un argument nevalid. Acesta acoperă argumentele problematice indiferent de starea sistemului (de ex. un nume de fișier malformat).',
  'workbench.editors.grpc.status.desc.DEADLINE_EXCEEDED':
    'Codul de stare 4 DEADLINE_EXCEEDED este returnat dacă termenul-limită expiră înainte ca operația să poată fi finalizată. Pentru operațiile care schimbă starea sistemului, această eroare poate fi returnată chiar dacă operația s-a finalizat cu succes. De exemplu, un răspuns reușit de la un server ar fi putut fi întârziat mult.',
  'workbench.editors.grpc.status.desc.NOT_FOUND':
    'Codul de stare 5 NOT_FOUND este returnat dacă o entitate cerută (de ex. fișier sau director) nu a fost găsită.',
  'workbench.editors.grpc.status.desc.ALREADY_EXISTS':
    'Codul de stare 6 ALREADY_EXISTS este returnat dacă entitatea pe care ați încercat să o creați (de ex. fișier sau director) există deja.',
  'workbench.editors.grpc.status.desc.PERMISSION_DENIED':
    'Codul de stare 7 PERMISSION_DENIED este returnat dacă apelantul nu are permisiunea de a executa operația specificată. Acest cod de eroare nu implică faptul că cererea este validă sau că entitatea cerută există ori satisface alte precondiții.',
  'workbench.editors.grpc.status.desc.RESOURCE_EXHAUSTED':
    'Codul de stare 8 RESOURCE_EXHAUSTED este returnat dacă o cotă per utilizator sau poate întregul sistem de fișiere a rămas fără spațiu.',
  'workbench.editors.grpc.status.desc.FAILED_PRECONDITION':
    'Codul de stare 9 FAILED_PRECONDITION este returnat dacă operația a fost respinsă pentru că sistemul nu se afla în starea necesară execuției operației. De exemplu, directorul de șters nu este gol, o operație rmdir este aplicată unui non-director etc.',
  'workbench.editors.grpc.status.desc.ABORTED':
    'Codul de stare 10 ABORTED este returnat dacă operația a fost abandonată, de obicei din cauza unei probleme de concurență, precum eșecul unei verificări de secvențiator sau abandonarea unei tranzacții.',
  'workbench.editors.grpc.status.desc.OUT_OF_RANGE':
    'Codul de stare 11 OUT_OF_RANGE este returnat dacă operația a fost încercată dincolo de intervalul valid. De exemplu, poziționarea sau citirea dincolo de sfârșitul fișierului.',
  'workbench.editors.grpc.status.desc.UNIMPLEMENTED':
    'Codul de stare 12 UNIMPLEMENTED este returnat dacă operația nu este implementată sau nu este acceptată/activată în acest serviciu.',
  'workbench.editors.grpc.status.desc.INTERNAL':
    'Codul de stare 13 INTERNAL este returnat dacă există o eroare internă. Aceasta înseamnă că unele invarianți așteptate de sistemul de bază au fost încălcate.',
  'workbench.editors.grpc.status.desc.UNAVAILABLE':
    'Codul de stare 14 UNAVAILABLE este returnat dacă serviciul este momentan indisponibil.',
  'workbench.editors.grpc.status.desc.DATA_LOSS':
    'Codul de stare 15 DATA_LOSS este returnat dacă există o pierdere sau o corupere irecuperabilă a datelor.',
  'workbench.editors.grpc.status.desc.UNAUTHENTICATED':
    'Codul de stare 16 UNAUTHENTICATED este returnat dacă cererea nu are acreditări de autentificare valide pentru operație.',
  'workbench.editors.grpc.response.error.title': 'Apelul a eșuat',
  'workbench.editors.grpc.response.error.localGuidance':
    'Apelul nu a ajuns niciodată la un răspuns. Verificați ținta, modul TLS și dacă serverul este accesibil.',
  'workbench.editors.grpc.response.error.statusGuidance': 'Verificați mesajul și invocați metoda din nou.',
  'workbench.editors.grpc.response.tab.response': 'Răspuns',
  'workbench.editors.grpc.response.tab.metadata': 'Metadata',
  'workbench.editors.grpc.response.tab.metadataCount': 'Metadata ({count})',
  'workbench.editors.grpc.response.tab.trailers': 'Trailers',
  'workbench.editors.grpc.response.tab.trailersCount': 'Trailers ({count})',
  'workbench.editors.grpc.response.filterMetadata': 'Filtrare metadate',
  'workbench.editors.grpc.response.filterTrailers': 'Filtrare trailere',
  'workbench.editors.grpc.response.duration': '{ms} ms',
  'workbench.editors.grpc.response.noStatus': 'Nicio stare gRPC',
  'workbench.editors.grpc.response.connectionLost': 'Conexiune pierdută',
  'workbench.editors.grpc.response.includeDefaultValues': 'Includere valori implicite',
  'workbench.editors.grpc.response.noMessage': 'Răspunsul nu a purtat niciun mesaj de răspuns.',
  'workbench.editors.grpc.response.noMetadata': 'Fără metadate',
  'workbench.editors.grpc.response.noTrailers': 'Fără trailere',
  'workbench.editors.grpc.response.trailersOnly':
    'Răspuns doar cu trailere — starea a sosit împreună cu metadatele inițiale și niciun mesaj nu a urmat.',
  'workbench.editors.grpc.response.compressed':
    'Cadrul de răspuns este comprimat — compresia nu este negociată, așa că nu poate fi decodat.',
  'workbench.editors.grpc.response.structuralNotice':
    'Decodare structurală (numere de câmp) — tipul răspunsului nu s-a rezolvat față de specificația legată.',
  'workbench.editors.grpc.response.rawNotice': 'Mesajul nu s-a decodat; octeții bruți sunt afișați ca base64.',
  'workbench.editors.grpc.response.extraFrames':
    'Au sosit {count} cadre de mesaj — un răspuns unar poartă unul singur; se afișează primul.',
  'workbench.editors.grpc.response.incompleteTail':
    'Răspunsul s-a încheiat la mijlocul unui cadru; se afișează cadrele complete.',
  'workbench.editors.grpc.response.truncated': 'Răspuns plafonat la {bytes} octeți.',
  'workbench.editors.grpc.tab.docs': 'Docs',
  'workbench.editors.grpc.tab.message': 'Mesaj',
  'workbench.editors.grpc.tab.metadata': 'Metadata',
  'workbench.editors.grpc.tab.scripts': 'Scripturi',
  'workbench.editors.grpc.tab.settings': 'Setări',
  'workbench.editors.grpc.messagePlaceholder': 'Mesajul cererii ca JSON',
  'workbench.editors.grpc.example.label': 'Utilizare mesaj exemplu',
  'workbench.editors.grpc.example.needsMethod':
    'Alegeți mai întâi o metodă care se rezolvă față de specificația legată',
  'workbench.editors.grpc.metadata.keyPlaceholder': 'Cheie',
  'workbench.editors.grpc.metadata.valuePlaceholder': 'Valoare',
  'workbench.editors.grpc.spec.selectLabel': 'Specificație Protobuf',
  'workbench.editors.grpc.spec.selectPlaceholder': 'Legați o specificație Protobuf…',
  'workbench.editors.grpc.spec.summary': 'servicii: {services} · metode: {methods}',
  'workbench.editors.grpc.spec.parseFailure': '{path}: {message}',
  'workbench.editors.grpc.spec.issue': '{kind}: {reference}',
  'workbench.editors.grpc.spec.importReadFailed': 'Citirea fișierului a eșuat: {message}',
  'workbench.editors.grpc.spec.importFailed': 'Importul fișierului .proto a eșuat',
  'workbench.editors.grpc.method.usingSpec': 'Se folosește {name}',
  'workbench.editors.grpc.method.refreshSpec': 'Reconstruire din fișierele curente ale specificației',
  'workbench.editors.grpc.settings.exampleCaption': 'Exemplu de apel',
  'workbench.editors.grpc.settings.group.connection': 'Conexiune',
  'workbench.editors.grpc.settings.group.tls': 'TLS și încredere',
  'workbench.editors.grpc.settings.group.messages': 'Mesaje',
  'workbench.editors.grpc.settings.groupInfo.connection':
    'Cum ajunge apelul la server: unde stabilește canalul conexiunea, numele căruia îi este adresat apelul, plafonul pentru întregul apel și ping-ul keepalive care prinde o conexiune moartă în mijlocul apelului.',
  'workbench.editors.grpc.settings.groupInfo.tls':
    'Cum stabilesc încrederea canalele TLS: dacă certificatul serverului este verificat față de rădăcinile sistemului, certificatul de client pe care îl prezintă acest dispozitiv, fereastra de versiuni TLS și lista de cifruri la handshake, precum și numele SNI pe care îl oferă.',
  'workbench.editors.grpc.settings.groupInfo.messages':
    'Cum tratează fereastra Workbench un mesaj care nu se parsează — o postură la nivelul întregii aplicații, partajată cu setările Cereri API, nu un câmp per cerere.',
  'workbench.editors.grpc.settings.unixSocketLabel': 'Socket Unix',
  'workbench.editors.grpc.settings.unixSocketHelp':
    'Stabilește conexiunea prin acest socket local — o cale absolută de socket Unix sau un named pipe Windows precum \\\\.\\pipe\\name — în loc să deschidă o conexiune TCP. Ținta decide în continuare antetul :authority, numele de server TLS și verificarea certificatului; se schimbă doar unde ajunge conexiunea. Lăsați gol pentru o conexiune TCP normală.',
  'workbench.editors.grpc.settings.unixSocketPlaceholder': 'Conexiune TCP (implicit)',
  'workbench.editors.grpc.settings.timeoutLabel': 'Timp de așteptare apel',
  'workbench.editors.grpc.settings.timeoutHelp':
    'Plafon de timp real pentru întregul apel — trimis ca termen-limită gRPC, astfel încât serverul să îl poată impune, și impus local. Gol înseamnă fără termen-limită.',
  'workbench.editors.grpc.settings.timeoutPlaceholder': 'Fără limită (implicit)',
  'workbench.editors.grpc.settings.authorityLabel': 'Authority',
  'workbench.editors.grpc.settings.authorityHelp':
    'Valoarea :authority căreia îi este adresat apelul în rețea — numele pe care rutează serverul — în timp ce conexiunea merge în continuare la țintă. Pentru un gateway care rutează după authority sau pentru un server accesat prin IP care își așteaptă propriul nume. Numele de server TLS și verificarea certificatului păstrează gazda țintei; setarea Nume de server SNI o schimbă pe aceea. Lăsați gol pentru a trimite ținta însăși.',
  'workbench.editors.grpc.settings.authorityPlaceholder': 'Ținta (implicit)',
  'workbench.editors.grpc.settings.keepaliveIntervalLabel': 'Ping keepalive',
  'workbench.editors.grpc.settings.keepaliveIntervalHelp':
    'Trimite un cadru HTTP/2 PING la această cadență cât timp apelul este deschis, astfel încât un flux de server tăcut sau un apel unar lent să afle de o conexiune moartă în loc să aștepte termenul-limită. Fiecare conexiune servește un singur apel, așa că nu există nimic de menținut activ între apeluri. Serverele resping ping-urile care sosesc mai des decât pragul lor — implicit 5 minute fără date în circulație — închizând conexiunea cu too_many_pings; apelul o numește apoi. Lăsați gol pentru niciun ping.',
  'workbench.editors.grpc.settings.keepaliveIntervalPlaceholder': 'Fără ping-uri (implicit)',
  'workbench.editors.grpc.settings.keepaliveTimeoutLabel': 'Timp de așteptare keepalive',
  'workbench.editors.grpc.settings.keepaliveTimeoutHelp':
    'Cât timp se așteaptă confirmarea ping-ului înainte ca conexiunea să fie declarată moartă și apelul să se încheie numind-o. Lăsați gol pentru valoarea implicită de 20 s.',
  'workbench.editors.grpc.settings.keepaliveTimeoutPlaceholder': '20 s (implicit)',
  'workbench.editors.grpc.settings.sendInvalidMessageLabel': 'Trimitere mesaje nevalide',
  'workbench.editors.grpc.settings.sendInvalidMessageHelp':
    'Când mesajul nu este JSON valid, invocă oricum cu un mesaj gol și lasă serverul să răspundă — de obicei INVALID_ARGUMENT. Dezactivat implicit: invocarea eșuează înainte de rețea, cu eroarea exactă de parsare. Se aplică fiecărei cereri gRPC.',
  'workbench.editors.grpc.tab.auth': 'Autorizare',
  'workbench.editors.grpc.auth.help':
    'Trimis ca metadate authorization: Bearer <token> pe apel. Un rând de metadate authorization explicit are prioritate.',
  'workbench.editors.grpc.auth.inheritUnsupported': '{type} — de la {source} — nu poate fi aplicat unui apel gRPC.',
  'workbench.editors.grpc.auth.helpOwn':
    'Emis o singură dată per invocare și trimis ca metadate authorization (sau cu numele propriu al cheii) pe apel — o plasare în interogare nu circulă niciodată pe un apel gRPC. Un rând de metadate explicit cu același nume are prioritate.',
  'workbench.editors.grpc.auth.ownUnsupported': '{type} nu poate fi aplicat unui apel gRPC.',
  // ── gRPC streaming pane + message timeline ──────────────────────────
  'workbench.editors.grpc.stream.streamingBadge': 'Streaming',
  'workbench.editors.grpc.stream.stoppedBadge': 'Oprit',
  'workbench.editors.grpc.stream.tab.timeline': 'Cronologie',
  'workbench.editors.grpc.stream.trailersPending': 'Trailerele sosesc când apelul se finalizează.',
  'workbench.editors.grpc.stream.sendMessage': 'Trimitere mesaj',
  'workbench.editors.grpc.stream.endStreaming': 'Încheiere streaming',
  'workbench.editors.grpc.stream.controlsIdle': 'Invocați apelul pentru a deschide mai întâi fluxul',
  'workbench.editors.grpc.stream.sendFailed': 'Mesajul nu s-a trimis',
  'workbench.editors.grpc.timeline.requestSent': 'Cerere trimisă',
  'workbench.editors.grpc.timeline.noMetadataSent': 'Nicio metadată trimisă.',
  // {metadata} marks where the linked word (receivedMetadataLink)
  // renders — the display splits on it, so word order stays free.
  'workbench.editors.grpc.timeline.receivedMetadata': 'S-au primit {metadata}.',
  'workbench.editors.grpc.timeline.receivedMetadataLink': 'metadate',
  'workbench.editors.grpc.timeline.noMetadataReceived': 'Nicio metadată primită.',
  'workbench.editors.grpc.timeline.responseReceived': 'Răspuns primit',
  'workbench.editors.grpc.timeline.completed': 'Apel finalizat',
  'workbench.editors.grpc.timeline.stopped': 'Apel oprit',
  'workbench.editors.grpc.timeline.failed': 'Apelul a eșuat',
  'workbench.editors.grpc.timeline.lost': 'Conexiune pierdută',
  'workbench.editors.grpc.timeline.noMatches': 'Niciun mesaj nu corespunde.',
  'workbench.editors.grpc.timeline.searchMessages': 'Căutare mesaje',
  'workbench.editors.grpc.timeline.filterAll': 'Toate',
  'workbench.editors.grpc.timeline.filterSent': 'Trimise',
  'workbench.editors.grpc.timeline.filterReceived': 'Primite',
  'workbench.editors.grpc.timeline.messageCount': ({ count }, locale) =>
    plural(locale, Number(count), { one: '{count} mesaj', few: '{count} mesaje', other: '{count} de mesaje' }),
  'workbench.editors.grpc.timeline.sortOrder': 'Sortare și grupare',
  'workbench.editors.grpc.timeline.newestFirst': 'Cele mai noi primele',
  'workbench.editors.grpc.timeline.oldestFirst': 'Cele mai vechi primele',
  'workbench.editors.grpc.timeline.showTypes': 'Afișare tipuri de mesaje',
  'workbench.editors.grpc.timeline.groupByType': 'Grupare după tipul mesajului',
  'workbench.editors.grpc.timeline.groupByDirection': 'Grupare după direcție',
  'workbench.editors.grpc.timeline.rowsPerGroup': 'Rânduri per grup',
  'workbench.editors.grpc.timeline.noLimit': 'Fără limită',
  'workbench.editors.grpc.timeline.clearMessages': 'Golire mesaje (doar afișarea)',
  'workbench.editors.grpc.timeline.trustCertificate': 'Acordare încredere certificatului',
  'workbench.editors.grpc.timeline.newMessages': 'Mesaje noi',
  'workbench.editors.grpc.timeline.sentAria': 'Mesaj trimis',
  'workbench.editors.grpc.timeline.receivedAria': 'Mesaj primit',
  'workbench.editors.grpc.timeline.script': '{hook} — {levels}',
  'workbench.editors.grpc.timeline.scriptFailed': '{hook} a eșuat — {error}',
  // ── The call's scripts — the result panes' Scripts tab and tag ──────
  'workbench.editors.grpc.response.tab.scripts': 'Scripturi',
  'workbench.editors.grpc.scripts.empty': 'Niciun script nu a rulat în acest apel.',
  'workbench.editors.grpc.scripts.console': 'Consolă',
  'workbench.editors.grpc.scripts.tests': 'Tests',
  'workbench.editors.grpc.scripts.consoleEmpty': 'Nimic înregistrat în jurnal.',
  'workbench.editors.grpc.scripts.testsEmpty': 'Nicio aserțiune înregistrată.',
  'workbench.editors.grpc.scripts.attempt': 'încercarea {attempt}',
  'workbench.editors.grpc.scripts.atMessage': 'mesajul {index}',
  'workbench.editors.grpc.scripts.tag': 'Scripturi · {count}',
  'workbench.editors.grpc.scripts.tagTitle': 'Scripturile apelului',
  'workbench.editors.grpc.scripts.tagSummary':
    'Hook-urile care au rulat în acest apel, cu nivelurile care au contribuit.',
  'workbench.editors.grpc.scripts.tagSummaryFailed': 'Un hook a eșuat — ultima sa eroare este listată sub el.',
  'workbench.editors.grpc.scripts.runs': 'rulări: {count}',
  'workbench.editors.grpc.scripts.runsOne': '1 rulare',
  'workbench.editors.grpc.scripts.failed': 'eșuate: {count}',
  'workbench.editors.grpc.scripts.dropped': 'eliminate: {count}',
  'workbench.editors.grpc.scripts.marksCapped':
    'Detaliile per mesaj s-au oprit după {count} rulări; hook-urile rulează în continuare, iar numărătoarea completă apare când apelul se încheie.',
  'workbench.editors.grpc.toast.deletedOtherTab': 'Cererea gRPC a fost ștearsă dintr-o altă filă',
  'workbench.editors.grpc.toast.updateFailed': 'Actualizarea cererii gRPC a eșuat',
  'workbench.editors.grpc.toast.updateFailedDetail': 'Actualizarea cererii gRPC a eșuat: {message}',
  'workbench.editors.grpc.response.saveResponse': 'Salvare răspuns',
  'workbench.editors.grpc.toast.savedExample': 'Exemplul „{name}” a fost salvat',
  'workbench.editors.grpc.toast.saveExampleFailed': 'Salvarea exemplului a eșuat',
  'workbench.editors.grpc.toast.saveExampleFailedDetail': 'Salvarea exemplului a eșuat: {message}',
  'workbench.editors.grpcExample.loading': 'Se încarcă exemplul…',
  'workbench.editors.grpcExample.notFound': 'Exemplul nu a fost găsit.',
  'workbench.editors.grpcExample.toast.deletedOtherTab': 'Exemplul a fost șters dintr-o altă filă',
  'workbench.editors.grpcExample.toast.saveFailed': 'Salvarea exemplului a eșuat',
  'workbench.editors.grpcExample.toast.saveFailedDetail': 'Salvarea exemplului a eșuat: {message}',
  'workbench.editors.grpcExample.openInRequest': 'Deschidere în cerere',
  'workbench.editors.grpcExample.openInRequestTooltip':
    'Copiază apelul capturat al acestui exemplu în editorul cererii gRPC părinte, ca editări nesalvate',
  'workbench.editors.grpcExample.noMethod': 'Nicio metodă înregistrată',
  'workbench.editors.grpcExample.capturedTooltip': 'Capturat la {date}',
  'workbench.editors.grpcExample.result.title': 'Răspuns capturat',
} as const satisfies Catalog;
