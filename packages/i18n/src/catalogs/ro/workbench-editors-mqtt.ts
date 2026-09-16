/**
 * Workbench editors — the MQTT client editor — Romanian. Mirrors
 * `catalogs/en/workbench-editors-mqtt.ts` key for key. Wire
 * vocabulary rides raw inside keyed values: mqtt/mqtts/ws/wss schemes,
 * CONNECT / PUBLISH / SUBSCRIBE / PINGREQ / CONNACK / DISCONNECT /
 * RETAIN tokens, QoS, topic filters (+ / #), Base64 / Hexadecimal
 * encodings, AsyncAPI, `Last Will` / `Docs` tab nouns, and the 5.0
 * property and setting names (Response Topic / Correlation Data /
 * Clean Start / Keep Alive / …) which the spec fixes in English.
 * subiect = topic; filtru de subiecte = topic filter; conținut util =
 * payload (shared mint); Reținere = the Retain flag / Reținut =
 * Retained; ultima dorință = last will (prose); abonare / abonament =
 * subscribe / subscription; sesiune = session; broker = broker;
 * reziliență = resilience; reconectare = redial / reconnect;
 * Autorizare / Mesaj / Subiecte / Proprietăți / Setări / Scripturi =
 * the editor tab family (THE TAB-NOUN DECISION, S109). Every raw
 * token takes a head noun (pachetul CONNECT, pachetul DISCONNECT,
 * sesiunile {scheme}://, mesajele QoS 1/2); the reconnect tails read
 * `reconectarea a renunțat după {attempts}` with `o încercare` /
 * `{count} încercări` / `{count} de încercări` as the fillers;
 * thousands take a period (65.535).
 */

import type { Catalog } from '../../types';

export const workbenchEditorsMqtt = {
  // ── MQTT request editor ─────────────────────────────────────────────
  'workbench.editors.mqtt.notFound': 'Cererea MQTT nu a fost găsită.',
  'workbench.editors.mqtt.urlPlaceholder': 'mqtt://broker.openheaders.com:1883',
  'workbench.editors.mqtt.version.tooltip':
    'Versiunea protocolului MQTT pe care o vorbește sesiunea.\n5.0 · proprietăți și opțiuni de abonare\n3.1.1 · brokeri care refuză 5.0',
  'workbench.editors.mqtt.version.v5': 'V5',
  'workbench.editors.mqtt.version.v311': 'V3.1.1',
  'workbench.editors.mqtt.version.lockedWhileConnected': 'Versiunea nu poate fi schimbată cât timp sunteți conectat.',
  'workbench.editors.mqtt.connect.label': 'Conectare',
  'workbench.editors.mqtt.connect.disconnect': 'Deconectare',
  'workbench.editors.mqtt.connect.cancel': 'Anulare',
  'workbench.editors.mqtt.connect.reconnectNow': 'Reconectare acum',
  'workbench.editors.mqtt.connect.reconnectNowHint':
    'Lansează următoarea încercare de reconectare fără a aștepta expirarea perioadei',
  'workbench.editors.mqtt.connect.needsUrl': 'Introduceți adresa URL a unui broker pentru a vă conecta.',
  'workbench.editors.mqtt.tab.docs': 'Docs',
  'workbench.editors.mqtt.tab.message': 'Mesaj',
  'workbench.editors.mqtt.tab.topics': 'Subiecte',
  'workbench.editors.mqtt.tab.auth': 'Autorizare',
  'workbench.editors.mqtt.tab.properties': 'Proprietăți',
  'workbench.editors.mqtt.tab.lastWill': 'Last Will',
  'workbench.editors.mqtt.tab.settings': 'Setări',
  'workbench.editors.mqtt.qos.compactLabel': 'QoS:',
  'workbench.editors.mqtt.qos.meaning0': 'Cel mult o dată',
  'workbench.editors.mqtt.qos.meaning1': 'Cel puțin o dată',
  'workbench.editors.mqtt.qos.meaning2': 'Exact o dată',
  'workbench.editors.mqtt.retainLabel': 'Reținere',
  'workbench.editors.mqtt.sendLabel': 'Trimitere',
  'workbench.editors.mqtt.topicPlaceholder': 'Subiectul pe care se publică',
  'workbench.editors.mqtt.topicExample': 'de ex. sensors/1/temperature',
  'workbench.editors.mqtt.payload.formatText': 'Text',
  'workbench.editors.mqtt.payload.formatJson': 'JSON',
  'workbench.editors.mqtt.payload.formatBase64': 'Base64',
  'workbench.editors.mqtt.payload.formatHex': 'Hexazecimal',
  'workbench.editors.mqtt.payload.invalidGate': 'Corectați mai întâi codificarea conținutului util.',
  'workbench.editors.mqtt.payload.invalidBase64': 'Base64 nevalid — octeții decodați sunt cei care s-ar publica.',
  'workbench.editors.mqtt.payload.invalidHex':
    'Hexazecimal nevalid — perechile de cifre 0-9 a-f se decodează în octeții publicați.',
  'workbench.editors.mqtt.payloadPlaceholder': 'Compuneți conținutul util de publicat…',
  'workbench.editors.mqtt.payloadPlaceholderBase64': 'Base64 al conținutului util binar, de ex. aGVsbG8=…',
  'workbench.editors.mqtt.payloadPlaceholderHex': 'Hexazecimalul conținutului util binar, de ex. 48656c6c6f…',
  'workbench.editors.mqtt.props.buttonTooltip': 'Opțiuni mesaj',
  'workbench.editors.mqtt.props.hint': 'Metadate MQTT 5.0 trimise cu fiecare mesaj.',
  'workbench.editors.mqtt.props.v311':
    'Proprietățile mesajului sunt o funcție MQTT 5.0 — această cerere țintește 3.1.1.',
  'workbench.editors.mqtt.props.userPropKey': 'Proprietate',
  'workbench.editors.mqtt.props.userPropValue': 'Valoare',
  'workbench.editors.mqtt.props.addUserProp': 'Proprietate de utilizator',
  'workbench.editors.mqtt.props.removeUserProp': 'Eliminare proprietate de utilizator',
  'workbench.editors.mqtt.props.responseTopic': 'Response Topic',
  'workbench.editors.mqtt.props.responseTopicDesc':
    'Subiectul pe care destinatarului i se cere să răspundă — cerere/răspuns peste pub/sub. Gol înseamnă că proprietatea nu se trimite.',
  'workbench.editors.mqtt.props.correlationData': 'Correlation Data',
  'workbench.editors.mqtt.props.correlationDataDesc':
    'Token opac pe care destinatarul îl copiază pe răspunsul său, astfel încât răspunsul să poată fi potrivit cu acest mesaj. Gol înseamnă că proprietatea nu se trimite.',
  'workbench.editors.mqtt.props.messageExpiry': 'Message Expiry Interval',
  'workbench.editors.mqtt.props.messageExpiryDesc':
    'Secundele în care brokerul păstrează mesajul livrabil; după ce trec, este eliminat în loc să fie livrat. Gol înseamnă că mesajul nu expiră niciodată.',
  'workbench.editors.mqtt.props.messageExpiryPlaceholder': 'Fără expirare (implicit)',
  'workbench.editors.mqtt.props.contentType': 'Content Type',
  'workbench.editors.mqtt.props.contentTypeDesc':
    'Tipul MIME care descrie conținutul util, transmis destinatarilor ca atare. Gol înseamnă că proprietatea nu se trimite.',
  'workbench.editors.mqtt.props.payloadFormatIndicator': 'Payload Format Indicator',
  'workbench.editors.mqtt.props.payloadFormatIndicatorDesc':
    'Marchează conținutul util ca text UTF-8, nu ca octeți nespecificați; brokerul și destinatarii îl pot valida.',
  'workbench.editors.mqtt.props.nonePlaceholder': 'Niciunul (implicit)',
  'workbench.editors.mqtt.props.sectionProperties': 'Proprietăți',
  'workbench.editors.mqtt.props.sectionPropertiesDesc':
    'Perechi cheie–valoare libere purtate cu mesajul — metadate de aplicație pe care brokerul le transmite ca atare.',
  'workbench.editors.mqtt.props.sectionSettings': 'Setări',
  'workbench.editors.mqtt.saved.title': 'Mesaje salvate',
  'workbench.editors.mqtt.saved.addTooltip': 'Salvați compunerea curentă ca mesaj reutilizabil',
  'workbench.editors.mqtt.saved.topicTagPlaceholder': 'subiect',
  'workbench.editors.mqtt.saved.showRail': 'Afișare mesaje salvate',
  'workbench.editors.mqtt.saved.hideRail': 'Ascundere mesaje salvate',
  'workbench.editors.mqtt.saved.emptyHint': 'Salvați mesaje pentru a le reutiliza în timpul unei conexiuni active.',
  'workbench.editors.mqtt.saved.defaultName': 'Mesaj',
  'workbench.editors.mqtt.saved.sendTooltip': 'Publică acest mesaj salvat așa cum este stocat',
  'workbench.editors.mqtt.saved.rename': 'Redenumire',
  'workbench.editors.mqtt.saved.duplicate': 'Duplicare',
  'workbench.editors.mqtt.saved.delete': 'Ștergere',
  'workbench.editors.mqtt.topics.hint':
    'Abonamentele cu care se deschide sesiunea. Metacaracterele + și # sunt binevenite; rândurile dezactivate rămân salvate, dar nu se abonează.',
  'workbench.editors.mqtt.topics.filterLabel': 'Subiect',
  'workbench.editors.mqtt.topics.filterPlaceholder': 'Subiect, de ex. sensors/+/temperature',
  'workbench.editors.mqtt.topics.qosColLabel': 'QoS',
  'workbench.editors.mqtt.topics.optionsColLabel': 'Opțiuni',
  'workbench.editors.mqtt.topics.optionsTooltip': 'Opțiuni de abonare',
  'workbench.editors.mqtt.topics.subscribeColLabel': 'Abonare',
  'workbench.editors.mqtt.topics.subscribeLabel': 'Abonare la deschiderea sesiunii',
  'workbench.editors.mqtt.topics.subscribeLiveLabel':
    'Abonare / dezabonare pe sesiunea deschisă — rândul salvat nu se editează',
  'workbench.editors.mqtt.topics.optionsHint': 'Opțiuni de abonare MQTT 5.0 pentru acest rând.',
  'workbench.editors.mqtt.topics.noLocal': 'No Local',
  'workbench.editors.mqtt.topics.noLocalDesc': 'Brokerul nu returnează acestui client propriile publicări.',
  'workbench.editors.mqtt.topics.retainAsPublished': 'Retain As Published',
  'workbench.editors.mqtt.topics.retainAsPublishedDesc':
    'Mesajele păstrează indicatorul RETAIN exact așa cum au fost publicate.',
  'workbench.editors.mqtt.topics.retainHandling': 'Retain Handling',
  'workbench.editors.mqtt.topics.retainHandlingDesc':
    'Dacă brokerul trimite mesajele reținute existente la crearea acestui abonament.',
  'workbench.editors.mqtt.topics.retainHandlingValuesHeading': 'Valori',
  'workbench.editors.mqtt.topics.retainHandling0': '0 · Primire la abonare',
  'workbench.editors.mqtt.topics.retainHandling0Desc':
    'Brokerul trimite mesajele reținute de fiecare dată când se creează acest abonament.',
  'workbench.editors.mqtt.topics.retainHandling1': '1 · Doar abonamente noi',
  'workbench.editors.mqtt.topics.retainHandling1Desc':
    'Brokerul trimite mesajele reținute doar dacă acest abonament nu există deja.',
  'workbench.editors.mqtt.topics.retainHandling2': '2 · Fără primire',
  'workbench.editors.mqtt.topics.retainHandling2Desc':
    'Brokerul nu trimite niciun mesaj reținut pentru acest abonament.',
  'workbench.editors.mqtt.topics.subscriptionId': 'Subscription Identifier',
  'workbench.editors.mqtt.topics.subscriptionIdDesc':
    'Un id numeric pe care brokerul îl atașează mesajelor livrate prin acest abonament.',
  'workbench.editors.mqtt.topics.subscriptionIdPlaceholder': 'Niciunul (implicit)',
  'workbench.editors.mqtt.topics.subscribeProperties': 'Proprietăți',
  'workbench.editors.mqtt.topics.subscribePropertiesDesc':
    'Proprietăți de utilizator trimise o singură dată cu pachetul SUBSCRIBE al acestui rând. Brokerul le definește semnificația; nu sunt atașate mesajelor livrate.',
  'workbench.editors.mqtt.topics.subscribeSettings': 'Setări',
  'workbench.editors.mqtt.auth.help':
    'Trimise ca User Name și Password ale pachetului CONNECT pe fiecare gazdă — ambele versiuni MQTT le poartă. Variabilele se rezolvă la Conectare; exemplele salvate nu capturează niciodată acreditarea.',
  'workbench.editors.mqtt.auth.inheritUnsupported': '{type} — de la {source} — nu poate fi aplicat unei sesiuni MQTT.',
  'workbench.editors.mqtt.auth.ownUnsupported': '{type} nu poate fi aplicat unei sesiuni MQTT.',
  'workbench.editors.mqtt.userProps.hint':
    'Proprietăți de utilizator trimise la CONNECT — metadate libere pe care brokerul și alte instrumente le pot citi.',
  'workbench.editors.mqtt.userProps.v311':
    'Proprietățile de utilizator CONNECT sunt o funcție MQTT 5.0 — această cerere țintește 3.1.1.',
  'workbench.editors.mqtt.userProps.keyPlaceholder': 'Proprietate',
  'workbench.editors.mqtt.userProps.valuePlaceholder': 'Valoare',
  'workbench.editors.mqtt.will.hint':
    'Înregistrată la broker la CONNECT și publicată în numele dvs. dacă sesiunea cade fără o deconectare curată. Un subiect gol înseamnă fără ultimă dorință.',
  'workbench.editors.mqtt.will.topicPlaceholder': 'Subiectul pentru ultima dorință',
  'workbench.editors.mqtt.will.topicExample': 'de ex. clients/reporter/status',
  'workbench.editors.mqtt.will.delayHelp': 'Will Delay Interval, în secunde — MQTT 5.0.',
  'workbench.editors.mqtt.will.delayLabel': 'Întârziere ultima dorință',
  'workbench.editors.mqtt.will.delayPlaceholder': '0 s (implicit)',
  'workbench.editors.mqtt.will.payloadPlaceholder': 'Compuneți conținutul util al ultimei dorințe…',
  'workbench.editors.mqtt.spec.selectLabel': 'Specificație AsyncAPI',
  'workbench.editors.mqtt.spec.selectPlaceholder': 'Legați o specificație AsyncAPI',
  'workbench.editors.mqtt.spec.summary': 'servere: {servers} · canale: {channels} · operații: {operations}',
  'workbench.editors.mqtt.spec.parseFailure': 'Specificația nu s-a parsat: {message}',
  'workbench.editors.mqtt.spec.issues': 'probleme în specificație: {count}',
  'workbench.editors.mqtt.spec.useExample': 'Utilizare mesaj exemplu…',
  'workbench.editors.mqtt.spec.browser.hint':
    'Alegeți un mesaj pentru a-i compune conținutul util de exemplu; un mesaj de canal completează și subiectul de publicare.',
  'workbench.editors.mqtt.spec.browser.servers': 'Servere',
  'workbench.editors.mqtt.spec.browser.channels': 'Canale',
  'workbench.editors.mqtt.spec.browser.operations': 'Operații',
  'workbench.editors.mqtt.spec.browser.components': 'Componente',
  'workbench.editors.mqtt.settings.exampleCaption': 'Exemplu de sesiune',
  'workbench.editors.mqtt.settings.clientIdLabel': 'Client ID',
  'workbench.editors.mqtt.settings.clientIdHelp':
    'Identificatorul purtat de CONNECT. Gol generează unul nou la fiecare conectare; reluarea unei sesiuni de broker necesită un ID stabil.',
  'workbench.editors.mqtt.settings.clientIdPlaceholder': 'Automat — generat la conectare',
  'workbench.editors.mqtt.settings.cleanStartLabel': 'Clean Start',
  'workbench.editors.mqtt.settings.cleanStartHelp':
    'Pornește o sesiune de broker nouă la conectare. Dezactivați pentru a relua abonamentele și mesajele din coadă dintr-o sesiune anterioară — aceasta necesită și un Client ID stabil.',
  'workbench.editors.mqtt.settings.sessionExpiryLabel': 'Session Expiry Interval',
  'workbench.editors.mqtt.settings.sessionExpiryHelp':
    'Cât timp păstrează brokerul sesiunea după deconectare — 0 o încheie la deconectare. Clean Start elimină doar sesiunea anterioară la conectare; intervalul guvernează noua sesiune în ambele cazuri.',
  'workbench.editors.mqtt.settings.zeroDefault': '0 s (implicit)',
  'workbench.editors.mqtt.settings.keepAliveLabel': 'Keep Alive',
  'workbench.editors.mqtt.settings.keepAliveHelp':
    'Intervalul de ping pe care sesiunea îl promite brokerului — clientul răspunde și emite PINGREQ. Gol folosește 60 s; 0 dezactivează keep-alive.',
  'workbench.editors.mqtt.settings.keepAlivePlaceholder': '60 s (implicit)',
  'workbench.editors.mqtt.settings.timeoutLabel': 'Timp de așteptare conectare',
  'workbench.editors.mqtt.settings.timeoutHelp':
    'Plafon de timp real doar pentru stabilirea conexiunii — o sesiune deschisă nu are plafon. Gol folosește valoarea implicită de 30 s.',
  'workbench.editors.mqtt.settings.timeoutPlaceholder': '30 s (implicit)',
  'workbench.editors.mqtt.settings.receiveMaximumLabel': 'Receive Maximum',
  'workbench.editors.mqtt.settings.receiveMaximumHelp':
    'Câte mesaje QoS 1/2 pot fi în zbor către acest client simultan. Gol permite valoarea implicită din specificație, 65.535.',
  'workbench.editors.mqtt.settings.receiveMaximumPlaceholder': '65.535 (implicit)',
  'workbench.editors.mqtt.settings.maxPacketSizeLabel': 'Maximum Packet Size',
  'workbench.editors.mqtt.settings.maxPacketSizeHelp':
    'Cel mai mare pachet pe care îl acceptă acest client — brokerul le elimină pe cele mai mari. Gol nu setează nicio limită.',
  'workbench.editors.mqtt.settings.noLimit': 'Fără limită (implicit)',
  'workbench.editors.mqtt.settings.cleanSessionLabel': 'Clean Session',
  'workbench.editors.mqtt.settings.topicAliasMaximumLabel': 'Topic Alias Maximum',
  'workbench.editors.mqtt.settings.topicAliasMaximumHelp':
    'Cu câte aliasuri de subiect poate brokerul să se adreseze acestui client — publicările cu alias poartă un număr în locul subiectului. Gol nu permite niciunul, valoarea implicită din specificație.',
  'workbench.editors.mqtt.settings.topicAliasMaximumPlaceholder': '0 (implicit)',
  'workbench.editors.mqtt.settings.requestResponseInfoLabel': 'Request Response Information',
  'workbench.editors.mqtt.settings.requestResponseInfoHelp':
    'Cere brokerului Response Information la CONNACK — subiectul de bază pentru schimburile cerere/răspuns. Dezactivat implicit.',
  'workbench.editors.mqtt.settings.requestProblemInfoLabel': 'Request Problem Information',
  'workbench.editors.mqtt.settings.requestProblemInfoHelp':
    'Permite brokerului să atașeze Reason Strings și proprietăți de utilizator pachetelor de eșec. Activat implicit.',
  'workbench.editors.mqtt.settings.clientIdExample': 'de ex. reporter-1',
  'workbench.editors.mqtt.settings.alpnLabel': 'Protocol ALPN',
  'workbench.editors.mqtt.settings.alpnHelp':
    'Protocolul de aplicație oferit în handshake-ul TLS al sesiunilor mqtts — brokerii care multiplexează MQTT pe un port TLS partajat selectează după el. Gol nu oferă niciunul.',
  'workbench.editors.mqtt.settings.alpnPlaceholder': 'Niciunul (implicit)',
  'workbench.editors.mqtt.settings.alpnExample': 'de ex. mqtt',
  'workbench.editors.mqtt.settings.group.connection': 'Conexiune',
  'workbench.editors.mqtt.settings.group.session': 'Sesiune — MQTT 5.0',
  'workbench.editors.mqtt.settings.group.tls': 'TLS și încredere',
  'workbench.editors.mqtt.settings.group.resilience': 'Reziliența sesiunii',
  'workbench.editors.mqtt.settings.groupInfo.resilience':
    'Dacă o conexiune căzută se redeschide și cu câtă răbdare: perioada de reconectare, plafonul de încercări și backoff-ul exponențial între încercări.',
  'workbench.editors.mqtt.settings.groupInfo.connection':
    'Cum deschide CONNECT sesiunea: identitatea pe care o prezintă, dacă pornește de la zero și plafoanele de ping și de conectare pe care le promite.',
  'workbench.editors.mqtt.settings.groupInfo.session':
    'Termenii MQTT 5.0 pe care CONNECT îi oferă brokerului: cât timp supraviețuiește sesiunea unei deconectări, plus plafoanele de mesaje în zbor și de dimensiune a pachetelor pe care le acceptă acest client.',
  'workbench.editors.mqtt.settings.groupInfo.tls':
    'Cum stabilesc încrederea sesiunile mqtts/wss: dacă certificatul brokerului este verificat față de rădăcinile sistemului, certificatul de client pe care îl prezintă acest dispozitiv, fereastra de versiuni TLS și lista de cifruri, precum și numele SNI și oferta ALPN la handshake.',
  'workbench.editors.mqtt.settings.sessionV311': 'Setări MQTT 5.0 — această cerere țintește 3.1.1.',
  // ── Session pane ────────────────────────────────────────────────────
  'workbench.editors.mqtt.session.emptyTitle': 'Răspuns',
  'workbench.editors.mqtt.session.emptyHint': 'Conectați-vă pentru a trimite și a primi mesaje.',
  'workbench.editors.mqtt.session.connectFailed': 'Deschiderea sesiunii a eșuat',
  'workbench.editors.mqtt.session.connectingBadge': 'Se conectează',
  'workbench.editors.mqtt.session.connectedBadge': 'Conectat',
  'workbench.editors.mqtt.session.notSubscribed': 'Neabonat la niciun subiect',
  'workbench.editors.mqtt.session.subscribedOne': 'Abonat la 1 subiect',
  'workbench.editors.mqtt.session.subscribedMany': 'Abonat la {count} subiecte',
  'workbench.editors.mqtt.session.tab.timeline': 'Cronologie',
  'workbench.editors.mqtt.session.tab.connection': 'Conexiune',
  'workbench.editors.mqtt.session.tab.scripts': 'Scripturi',
  'workbench.editors.mqtt.tab.scripts': 'Scripturi',
  'workbench.editors.mqtt.timeline.script': '{hook} — {levels}',
  'workbench.editors.mqtt.timeline.scriptFailed': '{hook} a eșuat — {error}',
  'workbench.editors.mqtt.timeline.scriptDropped': '{hook} a eliminat mesajul — {level}',
  'workbench.editors.mqtt.timeline.scriptAttempt': 'încercarea {attempt}',
  'workbench.editors.mqtt.session.scripts.empty': 'Niciun script nu a rulat în această sesiune.',
  'workbench.editors.mqtt.session.scripts.console': 'Consolă',
  'workbench.editors.mqtt.session.scripts.tests': 'Tests',
  'workbench.editors.mqtt.session.scripts.consoleEmpty': 'Nimic înregistrat în jurnal.',
  'workbench.editors.mqtt.session.scripts.testsEmpty': 'Nicio aserțiune înregistrată.',
  'workbench.editors.mqtt.session.scripts.attempt': 'încercarea {attempt}',
  'workbench.editors.mqtt.session.scripts.atMessage': 'evenimentul {index}',
  'workbench.editors.mqtt.session.scripts.tag': 'Scripturi · {count}',
  'workbench.editors.mqtt.session.scripts.tagTitle': 'Scripturile sesiunii',
  'workbench.editors.mqtt.session.scripts.tagSummary':
    'Hook-urile care au rulat în această sesiune, cu nivelurile care au contribuit.',
  'workbench.editors.mqtt.session.scripts.tagSummaryFailed': 'Un hook a eșuat — ultima sa eroare este listată sub el.',
  'workbench.editors.mqtt.session.scripts.runs': 'rulări: {count}',
  'workbench.editors.mqtt.session.scripts.runsOne': '1 rulare',
  'workbench.editors.mqtt.session.scripts.failed': 'eșuate: {count}',
  'workbench.editors.mqtt.session.scripts.dropped': 'eliminate: {count}',
  'workbench.editors.mqtt.session.scripts.marksCapped':
    'Detaliile per eveniment s-au oprit după {count} rulări; hook-urile rulează în continuare, iar numărătoarea completă apare când sesiunea se încheie.',
  'workbench.editors.mqtt.session.duration': '{ms} ms',
  'workbench.editors.mqtt.session.sendIdle': 'Conectați-vă pentru a publica mesaje.',
  'workbench.editors.mqtt.session.sendFailed': 'Publicarea mesajului a eșuat',
  'workbench.editors.mqtt.session.subscribeFailed': 'Modificarea abonamentului a eșuat',
  'workbench.editors.mqtt.session.hostNotice':
    'Rulează pe socketul browserului — {knobs} nu se aplică pe această gazdă.',
  'workbench.editors.mqtt.session.knobSslVerify': 'verificarea SSL dezactivată',
  'workbench.editors.mqtt.session.disconnectedTag': 'Deconectat',
  'workbench.editors.mqtt.session.brokerDisconnectedTag': 'Deconectat de broker',
  'workbench.editors.mqtt.session.severedTag': 'Conexiune întreruptă',
  'workbench.editors.mqtt.session.stoppedTag': 'Oprit',
  'workbench.editors.mqtt.session.connectFailedTag': 'Conectare eșuată',
  'workbench.editors.mqtt.session.abortedTag': 'Abandonat',
  'workbench.editors.mqtt.timeline.aborted': 'Conexiune abandonată',
  'workbench.editors.mqtt.timeline.abortedDisconnected': 'Deconectat de la broker',
  'workbench.editors.mqtt.timeline.lost': 'Conexiune pierdută',
  'workbench.editors.mqtt.timeline.reconnecting': 'Încercarea de reconectare {attempt}',
  'workbench.editors.mqtt.timeline.reconnected': 'Reconectat la broker',
  'workbench.editors.mqtt.session.reconnectingBadge': 'Se reconectează',
  'workbench.editors.mqtt.session.reconnectRefusedTag': 'Reconectare refuzată',
  'workbench.editors.mqtt.session.reconnectRefused': 'reconectare refuzată: {reason}',
  'workbench.editors.mqtt.timeline.reconnectingAfter': 'Încercarea de reconectare {attempt} după {delay}',
  'workbench.editors.mqtt.timeline.reconnectingNow': 'Încercarea de reconectare {attempt} acum',
  'workbench.editors.mqtt.timeline.reconnectedDroppedOne': 'un mesaj neconfirmat eliminat',
  'workbench.editors.mqtt.timeline.reconnectedDroppedMany': 'mesaje neconfirmate eliminate: {count}',
  'workbench.editors.mqtt.session.reconnectExhaustedTag': 'Reconectarea a renunțat',
  'workbench.editors.mqtt.session.reconnectExhausted': 'reconectarea a renunțat după {attempts}',
  'workbench.editors.mqtt.session.reconnectExhaustedReason': 'reconectarea a renunțat după {attempts}: {reason}',
  'workbench.editors.mqtt.session.reconnectAttemptsOne': 'o încercare',
  'workbench.editors.mqtt.session.reconnectAttemptsMany': '{count} încercări',
  'workbench.editors.mqtt.session.cleanDisconnect': 'deconectare curată',
  'workbench.editors.mqtt.session.brokerDisconnect': 'brokerul a trimis DISCONNECT: {reason}',
  'workbench.editors.mqtt.session.brokerDisconnectBare': 'brokerul a trimis DISCONNECT',
  'workbench.editors.mqtt.session.severed': 'conexiunea s-a încheiat fără un DISCONNECT',
  'workbench.editors.mqtt.session.connectionClientId': 'Client ID',
  'workbench.editors.mqtt.session.connectionReason': 'Motiv CONNACK',
  'workbench.editors.mqtt.session.connectionSessionPresent': 'Sesiune prezentă',
  'workbench.editors.mqtt.session.yes': 'Da',
  'workbench.editors.mqtt.session.no': 'Nu',
  'workbench.editors.mqtt.session.connectionNote':
    'Datele CONNACK așa cum le-a răspuns brokerul — codurile de motiv ca atare, cu numele lor alături.',
  // ── Message timeline ────────────────────────────────────────────────
  'workbench.editors.mqtt.timeline.connecting': 'Se conectează',
  'workbench.editors.mqtt.timeline.connected': 'Conectat la broker',
  'workbench.editors.mqtt.timeline.disconnected': 'Deconectat',
  'workbench.editors.mqtt.timeline.stopped': 'Oprit',
  'workbench.editors.mqtt.timeline.subscribed': 'Abonat la',
  'workbench.editors.mqtt.timeline.unsubscribed': 'Dezabonat de la',
  'workbench.editors.mqtt.timeline.grantFailed': 'Refuzat, cod {code}',
  'workbench.editors.mqtt.timeline.grantFailedNamed': '{name} ({code})',
  'workbench.editors.mqtt.timeline.noMatches': 'Niciun mesaj nu corespunde filtrului.',
  'workbench.editors.mqtt.timeline.searchMessages': 'Căutare mesaje',
  'workbench.editors.mqtt.timeline.messageCount': 'mesaje: {count}',
  'workbench.editors.mqtt.timeline.dropped': 'mesaje mai vechi ieșite din captură: {count}',
  'workbench.editors.mqtt.timeline.topicFilterAll': 'Toate subiectele',
  'workbench.editors.mqtt.timeline.filterAll': 'Toate',
  'workbench.editors.mqtt.timeline.filterSent': 'Trimise',
  'workbench.editors.mqtt.timeline.filterReceived': 'Primite',
  'workbench.editors.mqtt.timeline.newestFirst': 'Cele mai noi primele',
  'workbench.editors.mqtt.timeline.oldestFirst': 'Cele mai vechi primele',
  'workbench.editors.mqtt.timeline.sortOrder': 'Ordine de sortare',
  'workbench.editors.mqtt.timeline.clearMessages': 'Golire mesaje',
  'workbench.editors.mqtt.timeline.trustCertificate': 'Acordare încredere certificatului',
  'workbench.editors.mqtt.timeline.newMessages': 'Mesaje noi',
  'workbench.editors.mqtt.timeline.binaryMessage': 'Conținut util binar ({bytes} octeți)',
  'workbench.editors.mqtt.timeline.byteCount': '{bytes} B',
  'workbench.editors.mqtt.timeline.retainedTag': 'Reținut',
  'workbench.editors.mqtt.timeline.sentAria': 'Trimis',
  'workbench.editors.mqtt.timeline.receivedAria': 'Primit',
  'workbench.editors.mqtt.toast.deletedOtherTab': 'Această cerere MQTT a fost ștearsă într-o altă filă.',
  'workbench.editors.mqtt.toast.updateFailed': 'Salvarea cererii MQTT a eșuat',
  'workbench.editors.mqtt.toast.updateFailedDetail': 'Salvarea cererii MQTT a eșuat: {message}',
  'workbench.editors.mqtt.session.saveResponse': 'Salvare răspuns',
  'workbench.editors.mqtt.toast.savedExample': 'Exemplul {name} a fost salvat',
  'workbench.editors.mqtt.toast.saveExampleFailed': 'Salvarea exemplului a eșuat',
  'workbench.editors.mqtt.toast.saveExampleFailedDetail': 'Salvarea exemplului a eșuat: {message}',
  // ── Response example viewer ─────────────────────────────────────────
  'workbench.editors.mqttExample.loading': 'Se încarcă exemplul…',
  'workbench.editors.mqttExample.notFound':
    'Acest exemplu nu mai există — este posibil să fi fost șters într-o altă filă.',
  'workbench.editors.mqttExample.openInRequest': 'Deschidere în cerere',
  'workbench.editors.mqttExample.openInRequestTooltip':
    'Deschide cererea MQTT părinte cu această formă capturată, ca editări nesalvate.',
  'workbench.editors.mqttExample.capturedTooltip': 'Capturat la {date}',
  'workbench.editors.mqttExample.toast.deletedOtherTab': 'Acest exemplu a fost șters într-o altă filă.',
  'workbench.editors.mqttExample.toast.saveFailed': 'Salvarea exemplului a eșuat',
  'workbench.editors.mqttExample.toast.saveFailedDetail': 'Salvarea exemplului a eșuat: {message}',
} as const satisfies Catalog;
