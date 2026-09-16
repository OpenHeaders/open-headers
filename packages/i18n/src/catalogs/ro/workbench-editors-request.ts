/**
 * Workbench editors — the API request editor — Romanian. Mirrors
 * `catalogs/en/workbench-editors-request.ts` key for key. Raw by
 * design: HTTP methods, header names, MIME types, auth scheme names
 * (Basic Auth / Bearer Token / OAuth 2.0 / Digest Auth / Hawk
 * Authentication / JWT Bearer / HTTP Message Signature …), OAuth /
 * PKCE / JWT parameter names (code_verifier, kid, alg, iat / exp …),
 * the `<calculated…>` placeholders, the phase tokens DNS / TCP / TLS /
 * TTFB, `{{ns.NAME}}` refs and every example value. Quoted verbatim
 * from the shipped ro files: the editor tab family (Autorizare /
 * Antete / Corp / Scripturi / Setări; `Docs` / `Params` raw — the
 * S117 tab-noun decision), Moștenire = Inherit, Trimitere = Send,
 * Moștenire de la părinte / cheia API / Bearer Token (the chrome
 * apiRequests rows), the settings-knob scalar twins from
 * `shared-conflicts.ts` (every wired knob label in the Settings tab IS
 * the twin: Versiune TLS minimă / Versiune TLS maximă / Suite de
 * cifrare TLS / Nume de server SNI / Versiune HTTP / Rezolvare la
 * adresa / Certificat de client / Adresă URL proxy / Acreditări proxy
 * / Socket Unix / Depozit Cookie / Timp de așteptare cerere / Limită
 * dimensiune răspuns / Redirecționări maxime / Păstrare metodă HTTP
 * originală / Păstrare antet Authorization / Urmărire redirecționări /
 * Script pre-cerere / Script post-răspuns; Verificare certificat SSL
 * keeps en's extra noun over the bare twin), „Copiere ca cURL” /
 * „Copiere ca fetch” (panel-network), Verificări = test assertions
 * (the session-pane mint — the response tab reads Verificări /
 * `Verificări (trecute: {count})`), Pre-cerere / Post-răspuns
 * (graphql), Biblioteca de pachete, Presetare, stabilirea conexiunii =
 * dial, cadre heartbeat, inactiv = idle, reconectare, trailer,
 * Vizualizator hex, Previzualizare, Formatare = the prettify action,
 * Încredere în certificat, Deschidere în filă nouă, Salvare răspuns /
 * Creare flux de lucru, backoff-ul exponențial, Timp de așteptare
 * inactiv, handshake-ul TLS prose, cheie privată / emitent /
 * revendicare = claim (panel-inspector-headers), conținut util =
 * payload, the Setări › Cereri API › TLS path. MINTS: Mod sigur / Mod
 * dezvoltator = the script execution modes; pragul minim TLS = TLS
 * floor (pragul maxim carried); sandbox raw (sandbox-ul); semnătură /
 * Semnare = signature / signing; Componente semnate = the Coverage
 * group (a fourth compound — sferă / rază de acțiune / acoperire
 * untouched); componente semnate / antete de semnat = covered
 * components / Headers to Sign; Livrare = the Delivery group;
 * provocare = challenge (apel stays the gRPC call); acordare = the
 * OAuth grant (tip de acordare, acordare prin parolă; acordare de
 * acces stays the server grant — S19); consumator = consumer; TRECUT
 * / EȘUAT = the PASS / FAIL pills (caps kept); aserțiune de client =
 * the OAuth / JWT client assertion (S19 split beside verificare = test
 * assertion); călătorește = rides (nu călătorește niciodată = never
 * rides; ajunge pe fir = reaches the wire); Blocat = Stalled in the
 * phase ladder (the panel-network rung stays raw; the panel-inspector
 * gloss „Se așteaptă o conexiune disponibilă” is the precedent) beside
 * Interogare DNS / Conexiune TCP / Handshake TLS / Așteptare (TTFB) /
 * Descărcare conținut; token de acces / token de reîmprospătare
 * (nouns) vs reîmprospătare = refresh (verb-noun) vs „Reîmprospătare
 * acum” = the button; Deconectare = Disconnect; adresa URL de apel
 * invers = callback URL; autorizarea dispozitivului; Descoperire =
 * Discover; trunchiat = truncated; Previzualizare / Scriere = the Docs
 * tab modes; Legare de un flux de lucru existent; salturi: {count} /
 * 20 de salturi = redirect hops; Depozit Cookie for en-capitalized
 * `Cookie jar` (response meta + the jar info title) vs depozit cookie
 * in prose (`Use cookie jar` → Utilizare depozit cookie); the
 * `Cookies` group and tab labels read Cookie-uri (`Cookies` is not a
 * glossary hit — the boundary); lowercase-en `vault` rides RAW
 * (intrările din vault, părăsesc vault) — the S100 case trap. Browser
 * interstitial paths quote the browsers' own ro UI (Chrome „Avansat”
 * → „Accesați site-ul (nesigur)”, Firefox „Avansat…” → „Acceptați
 * riscul și continuați”). Render sites: `OAuth2AuthEditor.tsx` joins
 * the callback-tip fragments with spaces except `callbackTipAfterApi`
 * (no space after the code chip) → it opens `. ID-ul extensiei …`;
 * `queryWarningBefore` ends on „Preferați antetul implicit” so the
 * `Authorization: Bearer` chip reads as the head and
 * `queryWarningAfter` opens with a bare clause; `storedFootnoteAfter`
 * opens with `.`; `RequestUrlBar.tsx` joins `<strong>{q}</strong>
 * {forbiddenSuffix}` with a space → „nu poate fi trimis din
 * browser.”; `usePrefix` = Utilizare. RAW-TOKEN LAW: head nouns over
 * enclitics (adresa URL, tokenul JWT, cheia API, metoda HTTP,
 * handshake-ul TLS, interogarea DNS, conexiunea TCP, scriptul PAC,
 * proxy-ul SOCKS5, schema Bearer, antetul Cookie, tokenul DPoP, metoda
 * POST, răspunsul 401, versiunea TLS 1.2).
 */

import { plural } from '../../runtime';
import type { Catalog } from '../../types';

export const workbenchEditorsRequest = {
  // ── Request editor shell ───────────────────────────────────────────
  'workbench.editors.request.notFound': 'Cererea nu a fost găsită.',
  'workbench.editors.request.loading': 'Se încarcă cererea…',
  'workbench.editors.request.toast.deletedOtherTab': 'Cererea a fost ștearsă din altă filă',
  'workbench.editors.request.toast.updateFailed': 'Cererea nu a putut fi actualizată',
  'workbench.editors.request.toast.updateFailedDetail': 'Cererea nu a putut fi actualizată: {message}',
  'workbench.editors.request.toast.invalidSetting':
    '{label}: valoare nevalidă — corectați-o în fila Setări înainte de salvare.',
  'workbench.editors.request.toast.savedExample': 'Exemplul „{name}” a fost salvat',
  'workbench.editors.request.toast.saveExampleFailed': 'Exemplul nu a putut fi salvat',
  'workbench.editors.request.toast.saveExampleFailedDetail': 'Exemplul nu a putut fi salvat: {message}',
  'workbench.editors.request.send.label': 'Trimitere',
  'workbench.editors.request.send.sending': 'Se trimite…',
  'workbench.editors.request.send.unresolvedTooltip':
    'Cererea are variabile nerezolvate. Definiți-le în vault, mediu, colecție, spațiul de lucru sau într-un flux de lucru Live înainte de trimitere.',
  'workbench.editors.request.send.stop': 'Oprire',
  'workbench.editors.request.send.stopTooltip': 'Oprește cererea și păstrează ce a sosit',
  'workbench.editors.request.menu.copyAsCurl': 'Copiere ca cURL',
  'workbench.editors.request.menu.copyAsFetch': 'Copiere ca fetch',
  'workbench.editors.request.convert.menu': 'Conversie în cerere GraphQL',
  'workbench.editors.request.convert.title': 'CONVERSIE ÎN CERERE GRAPHQL',
  'workbench.editors.request.convert.body':
    '„{name}” devine o cerere GraphQL în același loc — antetele, autorizarea, scripturile, setările și documentația se păstrează, iar cererea HTTP este eliminată.',
  'workbench.editors.request.convert.noteParamsFolded': ({ count }, locale) =>
    plural(locale, Number(count), {
      one: '{count} parametru de interogare este pliat în adresa URL.',
      few: '{count} parametri de interogare sunt pliați în adresa URL.',
      other: '{count} de parametri de interogare sunt pliați în adresa URL.',
    }),
  'workbench.editors.request.convert.noteDisabledParamsDropped': ({ count }, locale) =>
    plural(locale, Number(count), {
      one: '{count} parametru de interogare dezactivat este eliminat — o cerere GraphQL nu păstrează niciunul.',
      few: '{count} parametri de interogare dezactivați sunt eliminați — o cerere GraphQL nu păstrează niciunul.',
      other: '{count} de parametri de interogare dezactivați sunt eliminați — o cerere GraphQL nu păstrează niciunul.',
    }),
  'workbench.editors.request.convert.noteMethodChanged':
    'Metoda {method} devine POST — orice operație GraphQL se trimite prin POST.',
  'workbench.editors.request.convert.noteExamples': ({ count }, locale) =>
    plural(locale, Number(count), {
      one: '{count} răspuns salvat se mută sub noua cerere.',
      few: '{count} răspunsuri salvate se mută sub noua cerere.',
      other: '{count} de răspunsuri salvate se mută sub noua cerere.',
    }),
  'workbench.editors.request.convert.ok': 'Conversie',
  'workbench.editors.request.convert.notConvertible': 'Doar o cerere al cărei corp este GraphQL poate fi convertită.',
  'workbench.editors.request.convert.saveFirst': 'Salvați cererea înainte de a o converti.',
  'workbench.editors.request.convert.failed': 'Cererea nu a putut fi convertită.',
  'workbench.editors.request.convert.failedDetail': 'Cererea nu a putut fi convertită: {message}',
  'workbench.editors.request.convert.done': '„{name}” a fost convertită într-o cerere GraphQL.',
  'workbench.editors.request.schemeHint':
    'Adresa URL nu are schemă. Va fi trimisă ca https:// — apăsați pe bara de adrese și apăsați Tab sau Enter pentru a o fixa.',

  // ── Request editor tab registry ────────────────────────────────────
  'workbench.editors.request.tab.docs': 'Docs',
  'workbench.editors.request.tab.params': 'Params',
  'workbench.editors.request.tab.authorization': 'Autorizare',
  'workbench.editors.request.tab.headers': 'Antete',
  'workbench.editors.request.tab.body': 'Corp',
  'workbench.editors.request.tab.scripts': 'Scripturi',
  'workbench.editors.request.tab.settings': 'Setări',
  'workbench.editors.request.spec.selectLabel': 'Specificație OpenAPI',
  'workbench.editors.request.spec.none': 'Nicio specificație OpenAPI nu este legată de această cerere.',
  'workbench.editors.request.spec.selectPlaceholder': 'Legați o specificație OpenAPI…',
  'workbench.editors.request.spec.inheritedPlaceholder': 'Moștenită de la colecție: {name}',
  'workbench.editors.request.spec.fromCollection': 'Din colecția {name}',
  'workbench.editors.request.spec.missing': 'Specificația legată nu mai este în acest spațiu de lucru.',
  'workbench.editors.request.spec.parseFailure': 'Specificația nu a putut fi analizată: {message}',
  'workbench.editors.request.spec.drifted': 'Specificația s-a schimbat după generarea acestei colecții.',
  'workbench.editors.request.spec.operation': 'Operație',
  'workbench.editors.request.spec.noOperation': 'Nicio operație din specificație nu se potrivește cu {method} {url}.',
  'workbench.editors.request.spec.inSync': 'Sincronizată cu specificația.',
  'workbench.editors.request.spec.fieldDiffers': 'Câmpul {field} diferă de specificație.',
  'workbench.editors.request.spec.apply': 'Aplicare',
  'workbench.editors.request.spec.applyAll': 'Aplicare toate',

  // ── URL bar + method picker (method names stay raw parity vocab) ───
  'workbench.editors.request.url.placeholder': 'Introduceți adresa URL sau lipiți text',
  'workbench.editors.request.url.socketCta':
    'Adresă URL de tip socket — stabilește conexiunea cu {path} prin setarea Socket Unix.',
  'workbench.editors.request.url.socketCtaApply': 'Aplicare',
  'workbench.editors.request.method.customGroup': 'Personalizate',
  'workbench.editors.request.method.usePrefix': 'Utilizare',
  'workbench.editors.request.method.forbiddenSuffix': 'nu poate fi trimis din browser.',
  'workbench.editors.request.method.invalidHint': 'Metodele folosesc litere, cifre și cratime (maximum 32).',
  'workbench.editors.request.method.removeCustomAria': 'Eliminare metodă personalizată {method}',

  // ── Params / Headers tabs ──────────────────────────────────────────
  'workbench.editors.request.goToAuthorization': 'Către autorizare',
  'workbench.editors.request.goToBody': 'Către corp',
  'workbench.editors.request.headers.keyPlaceholder': 'Antet',
  'workbench.editors.request.headers.hideAuto': 'Ascundere antete generate automat',
  'workbench.editors.request.headers.hiddenCount': 'ascunse: {count}',
  'workbench.editors.request.headers.autoInfo':
    'Aceste antete vor fi adăugate automat și trimise împreună cu cererea. Apăsați pictograma de informații de pe un rând pentru detalii per antet.',
  'workbench.editors.request.headers.duplicateAuthOverride':
    'Acesta este un antet duplicat și va fi suprascris de antetul {header} generat de setările de autorizare.',
  'workbench.editors.request.headers.calculated': '<calculat la trimiterea cererii>',
  'workbench.editors.request.headers.browserUserAgent': '<user agent-ul browserului>',
  'workbench.editors.request.headers.hint.cacheControl':
    '„Cache-Control: no-cache” pleacă la fiecare trimitere din gazda browser, astfel încât serverul să nu răspundă niciodată dintr-un cache învechit când repetați o cerere. Adăugați propriul rând Cache-Control pentru a trimite altă valoare.',
  'workbench.editors.request.headers.hint.contentType':
    'Runtime-ul calculează Content-Type din codificarea corpului (form-data → multipart/form-data cu un boundary; x-www-form-urlencoded → application/x-www-form-urlencoded; JSON brut → application/json etc.). Setați propriul antet pentru a-l suprascrie.',
  'workbench.editors.request.headers.hint.contentLength':
    'Content-Length se calculează din dimensiunea în octeți a corpului serializat înainte de trimiterea cererii. Browserul refuză să onoreze un Content-Length setat de utilizator care nu corespunde lungimii reale a corpului.',
  'workbench.editors.request.headers.hint.host':
    'Browserul derivă Host din adresa URL țintă și nu permite codului din userland să îl suprascrie.',
  'workbench.editors.request.headers.hint.userAgent':
    'User-Agent identifică clientul. Cererile pleacă cu User-Agent-ul propriu al browserului; adăugați mai jos propriul rând User-Agent pentru a-l suprascrie.',
  'workbench.editors.request.headers.hint.accept':
    'Accept îi spune serverului ce tipuri de conținut poate interpreta clientul. `*/*` lasă serverul să aleagă; suprascrieți cu un set mai restrâns (de ex. `application/json`) pentru a constrânge răspunsurile.',
  'workbench.editors.request.headers.hint.acceptEncoding':
    'Algoritmii de compresie acceptați de browser. Setat de browser și negociat per conexiune; nu poate fi suprascris din userland.',
  'workbench.editors.request.headers.hint.connection':
    'Reutilizarea conexiunii HTTP/1.1. Browserul gestionează rezerva de conexiuni și nu permite codului din userland să suprascrie acest antet.',
  'workbench.editors.request.headers.hint.node.host':
    'Derivat din adresa URL țintă la trimiterea cererii. Un rând Host propriu îl înlocuiește pe fir.',
  'workbench.editors.request.headers.hint.node.connection':
    'Runtime-ul node menține conexiunile active și le grupează per origine. Un rând Connection propriu îl înlocuiește.',
  'workbench.editors.request.headers.hint.node.acceptLanguage':
    'Clientul fetch al runtime-ului node trimite un wildcard. Un rând propriu îl înlocuiește.',
  'workbench.editors.request.headers.hint.node.secFetchMode':
    'Aplicat de clientul fetch al runtime-ului node la fiecare trimitere. Un rând propriu îl înlocuiește.',
  'workbench.editors.request.headers.hint.node.userAgent':
    'Runtime-ul node identifică această aplicație la fiecare trimitere. Adăugați propriul rând User-Agent pentru a trimite altul.',
  'workbench.editors.request.headers.hint.node.acceptEncoding':
    'Compresia pe care runtime-ul node o acceptă și o decodează pentru dvs. Un rând propriu îl înlocuiește — corpul răspunsului sosește atunci așa cum a fost trimis.',

  // ── Auth preview rows (Headers/Params generated rows) ──────────────
  'workbench.editors.request.authPreview.basicValue': 'Basic <acreditări>',
  'workbench.editors.request.authPreview.bearerValue': 'Bearer <token>',
  'workbench.editors.request.authPreview.apiKeyValue': '<valoare>',
  'workbench.editors.request.authPreview.accessTokenValue': '<token de acces>',
  'workbench.editors.request.authPreview.bearerAccessTokenValue': 'Bearer <token de acces>',
  'workbench.editors.request.authPreview.basicHint':
    'Generat din fila Autorizare (Basic Auth). Numele de utilizator și parola sunt codificate base64 în acest antet la trimiterea cererii.',
  'workbench.editors.request.authPreview.bearerHint':
    'Generat din fila Autorizare (Bearer Token). Tokenul este adăugat în acest antet la trimiterea cererii.',
  'workbench.editors.request.authPreview.apiKeyHeaderHint':
    'Generat din fila Autorizare (API Key). Valoarea este adăugată în acest antet la trimiterea cererii.',
  'workbench.editors.request.authPreview.apiKeyQueryHint':
    'Generat din fila Autorizare (API Key). Valoarea este adăugată în acest parametru de interogare la trimiterea cererii.',
  'workbench.editors.request.authPreview.oauth2HeaderHint':
    'Generat din fila Autorizare (OAuth 2.0). Tokenul de acces este adăugat în acest antet la trimiterea cererii.',
  'workbench.editors.request.authPreview.oauth2QueryHint':
    'Generat din fila Autorizare (OAuth 2.0). Tokenul de acces este adăugat la adresa URL a cererii la trimiterea cererii.',
  'workbench.editors.request.authPreview.awsSigV4Value': 'AWS4-HMAC-SHA256 <semnătură>',
  'workbench.editors.request.authPreview.awsSigV4DateValue': '<marcajul de timp al cererii>',
  'workbench.editors.request.authPreview.awsSigV4Hint':
    'Generat din fila Autorizare (AWS Signature v4). Cererea este semnată cu acreditările dvs. la trimitere.',
  'workbench.editors.request.authPreview.awsSigV4DateHint':
    'Generat din fila Autorizare (AWS Signature v4). Marcajul de timp al semnării este adăugat în acest antet la trimiterea cererii.',
  'workbench.editors.request.authPreview.awsSigV4QueryValue': '<parametri semnați>',
  'workbench.editors.request.authPreview.awsSigV4QueryHint':
    'Generat din fila Autorizare (AWS Signature v4). Parametrii X-Amz-* sunt adăugați în interogarea adresei URL la trimiterea cererii.',
  'workbench.editors.request.authPreview.edgeGridValue': 'EG1-HMAC-SHA256 <parametri semnați>',
  'workbench.editors.request.authPreview.edgeGridHint':
    'Generat din fila Autorizare (Akamai EdgeGrid). Cererea este semnată cu acreditările dvs. la trimitere.',
  'workbench.editors.request.authPreview.asapValue': 'Bearer <JWT semnat>',
  'workbench.editors.request.authPreview.asapHint':
    'Generat din fila Autorizare (ASAP). Un token proaspăt este semnat cu cheia dvs. privată și adăugat în acest antet la trimiterea cererii.',
  'workbench.editors.request.authPreview.httpSignatureInputValue': 'sig1=(<componente semnate>);created=…',
  'workbench.editors.request.authPreview.httpSignatureValue': 'sig1=:<semnătură>:',
  'workbench.editors.request.authPreview.httpSignatureHint':
    'Generat din fila Autorizare (HTTP Message Signature). Cererea este semnată cu cheia dvs. la trimitere.',
  'workbench.editors.request.authPreview.httpSignatureDigestValue': 'sha-256=:<digest-ul corpului>:',
  'workbench.editors.request.authPreview.httpSignatureDigestHint':
    'Generat din fila Autorizare (HTTP Message Signature). Digest-ul corpului este calculat la trimiterea cererii.',
  'workbench.editors.request.authPreview.digestValue': 'Digest <răspuns la provocare>',
  'workbench.editors.request.authPreview.digestHint':
    'Generat din fila Autorizare (Digest Auth). Valoarea este calculată din provocarea serverului la trimiterea cererii, apoi cererea este retrimisă cu ea.',
  'workbench.editors.request.authPreview.oauth1Value': 'OAuth <parametri semnați>',
  'workbench.editors.request.authPreview.oauth1Hint':
    'Generat din fila Autorizare (OAuth 1.0). Cererea este semnată cu acreditările dvs. la trimitere.',
  'workbench.editors.request.authPreview.oauth1QueryValue': '<parametri semnați>',
  'workbench.editors.request.authPreview.oauth1QueryHint':
    'Generat din fila Autorizare (OAuth 1.0). Parametrii oauth_* sunt adăugați în interogarea adresei URL la trimiterea cererii.',
  'workbench.editors.request.authPreview.hawkValue': 'Hawk <parametri semnați>',
  'workbench.editors.request.authPreview.hawkHint':
    'Generat din fila Autorizare (Hawk Authentication). Cererea este semnată cu acreditările dvs. la trimitere.',
  'workbench.editors.request.authPreview.jwtValue': '<JWT semnat>',
  'workbench.editors.request.authPreview.jwtHint':
    'Generat din fila Autorizare (JWT Bearer). Tokenul este semnat și adăugat în acest antet la trimiterea cererii.',
  'workbench.editors.request.authPreview.jwtQueryHint':
    'Generat din fila Autorizare (JWT Bearer). Tokenul este semnat și adăugat în acest parametru de interogare la trimiterea cererii.',
  'workbench.editors.request.authPreview.inheritedFrom': 'Moștenit de la {source} — editați-l în părinte.',

  // ── Authorization tab ──────────────────────────────────────────────
  'workbench.editors.request.auth.typeLabel': 'Tip de autorizare',
  'workbench.editors.request.auth.group.credentials': 'Acreditări',
  'workbench.editors.request.auth.group.token': 'Token',
  'workbench.editors.request.auth.group.signing': 'Semnare',
  'workbench.editors.request.auth.group.consumer': 'Consumator',
  'workbench.editors.request.auth.group.attributes': 'Atribute',
  'workbench.editors.request.auth.group.delivery': 'Livrare',
  'workbench.editors.request.auth.group.challenge': 'Provocare',
  'workbench.editors.request.auth.group.grant': 'Acordare',
  'workbench.editors.request.auth.group.advanced': 'Avansat',
  'workbench.editors.request.auth.group.coverage': 'Componente semnate',
  'workbench.editors.request.auth.group.parameters': 'Parametri',
  'workbench.editors.request.auth.typeInfo.none':
    'Nu se adaugă nimic — cererea pleacă exact așa cum o arată filele Antete și Params.',
  'workbench.editors.request.auth.typeInfo.basic':
    'Numele de utilizator și parola sunt unite prin două puncte, codificate base64 și trimise ca antet Authorization: Basic la fiecare trimitere — codificate, nu criptate, deci doar prin HTTPS.',
  'workbench.editors.request.auth.typeInfo.bearer':
    'Tokenul este trimis ca atare după schema Bearer în antetul Authorization la fiecare trimitere.',
  'workbench.editors.request.auth.typeInfo.apiKey':
    'Cheia numește un antet sau un parametru de interogare, iar valoarea călătorește în el — schema cu acreditări simple pe care o folosesc majoritatea interfețelor API publice.',
  'workbench.editors.request.auth.typeInfo.digest':
    'Prima trimitere obține provocarea 401 a serverului (realm, nonce, qop); acreditările sunt hash-uite cu ea în response= și cererea este reîncercată — parola în sine nu călătorește niciodată.',
  'workbench.editors.request.auth.typeInfo.oauth1':
    'Acreditările consumatorului și ale tokenului semnează un șir de bază format din metodă, adresa URL și parametri; parametrii oauth_* semnați călătoresc în antetul Authorization sau în adresa URL, cu nonce-ul, marcajul de timp și versiunea emise la fiecare trimitere.',
  'workbench.editors.request.auth.typeInfo.hawk':
    'Un MAC peste metodă, adresa URL, marcajul de timp, nonce și atributele opționale călătorește într-un antet Authorization: Hawk; marcajul de timp și nonce-ul sunt emise la fiecare trimitere.',
  'workbench.editors.request.auth.typeInfo.jwt':
    'Un JWT proaspăt este emis și semnat la fiecare trimitere din materialul de chei de aici — antetul, conținutul util și semnătura de mai jos — și livrat ca token bearer sau ca parametru de interogare.',
  'workbench.editors.request.auth.groupInfo.basic.credentials':
    'Perechea care devine acreditarea base64 — ambele sunt trimise, codificate, dar nu criptate.',
  'workbench.editors.request.auth.groupInfo.bearer.token':
    'Tokenul așa cum l-a emis serverul; schema Bearer este adăugată în față pe fir.',
  'workbench.editors.request.auth.groupInfo.apiKey.credentials':
    'Numele și secretul — numele este antetul sau parametrul, valoarea este ceea ce călătorește în el.',
  'workbench.editors.request.auth.groupInfo.apiKey.delivery':
    'Unde ajunge cheia: într-un antet de cerere sau într-un parametru de interogare adăugat la adresa URL.',
  'workbench.editors.request.auth.groupInfo.digest.credentials':
    'Perechea din care se calculează răspunsul la provocare — numele de utilizator călătorește, parola doar ca parte a hash-ului de răspuns.',
  'workbench.editors.request.auth.groupInfo.digest.challenge':
    'Cum este tratată etapa 401 la trimiterile din aplicația desktop și CLI — răspuns și reîncercare automate, dacă nu sunt dezactivate.',
  'workbench.editors.request.auth.groupInfo.oauth1.signing':
    'Metoda care semnează șirul de bază — HMAC cu secretele, RSA cu cheia privată sau PLAINTEXT — și dacă corpul este hash-uit în ea.',
  'workbench.editors.request.auth.groupInfo.oauth1.consumer':
    'Acreditările aplicației — cheia călătorește ca oauth_consumer_key, secretul (sau cheia privată) doar prin oauth_signature.',
  'workbench.editors.request.auth.groupInfo.oauth1.token':
    'Perechea de tokenuri de acces ale utilizatorului din fluxul cu trei etape — lăsați ambele goale pentru apeluri cu o singură etapă.',
  'workbench.editors.request.auth.groupInfo.oauth1.delivery':
    'Unde ajung parametrii oauth_* — în antetul Authorization (cu un realm opțional) sau în șirul de interogare al adresei URL.',
  'workbench.editors.request.auth.groupInfo.hawk.credentials':
    'ID-ul călătorește în antet; cheia doar prin MAC-ul pe care îl calculează.',
  'workbench.editors.request.auth.groupInfo.hawk.signing':
    'Digest-ul MAC-ului și dacă corpul cererii este hash-uit în el ca hash=.',
  'workbench.editors.request.auth.groupInfo.hawk.attributes':
    'Atributele opționale ale schemei — datele aplicației (ext), ID-ul aplicației (app) și cel al aplicației delegante (dlg) — semnate când sunt prezente.',
  'workbench.editors.request.auth.groupInfo.jwt.signing':
    'Algoritmul numit în antetul JWT și materialul de chei care îl semnează — un secret partajat pentru HS, o cheie privată pentru RS / PS / ES.',
  'workbench.editors.request.auth.groupInfo.jwt.token':
    'Ce transportă tokenul JWT — revendicările din conținutul util, antetele protejate suplimentare și durata de viață opțională aplicată ca iat / exp.',
  'workbench.editors.request.auth.groupInfo.jwt.delivery':
    'Unde ajunge tokenul JWT semnat — în antetul Authorization după prefixul său sau într-un parametru de interogare token.',
  'workbench.editors.request.auth.rowInfo.basicUsername':
    'Călătorește înaintea celor două puncte în acreditarea base64.',
  'workbench.editors.request.auth.rowInfo.basicPassword':
    'Călătorește după cele două puncte — codificată, niciodată criptată, deci doar prin HTTPS.',
  'workbench.editors.request.auth.rowInfo.bearerToken':
    'Trimis ca atare după Bearer; un „Bearer …” lipit își pierde prefixul aici.',
  'workbench.editors.request.auth.rowInfo.apiKeyKey':
    'Numele antetului sau al parametrului de interogare în care călătorește valoarea.',
  'workbench.editors.request.auth.rowInfo.apiKeyValue': 'Secretul trimis ca valoare a antetului sau a parametrului.',
  'workbench.editors.request.auth.rowInfo.apiKeyAddTo':
    'Antet pune cheia pe cerere; Parametri de interogare o adaugă la adresa URL, unde ajunge în jurnale.',
  'workbench.editors.request.auth.rowInfo.digestUsername': 'Călătorește ca username= în răspunsul la provocare.',
  'workbench.editors.request.auth.rowInfo.digestPassword':
    'Nu călătorește niciodată — este hash-uită împreună cu realm, nonce și metoda în response=.',
  'workbench.editors.request.auth.rowInfo.digestDisableRetry':
    'Oprește a doua etapă automată: răspunsul 401 este returnat ca răspuns în loc să primească replică.',
  'workbench.editors.request.auth.rowInfo.oauth1SignatureMethod':
    'Numește algoritmul de semnare în oauth_signature_method și alege setul de acreditări de mai jos.',
  'workbench.editors.request.auth.rowInfo.oauth1BodyHash':
    'Calculează digest-ul unui corp care nu este formular cu hash-ul metodei în oauth_body_hash, semnat împreună cu restul.',
  'workbench.editors.request.auth.rowInfo.oauth1ConsumerKey':
    'Identifică aplicația — călătorește ca oauth_consumer_key.',
  'workbench.editors.request.auth.rowInfo.oauth1ConsumerSecret':
    'Semnează cererea împreună cu secretul tokenului; nu călătorește niciodată, doar oauth_signature călătorește.',
  'workbench.editors.request.auth.rowInfo.oauth1PrivateKey':
    'Cheia PEM care semnează șirul de bază pentru metodele RSA — doar semnătura călătorește.',
  'workbench.editors.request.auth.rowInfo.oauth1Token':
    'Tokenul de acces al utilizatorului, trimis ca oauth_token; gol pentru apelurile cu o singură etapă.',
  'workbench.editors.request.auth.rowInfo.oauth1TokenSecret':
    'A doua jumătate a cheii de semnare; nu călătorește niciodată, doar oauth_signature călătorește.',
  'workbench.editors.request.auth.rowInfo.oauth1AddTo':
    'Antet transportă parametrii oauth_* în antetul Authorization; Parametri de interogare îi adaugă la adresa URL.',
  'workbench.editors.request.auth.rowInfo.oauth1Realm':
    'Reprodus ca realm= la începutul antetului, numind spațiul de protecție.',
  'workbench.editors.request.auth.rowInfo.hawkAuthId': 'Identifică acreditarea — călătorește ca id= în antet.',
  'workbench.editors.request.auth.rowInfo.hawkAuthKey':
    'Secretul partajat care calculează mac=; nu călătorește niciodată.',
  'workbench.editors.request.auth.rowInfo.hawkAlgorithm':
    'Digest-ul HMAC folosit de MAC și de hash-ul conținutului util.',
  'workbench.editors.request.auth.rowInfo.hawkPayloadHash':
    'Hash-uiește corpul și tipul său de conținut în hash=, legând conținutul util de semnătură.',
  'workbench.editors.request.auth.rowInfo.hawkExt': 'Date specifice aplicației — călătoresc ca ext= și sunt semnate.',
  'workbench.editors.request.auth.rowInfo.hawkApp': 'ID-ul aplicației — călătorește ca app= și este semnat.',
  'workbench.editors.request.auth.rowInfo.hawkDlg':
    'ID-ul aplicației delegante — călătorește ca dlg= după app= și este semnat.',
  'workbench.editors.request.auth.rowInfo.jwtAlgorithm':
    'Scris ca alg în antetul protejat și alege câmpul de cheie de mai jos.',
  'workbench.editors.request.auth.rowInfo.jwtSecret':
    'Secretul HMAC partajat care produce semnătura; nu călătorește niciodată.',
  'workbench.editors.request.auth.rowInfo.jwtSecretBase64':
    'Decodează secretul din base64 înainte de semnare, pentru secretele emise în această formă.',
  'workbench.editors.request.auth.rowInfo.jwtPrivateKey':
    'Cheia privată PEM care produce semnătura pentru RS / PS / ES; doar semnătura călătorește.',
  'workbench.editors.request.auth.rowInfo.jwtPayload':
    'Revendicările ca JSON — șabloanele se rezolvă la fiecare trimitere; un iat sau exp setat aici are prioritate față de durata de viață.',
  'workbench.editors.request.auth.rowInfo.jwtHeaders':
    'Antete protejate suplimentare ca JSON (kid este cel obișnuit); alg și typ sunt adăugate automat.',
  'workbench.editors.request.auth.rowInfo.jwtExpiresIn':
    'Aplică iat și exp în conținutul util la momentul semnării, astfel încât fiecare trimitere să poarte o durată de viață proaspătă.',
  'workbench.editors.request.auth.rowInfo.jwtAddTo':
    'Antet trimite tokenul JWT în antetul Authorization; Parametri de interogare îl adaugă ca token= la adresa URL.',
  'workbench.editors.request.auth.rowInfo.jwtHeaderPrefix':
    'Schema dinaintea tokenului JWT în antetul Authorization — Bearer implicit; gol trimite tokenul simplu.',
  'workbench.editors.request.auth.typeInfo.awsSigV4':
    'Cheia secretă semnează metoda, calea, interogarea, antetele și hash-ul conținutului util; semnătura călătorește într-un antet Authorization: AWS4-HMAC-SHA256 cu X-Amz-Date sau ca parametri de interogare X-Amz-* — nimic secret nu călătorește.',
  'workbench.editors.request.auth.groupInfo.awsSigV4.credentials':
    'Cheia de acces călătorește în Credential=, cheia secretă doar prin semnătura pe care o calculează; tokenul de sesiune călătorește ca X-Amz-Security-Token pentru acreditările temporare.',
  'workbench.editors.request.auth.groupInfo.awsSigV4.signing':
    'Sfera acreditărilor prin care se derivă cheia de semnare — serviciul și regiunea; lăsați oricare gol și se derivă dintr-un nume de gazdă AWS (regiunea revine la us-east-1).',
  'workbench.editors.request.auth.groupInfo.awsSigV4.delivery':
    'Unde ajunge semnătura — în antetul Authorization cu X-Amz-Date sau ca parametri de interogare X-Amz-* pentru punctele finale care nu pot primi un antet.',
  'workbench.editors.request.auth.rowInfo.awsAccessKey':
    'Identifică perechea de chei — călătorește în Credential= înaintea sferei.',
  'workbench.editors.request.auth.rowInfo.awsSecretKey':
    'Materialul de chei din care se derivă cheia de semnare; nu călătorește niciodată.',
  'workbench.editors.request.auth.rowInfo.awsSessionToken':
    'Tokenul de sesiune STS — călătorește ca X-Amz-Security-Token, semnat, doar pentru acreditările temporare.',
  'workbench.editors.request.auth.rowInfo.awsService':
    'Serviciul din sfera acreditărilor (s3, execute-api, …); gol îl derivă dintr-un nume de gazdă AWS. s3 semnează suplimentar hash-ul conținutului util ca antet.',
  'workbench.editors.request.auth.rowInfo.awsRegion':
    'Regiunea din sfera acreditărilor; gol o derivă dintr-un nume de gazdă AWS, altfel us-east-1.',
  'workbench.editors.request.auth.rowInfo.awsAddTo':
    'Un antet (implicit) sau interogarea adresei URL — forma presemnată pentru punctele finale care nu pot primi un antet.',
  'workbench.editors.request.auth.typeInfo.edgeGrid':
    'Secretul clientului semnează metoda, schema, gazda, calea, antetele enumerate și un hash al corpului POST; tokenurile, un marcaj de timp și un nonce per trimitere și semnătura călătoresc într-un antet Authorization: EG1-HMAC-SHA256 — secretul nu călătorește niciodată.',
  'workbench.editors.request.auth.groupInfo.edgeGrid.credentials':
    'Cele două tokenuri călătoresc în antet ca client_token= și access_token=; secretul clientului doar prin semnătura pe care o derivă.',
  'workbench.editors.request.auth.groupInfo.edgeGrid.signing':
    'Ce acoperă semnătura dincolo de linia cererii — antetele pe care le numește o interfață API, în acea ordine, și hash-ul corpului POST limitat de fereastra de octeți (cei 128 KiB ai schemei, dacă interfața API nu spune altfel).',
  'workbench.editors.request.auth.rowInfo.edgeGridClientToken':
    'Identifică clientul API — călătorește ca client_token=.',
  'workbench.editors.request.auth.rowInfo.edgeGridAccessToken':
    'Identifică acreditarea — călătorește ca access_token=.',
  'workbench.editors.request.auth.rowInfo.edgeGridClientSecret':
    'Materialul de chei din care se derivă cheia de semnare per trimitere; nu călătorește niciodată.',
  'workbench.editors.request.auth.rowInfo.edgeGridHeadersToSign':
    'Nume de antete pliate în semnătură, separate prin virgulă, în ordinea semnării; un antet enumerat pe care cererea nu îl are este omis, iar antetele neenumerate nu se semnează niciodată.',
  'workbench.editors.request.auth.rowInfo.edgeGridMaxBodySize':
    'Fereastra de octeți a unui corp POST pe care o acoperă hash-ul conținutului; gol = 131072, valoarea schemei.',
  'workbench.editors.request.auth.typeInfo.asap':
    'Un JWT proaspăt este emis la fiecare trimitere — emitentul, audiența și subiectul ca revendicări, iat / exp după ceas, un nonce jti unic — semnat cu cheia privată sub antetul kid și livrat ca token bearer; cheia nu călătorește niciodată.',
  'workbench.editors.request.auth.groupInfo.asap.signing':
    'Familia asimetrică numită în antetul JWT, ID-ul cheii după care receptorul caută cheia publică și cheia privată care semnează.',
  'workbench.editors.request.auth.groupInfo.asap.token':
    'Ce revendică tokenul — cine l-a emis, pentru cine, în numele cui, eventualele revendicări suplimentare și cât trăiește (plafonul de o oră al schemei, implicit).',
  'workbench.editors.request.auth.rowInfo.asapAlgorithm':
    'Numește familia de semnare în antet; HS nu este permis de schemă.',
  'workbench.editors.request.auth.rowInfo.asapKeyId':
    'Călătorește ca kid — issuer/key-name după dispunerea schemei; receptorul preia cheia publică după el.',
  'workbench.editors.request.auth.rowInfo.asapPrivateKey':
    'Cheia PEM (sau forma data:application/pkcs8 a Atlassian) care semnează; nu călătorește niciodată.',
  'workbench.editors.request.auth.rowInfo.asapIssuer':
    'Identificatorul înregistrat al serviciului — călătorește ca iss.',
  'workbench.editors.request.auth.rowInfo.asapAudience':
    'Pentru cine este tokenul — călătorește ca aud; un tablou prin Revendicări suplimentare.',
  'workbench.editors.request.auth.rowInfo.asapSubject': 'În numele cui — călătorește ca sub; gol trimite emitentul.',
  'workbench.editors.request.auth.rowInfo.asapClaims':
    'Revendicări suplimentare îmbinate la sfârșit — au prioritate față de orice revendicare compusă, inclusiv jti / iat / exp.',
  'workbench.editors.request.auth.rowInfo.asapExpiresIn':
    'Durata de viață aplicată ca exp − iat; gol = 3600, plafonul schemei.',
  'workbench.editors.request.auth.typeInfo.httpSignature':
    'Cererea este semnată la trimitere (RFC 9421): o bază de semnătură este construită din componentele semnate — metoda, ținta, antetele numite, un Content-Digest al corpului — plus parametrii semnăturii, semnată cu cheia și livrată ca Signature-Input și Signature; cheia nu călătorește niciodată.',
  'workbench.editors.request.auth.groupInfo.httpSignature.signing':
    'Algoritmul înregistrat, ID-ul cheii după care verificatorul caută cheia și cheia care semnează — o cheie privată PEM sau secretul partajat sub hmac-sha256.',
  'workbench.editors.request.auth.groupInfo.httpSignature.coverage':
    'Ce acoperă semnătura: componentele în ordinea semnării — cele derivate, precum @method și @target-uri, câmpurile de antet după nume — și dacă se emite un Content-Digest al corpului pentru a fi acoperit.',
  'workbench.editors.request.auth.groupInfo.httpSignature.parameters':
    'Metadatele @signature-params: eticheta purtată de ambele antete, momentele created / expires, un nonce per trimitere, parametrul alg, o etichetă de aplicație.',
  'workbench.editors.request.auth.rowInfo.httpSigAlgorithm':
    'Unul dintre cei șase algoritmi înregistrați; verificatorul trebuie să dețină cheia corespunzătoare. rsa-pss-sha512 deschide exemplele RFC-ului.',
  'workbench.editors.request.auth.rowInfo.httpSigKeyId':
    'Călătorește ca keyid — verificatorul preia cheia publică (sau secretul) după el. Gol omite parametrul.',
  'workbench.editors.request.auth.rowInfo.httpSigPrivateKey':
    'Cheia PEM care semnează — PKCS#8, PKCS#1 sau SEC1; nu călătorește niciodată.',
  'workbench.editors.request.auth.rowInfo.httpSigSecret':
    'Secretul partajat cu verificatorul — cheia HMAC-ului; nu călătorește niciodată.',
  'workbench.editors.request.auth.rowInfo.httpSigSecretBase64':
    'Secretul este text base64 — decodați-l în octeții bruți ai cheii înainte de semnare.',
  'workbench.editors.request.auth.rowInfo.httpSigComponents':
    'Separate prin spațiu, în ordinea semnării: @method, @target-uri, @authority, @scheme, @request-target, @path, @query și nume de antete. Un antet semnat pe care cererea nu îl poartă face trimiterea să eșueze.',
  'workbench.editors.request.auth.rowInfo.httpSigContentDigest':
    'Emite Content-Digest peste octeții corpului (RFC 9530), astfel încât content-digest să poată fi semnat; o trimitere fără corp calculează digest-ul conținutului gol. Corpurile multipart nu pot primi digest.',
  'workbench.editors.request.auth.rowInfo.httpSigLabel':
    'Cheia de dicționar sub care Signature-Input și Signature poartă această semnătură; gol = sig1.',
  'workbench.editors.request.auth.rowInfo.httpSigCreated':
    'Scrie created = momentul semnării; verificatorii resping semnăturile învechite după el. Dezactivat elimină parametrul (și expires odată cu el).',
  'workbench.editors.request.auth.rowInfo.httpSigExpiresIn':
    'Scrie expires = created + atâtea secunde; gol nu scrie nicio expirare.',
  'workbench.editors.request.auth.rowInfo.httpSigNonce':
    'Scrie un nonce aleatoriu proaspăt la fiecare trimitere — protecția anti-reluare pentru verificatorii care le urmăresc.',
  'workbench.editors.request.auth.rowInfo.httpSigIncludeAlg':
    'Scrie alg numind algoritmul; dezactivat îl lasă în seama cheii pe care o rezolvă verificatorul (implicitul RFC-ului).',
  'workbench.editors.request.auth.rowInfo.httpSigTag':
    'Un parametru tag specific aplicației, ca verificatorul să poată deosebi semnăturile; gol îl omite.',
  'workbench.editors.request.auth.typeInfo.oauth2':
    'Clientul obține un token de acces de la furnizor — o autorizare în browser urmată de un schimb de token sau un schimb direct pentru acordările de tip mașină și parolă — și fiecare trimitere îl poartă ca token bearer, reîmprospătat la expirare când a fost emis un token de reîmprospătare.',
  'workbench.editors.request.auth.groupInfo.oauth2.token':
    'Tokenul pe care îl deține această configurație chiar acum — ce poartă trimiterea după Bearer și dacă se reîmprospătează singur.',
  'workbench.editors.request.auth.groupInfo.oauth2.grant':
    'Cum se obține un token nou — acordarea, punctele finale ale furnizorului, identitatea clientului și ce se cere.',
  'workbench.editors.request.auth.groupInfo.oauth2.advanced':
    'Etapa de reîmprospătare și parametrii suplimentari purtați de fiecare dintre cele trei cereri către furnizor.',
  'workbench.editors.request.auth.groupInfo.oauth2.signing':
    'Tokenul JWT pe care îl emite această configurație — ca aserțiune de client la fiecare cerere de token sau ca acordare JWT bearer în sine.',
  'workbench.editors.request.auth.rowInfo.oauth2Token':
    'Tokenul de acces stocat de ultimul flux — trimis după Bearer la fiecare trimitere; gol până rulează un flux.',
  'workbench.editors.request.auth.rowInfo.oauth2TokenBinding':
    'DPoP (RFC 9449) leagă tokenul de o pereche de chei generată la schimb: fiecare cerere de token și fiecare trimitere poartă o dovadă semnată pentru metoda și adresa URL ale acelei cereri, furnizorul emite tokenul ca DPoP și acesta este trimis sub acea schemă — prefixul antetului și modul cu adresa URL se retrag. Cheia rămâne lângă tokenul stocat, niciodată în configurație.',
  'workbench.editors.request.auth.rowInfo.oauth2DpopAlgorithm':
    'Familia de semnătură a dovezii — perechea de chei este generată pe măsură. ES256 este ceea ce acceptă orice implementare DPoP.',
  'workbench.editors.request.auth.rowInfo.oauth2HeaderPrefix':
    'Schema dinaintea tokenului în antetul Authorization — gol trimite token_type emis de furnizor (Bearer implicit); setat, are prioritate pe fir.',
  'workbench.editors.request.auth.rowInfo.oauth2AutoRefresh':
    'Un token de acces expirat este reînnoit înainte de trimitere — cu tokenul de reîmprospătare când furnizorul a emis unul sau prin rularea din nou a unei acordări care nu are nevoie de browser.',
  'workbench.editors.request.auth.rowInfo.oauth2Status':
    'Cât timp rămâne valid tokenul stocat; Reîmprospătare îl schimbă acum, Deconectare îl uită.',
  'workbench.editors.request.auth.rowInfo.oauth2TokenName':
    'O etichetă pentru acest token în aplicație — nimic pe fir.',
  'workbench.editors.request.auth.rowInfo.oauth2GrantType':
    'Valoarea grant_type a schimbului de token și ce etape rulează înaintea lui — o autorizare în browser pentru acordările cu cod, niciuna pentru acreditările de client, parolă sau JWT bearer.',
  'workbench.editors.request.auth.rowInfo.oauth2CallbackUrl':
    'Valoarea redirect_uri la care furnizorul trimite browserul înapoi cu codul — înregistrați-o la furnizor.',
  'workbench.editors.request.auth.rowInfo.oauth2AuthUrl':
    'Punctul final de autorizare al furnizorului către care este trimis mai întâi browserul.',
  'workbench.editors.request.auth.rowInfo.oauth2DeviceAuthUrl':
    'Punctul final de autorizare a dispozitivului al furnizorului (RFC 8628) — răspunde cu codul de utilizator și adresa URL de verificare pe care o aprobați de pe orice dispozitiv, în timp ce această gazdă interoghează punctul final de token.',
  'workbench.editors.request.auth.rowInfo.oauth2Issuer':
    'Identificatorul de emitent al furnizorului sau adresa URL a metadatelor sale /.well-known/. Descoperire citește documentul de metadate (RFC 8414 / OpenID Connect Discovery), completează rândurile cu puncte finale de mai jos și enumeră ce spune documentul despre alegerile dvs. — nimic altceva nu se schimbă, iar rândurile rămân ale dvs. după aceea.',
  'workbench.editors.request.auth.rowInfo.oauth2AccessTokenUrl':
    'Punctul final de token al furnizorului la care se schimbă codul (sau acreditările).',
  'workbench.editors.request.auth.rowInfo.oauth2Username':
    'Numele de utilizator al proprietarului resursei, trimis în corpul cererii de token — doar acordarea prin parolă.',
  'workbench.editors.request.auth.rowInfo.oauth2Password':
    'Parola proprietarului resursei, trimisă în corpul cererii de token — doar acordarea prin parolă.',
  'workbench.editors.request.auth.rowInfo.oauth2ClientId':
    'Identifică aplicația — în adresa URL de autorizare și în cererea de token.',
  'workbench.editors.request.auth.rowInfo.oauth2ClientSecret':
    'Autentifică aplicația la punctul final de token — în corp sau ca antet Basic, conform Autentificare client.',
  'workbench.editors.request.auth.rowInfo.oauth2CodeChallengeMethod':
    'PKCE: code_challenge din adresa URL de autorizare este digest-ul S256 al unui verificator emis la fiecare flux.',
  'workbench.editors.request.auth.rowInfo.oauth2CodeVerifier':
    'Emis la fiecare flux și trimis ca code_verifier în schimbul de token, pentru a dovedi că același client l-a pornit.',
  'workbench.editors.request.auth.rowInfo.oauth2Scope':
    'Sferele cerute — trimise separate prin spațiu ca scope în adresa URL de autorizare sau în cererea de token.',
  'workbench.editors.request.auth.rowInfo.oauth2State':
    'Emis la fiecare flux și reprodus de furnizor, astfel încât apelul invers să fie asociat cu această autorizare.',
  'workbench.editors.request.auth.rowInfo.oauth2ClientAuthentication':
    'Cum se legitimează clientul în cererea de token — acreditările în corpul de formular sau într-un antet Authorization: Basic ori un client_assertion semnat în locul secretului.',
  'workbench.editors.request.auth.rowInfo.oauth2AssertionIssuer':
    'Revendicarea iss a aserțiunii acordării — contul de serviciu sau cheia de consumator înregistrată de furnizor.',
  'workbench.editors.request.auth.rowInfo.oauth2AssertionSubject':
    'Revendicarea opțională sub — utilizatorul în numele căruia acționează tokenul (delegare la nivel de domeniu, impersonare); gol nu trimite niciuna.',
  'workbench.editors.request.auth.rowInfo.oauth2AssertionClaims':
    'Revendicări suplimentare îmbinate în aserțiunea acordării, cu prioritate față de cele compuse — revendicări ale furnizorului sau o sferă proprie.',
  'workbench.editors.request.auth.rowInfo.oauth2AssertionAlgorithm':
    'Familia JWS cu care este semnată aserțiunea — una asimetrică pentru cheia privată, HS256/384/512 pentru secretul clientului.',
  'workbench.editors.request.auth.rowInfo.oauth2AssertionKeyId':
    'Antetul kid care numește cheia înregistrată, astfel încât furnizorul să aleagă jumătatea publică potrivită.',
  'workbench.editors.request.auth.rowInfo.oauth2AssertionPrivateKey':
    'Cheia de semnare — PEM, DER simplu sau forma data:application/pkcs8; nu este exportată niciodată.',
  'workbench.editors.request.auth.rowInfo.oauth2AssertionAudience':
    'Revendicarea aud — gol trimite adresa URL a tokenului de acces; FAPI și Keycloak vor în schimb identificatorul emitentului.',
  'workbench.editors.request.auth.rowInfo.oauth2AssertionLifetime':
    'exp minus iat, aplicat la semnare — 300 de secunde implicit; furnizorul îl poate plafona (Google: o oră).',
  'workbench.editors.request.auth.rowInfo.oauth2AssertionHeaders':
    'JSON suplimentar pentru antetul protejat, îmbinat în aserțiune — amprenta de certificat x5t#S256 a Azure.',
  'workbench.editors.request.auth.rowInfo.oauth2RefreshTokenUrl':
    'Punctul final la care se trimite schimbul de reîmprospătare — gol înseamnă adresa URL a tokenului de acces.',
  'workbench.editors.request.auth.rowInfo.oauth2AuthRequest':
    'Parametri suplimentari adăugați la adresa URL de autorizare (audience, prompt, …).',
  'workbench.editors.request.auth.rowInfo.oauth2TokenRequest':
    'Parametri suplimentari în cererea de token — fiecare călătorește în corpul de formular, într-un antet sau în adresa URL, conform câmpului său Trimitere în.',
  'workbench.editors.request.auth.rowInfo.oauth2RefreshRequest':
    'Parametri suplimentari în cererea de reîmprospătare — fiecare călătorește în corpul de formular, într-un antet sau în adresa URL, conform câmpului său Trimitere în.',
  'workbench.editors.request.auth.rowInfo.oauth2SendAs':
    'Antete de cerere trimite tokenul după Bearer în antetul Authorization; Adresă URL a cererii îl adaugă ca access_token — învechit, doar pentru furnizorii vechi.',
  'workbench.editors.request.auth.type.inherit': 'Moștenire autorizare de la părinte',
  'workbench.editors.request.auth.type.none': 'Fără autorizare',
  'workbench.editors.request.auth.type.basic': 'Basic Auth',
  'workbench.editors.request.auth.type.bearer': 'Bearer Token',
  'workbench.editors.request.auth.type.apiKey': 'Cheie API',
  'workbench.editors.request.auth.type.oauth2': 'OAuth 2.0',
  'workbench.editors.request.auth.type.awsSigV4': 'AWS Signature v4',
  'workbench.editors.request.auth.type.edgeGrid': 'Akamai EdgeGrid',
  'workbench.editors.request.auth.type.asap': 'ASAP (Atlassian)',
  'workbench.editors.request.auth.type.digest': 'Digest Auth',
  'workbench.editors.request.auth.type.oauth1': 'OAuth 1.0',
  'workbench.editors.request.auth.type.hawk': 'Hawk Authentication',
  'workbench.editors.request.auth.type.jwtBearer': 'JWT Bearer',
  'workbench.editors.request.auth.type.httpSignature': 'HTTP Message Signature',
  'workbench.editors.request.auth.oauth1ConsumerKey': 'Cheie consumator',
  'workbench.editors.request.auth.oauth1ConsumerKeyPlaceholder': 'cheia consumatorului',
  'workbench.editors.request.auth.oauth1ConsumerSecret': 'Secret consumator',
  'workbench.editors.request.auth.oauth1ConsumerSecretPlaceholder': 'secretul consumatorului',
  'workbench.editors.request.auth.oauth1Token': 'Token de acces',
  'workbench.editors.request.auth.oauth1TokenPlaceholder': 'opțional — gol pentru apelurile cu o singură etapă',
  'workbench.editors.request.auth.oauth1TokenSecret': 'Secret token',
  'workbench.editors.request.auth.oauth1TokenSecretPlaceholder': 'opțional — gol pentru apelurile cu o singură etapă',
  'workbench.editors.request.auth.oauth1SignatureMethod': 'Metodă de semnare',
  'workbench.editors.request.auth.oauth1PrivateKey': 'Cheie privată',
  'workbench.editors.request.auth.oauth1PrivateKeyPlaceholder': '{{vault.private_key}} sau PEM',
  'workbench.editors.request.auth.oauth1IncludeBodyHash': 'Includere hash al corpului',
  'workbench.editors.request.auth.oauth1Realm': 'Realm',
  'workbench.editors.request.auth.oauth1RealmPlaceholder': 'opțional',
  'workbench.editors.request.auth.hawkAuthId': 'Hawk Auth ID',
  'workbench.editors.request.auth.hawkAuthIdPlaceholder': 'hawk auth id',
  'workbench.editors.request.auth.hawkAuthKey': 'Hawk Auth Key',
  'workbench.editors.request.auth.hawkAuthKeyPlaceholder': 'hawk auth key',
  'workbench.editors.request.auth.hawkAlgorithm': 'Algoritm',
  'workbench.editors.request.auth.hawkExt': 'ext',
  'workbench.editors.request.auth.hawkExtPlaceholder': 'opțional — date specifice aplicației',
  'workbench.editors.request.auth.hawkApp': 'app',
  'workbench.editors.request.auth.hawkAppPlaceholder': 'opțional — ID-ul aplicației',
  'workbench.editors.request.auth.hawkDlg': 'dlg',
  'workbench.editors.request.auth.hawkDlgPlaceholder': 'opțional — ID-ul aplicației delegante',
  'workbench.editors.request.auth.hawkIncludePayloadHash': 'Includere hash al conținutului util',
  'workbench.editors.request.auth.jwtAddTo': 'Adăugare token JWT în',
  'workbench.editors.request.auth.jwtAlgorithm': 'Algoritm',
  'workbench.editors.request.auth.jwtSecret': 'Secret',
  'workbench.editors.request.auth.jwtSecretPlaceholder': 'secret',
  'workbench.editors.request.auth.jwtSecretBase64': 'Secret codificat Base64',
  'workbench.editors.request.auth.jwtPrivateKey': 'Cheie privată',
  'workbench.editors.request.auth.jwtPrivateKeyPlaceholder': '{{vault.private_key}} sau PEM',
  'workbench.editors.request.auth.jwtPayload': 'Payload',
  'workbench.editors.request.auth.jwtPayloadPlaceholder': '{}',
  'workbench.editors.request.auth.jwtHeaders': 'Antete JWT',
  'workbench.editors.request.auth.jwtHeadersPlaceholder': '{}',
  'workbench.editors.request.auth.jwtHeadersNote': 'Antetele specifice algoritmului sunt adăugate automat.',
  'workbench.editors.request.auth.jwtHeaderPrefix': 'Prefix antet de cerere',
  'workbench.editors.request.auth.jwtExpiresIn': 'Expiră în (secunde)',
  'workbench.editors.request.auth.jwtExpiresInPlaceholder': 'opțional',
  'workbench.editors.request.auth.jwtExpiresInNote':
    'Când este setat, iat și exp sunt aplicate în conținutul util la trimitere. Revendicările setate în conținutul util au prioritate.',
  'workbench.editors.request.auth.digestBrowserNote':
    'Digest Auth răspunde la provocarea serverului cu o a doua cerere, care rulează în aplicația desktop și în CLI. Trimiterile de pe această suprafață pleacă fără ea — serverul răspunde 401.',
  'workbench.editors.request.auth.digestRetryNote':
    'Implicit, provocarea 401 primește răspuns și cererea este reîncercată automat. Doriți să dezactivați acest comportament?',
  'workbench.editors.request.auth.digestDisableRetry': 'Da, dezactivare reîncercare cerere',
  'workbench.editors.request.auth.authAutoGeneratedNote':
    'Antetul de autorizare va fi generat automat la trimiterea cererii.',
  'workbench.editors.request.auth.inheritNote': 'Antetul de autorizare va fi generat automat la trimiterea cererii.',
  'workbench.editors.request.auth.noneNote': 'Această cerere nu folosește nicio autorizare.',
  'workbench.editors.request.auth.inheritDetail':
    'Această cerere folosește ajutorul de autorizare din colecția părinte. Editați fila Autorizare a colecției pentru a-l schimba.',
  'workbench.editors.request.auth.inheritedNone': 'Fără autorizare — nimic nu este setat pe folder sau pe colecție.',
  'workbench.editors.request.auth.sourceCollection': 'Colecția „{name}”',
  'workbench.editors.request.auth.sourceFolder': 'Folderul „{name}”',
  'workbench.editors.request.auth.groupInherited': 'Moștenită',
  'workbench.editors.request.auth.refusalQualifier.inQuery': 'în interogare',
  'workbench.editors.request.auth.refusalQualifier.inHeader': 'în antet',
  'workbench.editors.request.auth.refusalQualifier.dpopBound': 'legat de o cheie DPoP',
  'workbench.editors.request.auth.groupOwn': 'Această cerere',
  'workbench.editors.request.auth.groupOwnFolder': 'Acest folder',
  'workbench.editors.request.auth.optionMissingEntry': 'Intrare lipsă',
  'workbench.editors.request.auth.danglingPick':
    'Intrarea aleasă de această cerere nu mai există — se aplică în schimb cea mai apropiată intrare implicită.',
  'workbench.editors.request.auth.editInParent': 'Editare în părinte',
  // The settings rows' inherited line — {source} is the level label
  // above (Colecția „X” / Folderul „X”).
  'workbench.editors.request.settings.inheritedFrom': 'Moștenit de la {source}',
  'workbench.editors.request.settings.overridesSource': 'Suprascrie {source} ({value})',
  'workbench.editors.request.settings.settingChainTitle': 'Unde este setată această setare',
  'workbench.editors.request.settings.settingChainSummary':
    'Fiecare nivel care setează această opțiune, de la cel mai exterior — valoarea cea mai interioară este cea în vigoare.',
  'workbench.editors.request.settings.settingChainHeading': 'Niveluri',
  'workbench.editors.request.settings.thisRequest': 'Această cerere',
  'workbench.editors.request.settings.thisFolder': 'Acest folder',
  'workbench.editors.request.auth.resetToInheritedAuth': 'Resetare la autorizarea moștenită',
  'workbench.editors.request.auth.resizeRailAria': 'Redimensionare șina tipurilor de autorizare',
  'workbench.editors.request.auth.username': 'Nume de utilizator',
  'workbench.editors.request.auth.password': 'Parolă',
  'workbench.editors.request.auth.token': 'Token',
  'workbench.editors.request.auth.key': 'Cheie',
  'workbench.editors.request.auth.keyPlaceholder': 'de ex. X-API-Key',
  'workbench.editors.request.auth.value': 'Valoare',
  'workbench.editors.request.auth.addTo': 'Adăugare în',
  'workbench.editors.request.auth.addToHeader': 'Antet',
  'workbench.editors.request.auth.addToQuery': 'Parametri de interogare',
  'workbench.editors.request.auth.usernamePlaceholder': 'nume de utilizator',
  'workbench.editors.request.auth.passwordPlaceholder': 'parolă',
  'workbench.editors.request.auth.tokenPlaceholder': 'token bearer',
  'workbench.editors.request.auth.valuePlaceholder': 'valoarea cheii API',
  'workbench.editors.request.auth.awsAccessKey': 'Cheie de acces',
  'workbench.editors.request.auth.awsSecretKey': 'Cheie secretă',
  'workbench.editors.request.auth.awsSessionToken': 'Token de sesiune',
  'workbench.editors.request.auth.awsService': 'Nume serviciu',
  'workbench.editors.request.auth.awsRegion': 'Regiune',
  'workbench.editors.request.auth.awsAccessKeyPlaceholder': 'de ex. AKIAIOSFODNN7EXAMPLE',
  'workbench.editors.request.auth.awsSecretKeyPlaceholder': 'cheia de acces secretă',
  'workbench.editors.request.auth.awsSessionTokenPlaceholder': 'opțional — doar acreditări temporare (STS)',
  'workbench.editors.request.auth.awsServicePlaceholder': 'automat dintr-o gazdă AWS — de ex. s3, execute-api',
  'workbench.editors.request.auth.awsRegionPlaceholder': 'automat dintr-o gazdă AWS, altfel us-east-1',
  'workbench.editors.request.auth.edgeGridClientToken': 'Token client',
  'workbench.editors.request.auth.edgeGridAccessToken': 'Token de acces',
  'workbench.editors.request.auth.edgeGridClientSecret': 'Secret client',
  'workbench.editors.request.auth.edgeGridHeadersToSign': 'Antete de semnat',
  'workbench.editors.request.auth.edgeGridMaxBodySize': 'Dimensiune maximă corp',
  'workbench.editors.request.auth.edgeGridClientTokenPlaceholder': 'de ex. akab-client-token-xxx',
  'workbench.editors.request.auth.edgeGridAccessTokenPlaceholder': 'de ex. akab-access-token-xxx',
  'workbench.editors.request.auth.edgeGridClientSecretPlaceholder': 'secretul clientului',
  'workbench.editors.request.auth.edgeGridHeadersToSignPlaceholder':
    'opțional — separate prin virgulă, de ex. X-Test1, X-Test2',
  'workbench.editors.request.auth.edgeGridMaxBodySizePlaceholder': '131072',
  'workbench.editors.request.auth.asapAlgorithm': 'Algoritm',
  'workbench.editors.request.auth.asapKeyId': 'ID cheie',
  'workbench.editors.request.auth.asapPrivateKey': 'Cheie privată',
  'workbench.editors.request.auth.asapIssuer': 'Emitent',
  'workbench.editors.request.auth.asapAudience': 'Audiență',
  'workbench.editors.request.auth.asapSubject': 'Subiect',
  'workbench.editors.request.auth.asapClaims': 'Revendicări suplimentare',
  'workbench.editors.request.auth.asapExpiresIn': 'Expirare (secunde)',
  'workbench.editors.request.auth.asapKeyIdPlaceholder': 'de ex. my-service/key-1',
  'workbench.editors.request.auth.asapPrivateKeyPlaceholder':
    '-----BEGIN PRIVATE KEY----- … sau forma data:application/pkcs8',
  'workbench.editors.request.auth.asapIssuerPlaceholder': 'de ex. my-service',
  'workbench.editors.request.auth.asapAudiencePlaceholder': 'de ex. api.openheaders.io',
  'workbench.editors.request.auth.asapSubjectPlaceholder': 'opțional — gol trimite emitentul',
  'workbench.editors.request.auth.asapClaimsPlaceholder': 'opțional — JSON, de ex. {"scope":"read"}',
  'workbench.editors.request.auth.asapExpiresInPlaceholder': '3600',
  'workbench.editors.request.auth.httpSigAlgorithm': 'Algoritm',
  'workbench.editors.request.auth.httpSigKeyId': 'ID cheie',
  'workbench.editors.request.auth.httpSigPrivateKey': 'Cheie privată',
  'workbench.editors.request.auth.httpSigSecret': 'Secret partajat',
  'workbench.editors.request.auth.httpSigSecretBase64': 'Secretul este codificat base64',
  'workbench.editors.request.auth.httpSigComponents': 'Componente semnate',
  'workbench.editors.request.auth.httpSigContentDigest': 'Content Digest',
  'workbench.editors.request.auth.httpSigDigestNone': 'Niciunul',
  'workbench.editors.request.auth.httpSigLabel': 'Etichetă',
  'workbench.editors.request.auth.httpSigCreated': 'Marcaj de timp created',
  'workbench.editors.request.auth.httpSigExpiresIn': 'Expiră după (secunde)',
  'workbench.editors.request.auth.httpSigNonce': 'Nonce',
  'workbench.editors.request.auth.httpSigIncludeAlg': 'Parametrul algoritmului (alg)',
  'workbench.editors.request.auth.httpSigTag': 'Tag',
  'workbench.editors.request.auth.httpSigKeyIdPlaceholder': 'de ex. my-service-key-1',
  'workbench.editors.request.auth.httpSigPrivateKeyPlaceholder': '-----BEGIN PRIVATE KEY----- (PEM)',
  'workbench.editors.request.auth.httpSigSecretPlaceholder': 'secretul partajat cu verificatorul',
  'workbench.editors.request.auth.httpSigLabelPlaceholder': 'sig1',
  'workbench.editors.request.auth.httpSigExpiresInPlaceholder': 'opțional — de ex. 300',
  'workbench.editors.request.auth.httpSigTagPlaceholder': 'opțional — o etichetă de aplicație',
  'workbench.editors.request.auth.sendAsLabel': 'Adăugare date de autorizare în',
  'workbench.editors.request.auth.sendAsHeaders': 'Antete de cerere',
  'workbench.editors.request.auth.sendAsUrl': 'Adresă URL a cererii',
  'workbench.editors.request.auth.presetLabel': 'Presetare furnizor',
  'workbench.editors.request.auth.presetInfo':
    'Alegerea unui furnizor completează în avans punctele finale de autorizare / token, sferele implicite și fluxul recomandat. Alegeți Personalizată pentru a configura totul manual.',
  'workbench.editors.request.auth.presetCustom': 'Personalizată (fără presetare)',

  // ── OAuth 2.0 editor (grant-type names stay raw spec vocabulary) ───
  'workbench.editors.request.oauth.queryWarningTitle': 'Trimiterea tokenului de acces în adresa URL este învechită',
  'workbench.editors.request.oauth.queryWarningBefore':
    'RFC 6750 §2.3 a păstrat metoda parametrului de interogare URI, dar avertizează împotriva ei: tokenurile ajung în jurnalele serverelor, în antetele HTTP `Referer`, în istoricul browserului și în cache-urile intermediarilor. Preferați antetul implicit',
  'workbench.editors.request.oauth.queryWarningAfter':
    '— cu excepția cazului în care furnizorul cere forma cu interogare.',
  'workbench.editors.request.oauth.tokenLabel': 'Token',
  'workbench.editors.request.oauth.noTokenPlaceholder':
    'Niciun token încă — folosiți Obținere token de acces nou de mai jos',
  'workbench.editors.request.oauth.headerPrefix': 'Prefix antet',
  'workbench.editors.request.oauth.tokenBinding': 'Legare token',
  'workbench.editors.request.oauth.tokenBindingNone': 'Niciuna (bearer)',
  'workbench.editors.request.oauth.tokenBindingDpop': 'DPoP',
  'workbench.editors.request.oauth.dpopAlgorithm': 'Algoritm dovadă',
  'workbench.editors.request.oauth.autoRefresh': 'Reîmprospătare automată token',
  'workbench.editors.request.oauth.autoRefreshDesc':
    'Tokenul dvs. expirat va fi reîmprospătat automat înainte de trimiterea unei cereri.',
  'workbench.editors.request.oauth.status': 'Stare',
  'workbench.editors.request.oauth.statusExpired':
    'Expirat — următoarea trimitere va reîmprospăta automat când este stocat un refresh_token.',
  'workbench.editors.request.oauth.statusValid': 'Valid · {duration}',
  'workbench.editors.request.oauth.refreshNow': 'Reîmprospătare acum',
  'workbench.editors.request.oauth.disconnect': 'Deconectare',
  'workbench.editors.request.oauth.tokenName': 'Nume token',
  'workbench.editors.request.oauth.tokenNameDesc':
    'Etichetă liberă, afișată în lista de acreditări când un spațiu de lucru are mai multe tokenuri pentru același furnizor.',
  'workbench.editors.request.oauth.tokenNamePlaceholder': 'Introduceți un nume de token…',
  'workbench.editors.request.oauth.grantType': 'Tip de acordare',
  'workbench.editors.request.oauth.callbackUrl': 'Adresă URL de apel invers',
  'workbench.editors.request.oauth.detecting': 'Se detectează…',
  'workbench.editors.request.oauth.callbackTipBeforeExtUrl':
    'Înregistrați această adresă URL la furnizorul dvs. OAuth. Arată diferit față de',
  'workbench.editors.request.oauth.callbackTipBeforeHost':
    'adresa URL din bara de adrese, deoarece Chrome expune o gazdă de redirecționare dedicată,',
  'workbench.editors.request.oauth.callbackTipBeforeApi': 'pentru',
  'workbench.editors.request.oauth.callbackTipAfterApi': '. ID-ul extensiei este același; doar gazda și schema diferă.',
  'workbench.editors.request.oauth.authorizeUsingBrowser': 'Autorizare prin browser',
  'workbench.editors.request.oauth.noTokenNote':
    'Niciun token încă — rulați un flux de mai jos pentru a obține unul. Pentru un token emis pe altă cale, folosiți în schimb autorizarea Bearer Token.',
  'workbench.editors.request.oauth.authorizeBrowserInfoSummary':
    'Conectarea se deschide în browserul dvs. implicit — acesta deține sesiunea furnizorului, managerul de parole și cheile de acces, iar furnizorii de identitate blochează conectările încorporate în aplicații (RFC 8252).',
  'workbench.editors.request.oauth.authorizeBrowserInfoDetail':
    'Furnizorul trimite browserul înapoi la adresa URL de apel invers de pe portul backend al aplicației — schimbarea portului în Setări schimbă adresa URL de înregistrat.',
  'workbench.editors.request.oauth.authUrl': 'Adresă URL de autorizare',
  'workbench.editors.request.oauth.accessTokenUrl': 'Adresă URL token de acces',
  'workbench.editors.request.oauth.clientId': 'ID client',
  'workbench.editors.request.oauth.clientSecret': 'Secret client',
  'workbench.editors.request.oauth.codeChallengeMethod': 'Code Challenge Method',
  'workbench.editors.request.oauth.codeVerifier': 'Code Verifier',
  'workbench.editors.request.oauth.codeVerifierPlaceholder': 'Generat automat dacă rămâne gol',
  'workbench.editors.request.oauth.scope': 'Scope',
  'workbench.editors.request.oauth.scopePlaceholder': 'de ex. read:org',
  'workbench.editors.request.oauth.state': 'State',
  'workbench.editors.request.oauth.stateAuto': 'Generat automat la fiecare cerere de autorizare',
  'workbench.editors.request.oauth.clientAuthentication': 'Autentificare client',
  'workbench.editors.request.oauth.clientAuthenticationDesc':
    'Cum se legitimează clientul la cererile POST de token — ID-ul și secretul în corp sau într-un antet Basic, ori un JWT semnat cu o cheie privată (private_key_jwt) sau cu secretul (client_secret_jwt).',
  'workbench.editors.request.oauth.clientAuthBody': 'Trimitere acreditări client în corp',
  'workbench.editors.request.oauth.clientAuthBasicHeader': 'Trimitere ca antet Basic Auth',
  'workbench.editors.request.oauth.clientAuthPrivateKeyJwt': 'Trimitere JWT semnat (private_key_jwt)',
  'workbench.editors.request.oauth.clientAuthClientSecretJwt': 'Trimitere JWT HMAC (client_secret_jwt)',
  'workbench.editors.request.oauth.assertionIssuer': 'Emitent',
  'workbench.editors.request.oauth.assertionIssuerPlaceholder': 'de ex. service-account@openheaders.com',
  'workbench.editors.request.oauth.assertionSubject': 'Subiect',
  'workbench.editors.request.oauth.assertionSubjectPlaceholder':
    'opțional — utilizatorul în numele căruia acționează tokenul',
  'workbench.editors.request.oauth.assertionClaims': 'Revendicări suplimentare',
  'workbench.editors.request.oauth.assertionClaimsPlaceholder': 'opțional — JSON, de ex. {"box_sub_type":"enterprise"}',
  'workbench.editors.request.oauth.assertionAlgorithm': 'Algoritm',
  'workbench.editors.request.oauth.assertionKeyId': 'ID cheie',
  'workbench.editors.request.oauth.assertionKeyIdPlaceholder': 'opțional — antetul kid, de ex. key-1',
  'workbench.editors.request.oauth.assertionPrivateKey': 'Cheie privată',
  'workbench.editors.request.oauth.assertionPrivateKeyPlaceholder':
    '-----BEGIN PRIVATE KEY----- … (PEM sau forma data:application/pkcs8)',
  'workbench.editors.request.oauth.assertionAudience': 'Audiență',
  'workbench.editors.request.oauth.assertionAudiencePlaceholder': 'gol = adresa URL a tokenului de acces',
  'workbench.editors.request.oauth.assertionLifetime': 'Durată de viață (secunde)',
  'workbench.editors.request.oauth.assertionHeaders': 'Antete suplimentare',
  'workbench.editors.request.oauth.assertionHeadersPlaceholder': 'opțional — JSON, de ex. {"x5t#S256":"…"}',
  'workbench.editors.request.oauth.advancedIntro':
    'Aici puteți adăuga personalizări mai specifice pentru cererile dvs. OAuth2.',
  'workbench.editors.request.oauth.advancedLearnMore': 'Aflați mai multe despre configurare',
  'workbench.editors.request.oauth.refreshTokenUrl': 'Adresă URL token de reîmprospătare',
  'workbench.editors.request.oauth.refreshTokenUrlDesc':
    'Majoritatea furnizorilor reutilizează adresa URL a tokenului de acces pentru reîmprospătare; furnizați o suprascriere doar când furnizorul expune o cale distinctă.',
  'workbench.editors.request.oauth.sendInColumn': 'Trimitere în',
  'workbench.editors.request.oauth.sendInBody': 'Corp',
  'workbench.editors.request.oauth.sendInHeader': 'Antet',
  'workbench.editors.request.oauth.sendInUrl': 'URL',
  'workbench.editors.request.oauth.authRequest': 'Cerere de autorizare',
  'workbench.editors.request.oauth.tokenRequest': 'Cerere de token',
  'workbench.editors.request.oauth.refreshRequest': 'Cerere de reîmprospătare',
  'workbench.editors.request.oauth.getNewToken': 'Obținere token de acces nou',
  'workbench.editors.request.oauth.clearCookies': 'Golire cookie-uri',
  'workbench.editors.request.oauth.storedFootnoteBefore': 'Tokenurile sunt stocate per spațiu de lucru în',
  'workbench.editors.request.oauth.storedFootnoteAfter': '. Ștergeți spațiul de lucru pentru a le elimina.',
  'workbench.editors.request.oauth.toast.tokenReceived': 'OAuth: token primit',
  'workbench.editors.request.oauth.toast.authorizationComplete': 'OAuth: autorizare finalizată',
  'workbench.editors.request.oauth.toast.failed': 'OAuth a eșuat: {error}',
  'workbench.editors.request.oauth.toast.refreshed': 'OAuth: token de acces reîmprospătat',
  'workbench.editors.request.oauth.toast.refreshFailed': 'Reîmprospătarea a eșuat: {error}',
  'workbench.editors.request.oauth.toast.disconnected': 'OAuth: deconectat',
  'workbench.editors.request.oauth.toast.callbackCopied': 'Adresa URL de apel invers a fost copiată',
  'workbench.editors.request.oauth.toast.copyUnsupported': 'Copierea nu este acceptată — selectați adresa URL manual',
  'workbench.editors.request.oauth.deviceAuthUrl': 'Adresă URL de autorizare a dispozitivului',
  'workbench.editors.request.oauth.deviceWaitingTitle': 'În așteptarea aprobării dvs. pe {host}',
  'workbench.editors.request.oauth.deviceWaitingDesc':
    'Deschideți linkul pe orice dispozitiv, introduceți codul și aprobați. Această pagină se actualizează singură.',
  'workbench.editors.request.oauth.deviceCode': 'Cod',
  'workbench.editors.request.oauth.deviceOpen': 'Deschidere',
  'workbench.editors.request.oauth.deviceCancel': 'Anulare',
  'workbench.editors.request.oauth.deviceExpiresIn': 'Expiră în {duration}',
  'workbench.editors.request.oauth.deviceCheckEvery': 'Verificare la fiecare {seconds}s',
  'workbench.editors.request.oauth.toast.deviceStarted': 'OAuth: aprobați pe {host} cu codul {code}',
  'workbench.editors.request.oauth.toast.deviceGranted': 'OAuth: autorizarea dispozitivului a fost aprobată',
  'workbench.editors.request.oauth.toast.deviceDenied': 'OAuth: autorizarea a fost refuzată — {error}',
  'workbench.editors.request.oauth.toast.deviceExpired': 'OAuth: codul dispozitivului a expirat — {error}',
  'workbench.editors.request.oauth.toast.deviceFailed': 'Autorizarea dispozitivului OAuth a eșuat: {error}',
  'workbench.editors.request.oauth.toast.deviceCancelled': 'OAuth: autorizarea dispozitivului a fost anulată',
  'workbench.editors.request.oauth.toast.codeCopied': 'Cod copiat',
  'workbench.editors.request.oauth.issuerUrl': 'Adresă URL emitent',
  'workbench.editors.request.oauth.issuerUrlPlaceholder':
    'https://accounts.example.com — sau adresa URL a metadatelor /.well-known/…',
  'workbench.editors.request.oauth.discover': 'Descoperire',
  'workbench.editors.request.oauth.toast.discovered': 'OAuth: puncte finale descoperite',
  'workbench.editors.request.oauth.toast.discoveryFailed': 'Descoperirea a eșuat: {error}',
  'workbench.editors.request.oauth.discoveryTitle': 'Descoperit din {url}',
  'workbench.editors.request.oauth.discoveryFilled': 'Completate: {rows}',
  'workbench.editors.request.oauth.discoveryFilledNone': 'Documentul nu numește niciun punct final — nimic completat',
  'workbench.editors.request.oauth.discoveryListed': '{pick} — din lista furnizorului',
  'workbench.editors.request.oauth.discoveryUnlisted': '{pick} — nu este în listă; furnizorul enumeră {supported}',
  'workbench.editors.request.oauth.discoveryPickClientAuth': 'Autentificare client {value}',
  'workbench.editors.request.oauth.discoveryPickGrant': 'Acordare {value}',
  'workbench.editors.request.oauth.discoveryPickPkce': 'PKCE {value}',
  'workbench.editors.request.oauth.discoveryPickDpop': 'Algoritm DPoP {value}',
  'workbench.editors.request.oauth.discoveryPickAssertionAlg': 'Algoritm aserțiune {value}',
  'workbench.editors.request.oauth.discoveryAudience':
    'ID emitent — {issuer}; unii furnizori îl vor ca Audiență a aserțiunii în locul adresei URL a tokenului de acces',
  'workbench.editors.request.oauth.discoveryScopes': 'Sfere oferite: {supported} — sugerate în rândul Scope',

  // ── Body tab (encoding radios + format labels stay raw) ────────────
  'workbench.editors.request.body.noBody': 'Această cerere nu are corp',
  'workbench.editors.request.body.modeNoneInfo':
    'Cererea este trimisă fără conținut util — fără octeți de corp și fără antet Content-Type.',
  'workbench.editors.request.body.modeFormDataInfo':
    'Trimite părțile ca un singur conținut util multipart/form-data — fiecare rând este un câmp text sau o parte de tip fișier.',
  'workbench.editors.request.body.modeFormDataDescription':
    'Antetul Content-Type cu boundary este emis la trimitere; un Content-Type multipart setat manual este înlocuit, astfel încât boundary-ul să corespundă întotdeauna conținutului util.',
  'workbench.editors.request.body.modeFormUrlencodedInfo':
    'Trimite câmpurile ca perechi cheie=valoare codificate procentual, cu un Content-Type application/x-www-form-urlencoded. Rândurile dezactivate rămân în editor, dar nu ajung niciodată pe fir.',
  'workbench.editors.request.body.modeRawInfo':
    'Trimite conținutul editorului ca atare — octeții de pe fir sunt exact ceea ce ați tastat.',
  'workbench.editors.request.body.modeRawDescription':
    'Selectorul de format determină evidențierea sintaxei și antetul Content-Type implicit (application/json, application/xml, text/plain, text/javascript, text/html); un Content-Type setat în fila Antete are prioritate.',
  'workbench.editors.request.body.modeGraphqlInfo':
    'Trimite interogarea și variabilele ca un singur conținut util application/json — { query, variables } — conform transportului HTTP GraphQL.',
  'workbench.editors.request.body.modeGraphqlDescription':
    'Variabilele trebuie să fie JSON valid; un panou de variabile neanalizabil este omis din corpul de pe fir, iar interogarea este trimisă singură.',
  'workbench.editors.request.body.format': 'Formatare',
  'workbench.editors.request.body.formatAria': 'Formatare corp',
  'workbench.editors.request.body.queryTitle': 'Query',
  'workbench.editors.request.body.queryInfoTitle': 'Interogare GraphQL',
  'workbench.editors.request.body.queryInfoSummary':
    'Trimisă ca un POST simplu cu un corp JSON { query, variables }. Introspecția schemei și completarea automată a interogării nu sunt disponibile încă.',
  'workbench.editors.request.body.variablesTitle': 'Variabile GraphQL',
  'workbench.editors.request.body.variablesInfoTitle': 'Variabile GraphQL',
  'workbench.editors.request.body.variablesInfoSummary':
    'Definiți variabile în format JSON pentru a le referenția din interogare (de ex. $id).',
  'workbench.editors.request.body.kindText': 'Text',
  'workbench.editors.request.body.kindFile': 'Fișier',
  'workbench.editors.request.body.newFile': 'Fișier nou de pe computerul local',
  'workbench.editors.request.body.uploadedFiles': 'Fișiere încărcate',
  'workbench.editors.request.body.allAttached': 'Toate fișierele încărcate sunt deja atașate',
  'workbench.editors.request.body.selectFiles': 'Selectare fișiere',
  'workbench.editors.request.body.loadingFiles': 'Se încarcă fișierele…',
  'workbench.editors.request.body.addFile': '+ Adăugare fișier',
  'workbench.editors.request.body.uploadRequired': 'Încărcare necesară',
  'workbench.editors.request.body.deleteFileAria': 'Ștergere fișier {filename} din spațiul de lucru',

  // ── Docs tab ───────────────────────────────────────────────────────
  'workbench.editors.request.docs.write': 'Scriere',
  'workbench.editors.request.docs.preview': 'Previzualizare',
  'workbench.editors.request.docs.infoTitle': 'Docs',
  'workbench.editors.request.docs.infoSummary':
    'Documentați această cerere — de ce există, când se rulează, sfera de autorizare așteptată. Markdown acceptat: titluri, liste, tabele, blocuri de cod, linkuri. Referințele {{variable}} se afișează ca cipuri în previzualizare.',
  'workbench.editors.request.docs.placeholder':
    'Ce face această cerere?\nDe ce există, când se rulează, sfera de autorizare așteptată.',
  'workbench.editors.request.docs.empty': 'Nimic documentat încă — treceți la Scriere pentru a adăuga note.',

  // ── Scripts tab (oh.* API labels + Monaco menu plane stay raw) ─────
  'workbench.editors.request.scripts.preRequest': 'Înainte de cerere',
  'workbench.editors.request.scripts.postResponse': 'După răspuns',
  'workbench.editors.request.scripts.preInfoTitle': 'Script înainte de cerere',
  'workbench.editors.request.scripts.preInfoSummary':
    'Rulează o dată înainte ca cererea să plece. Rescrieți adresa URL, antetele, parametrii și corpul cu interfața API oh.',
  'workbench.editors.request.scripts.postInfoTitle': 'Script după răspuns',
  'workbench.editors.request.scripts.postInfoSummary':
    'Rulează o dată după sosirea răspunsului. Citiți starea, antetele și corpul; rezultatele verificărilor ajung în panoul Răspuns.',
  'workbench.editors.request.scripts.apiHeading': 'API',
  'workbench.editors.request.scripts.apiSetHeader': 'adaugă sau înlocuiește un antet',
  'workbench.editors.request.scripts.apiSetQueryParam': 'adaugă sau înlocuiește un parametru de interogare',
  'workbench.editors.request.scripts.apiSetUrl': 'rescrie adresa URL țintă',
  'workbench.editors.request.scripts.apiSetBody': 'înlocuiește corpul cererii',
  'workbench.editors.request.scripts.apiRequire': 'încarcă un pachet de scripturi din Biblioteca de pachete',
  'workbench.editors.request.scripts.apiTest': 'înregistrează o verificare',
  'workbench.editors.request.scripts.runsAfter': 'Rulează după {count} scripturi:',
  'workbench.editors.request.scripts.runsAfterOne': 'Rulează după 1 script:',
  'workbench.editors.request.scripts.prePlaceholderContainer':
    'Scrieți scripturi care să ruleze înainte de trimiterea fiecărei cereri HTTP.',
  'workbench.editors.request.scripts.postPlaceholderContainer':
    'Scrieți scripturi care să ruleze la sfârșitul fiecărui răspuns HTTP.',
  'workbench.editors.request.scripts.prePlaceholder':
    'Folosiți JavaScript pentru a modifica această cerere înainte de trimitere.',
  'workbench.editors.request.scripts.postPlaceholder':
    'Folosiți JavaScript pentru a verifica și a citi acest răspuns după sosire.',
  // ── Session script slots (gRPC · WebSocket · MQTT) ─────────────────
  'workbench.editors.request.scripts.grpcBeforeInvoke': 'Înainte de invocare',
  'workbench.editors.request.scripts.grpcOnMessage': 'La mesaj',
  'workbench.editors.request.scripts.grpcAfterResponse': 'După răspuns',
  'workbench.editors.request.scripts.wsBeforeConnect': 'Înainte de conectare',
  'workbench.editors.request.scripts.wsBeforeSend': 'Înainte de trimitere',
  'workbench.editors.request.scripts.wsOnMessage': 'La mesaj',
  'workbench.editors.request.scripts.wsAfterClose': 'După închidere',
  'workbench.editors.request.scripts.mqttBeforeConnect': 'Înainte de conectare',
  'workbench.editors.request.scripts.mqttBeforePublish': 'Înainte de publicare',
  'workbench.editors.request.scripts.mqttOnMessage': 'La mesaj',
  'workbench.editors.request.scripts.mqttAfterClose': 'După închidere',
  'workbench.editors.request.scripts.grpcBeforeInvokePlaceholder':
    'Folosiți JavaScript pentru a modifica metadatele și mesajul înainte de invocarea acestui apel.',
  'workbench.editors.request.scripts.grpcOnMessagePlaceholder':
    'Folosiți JavaScript pentru a citi fiecare cadru de mesaj pe măsură ce sosește.',
  'workbench.editors.request.scripts.grpcAfterResponsePlaceholder':
    'Folosiți JavaScript pentru a verifica și a citi replica după încheierea acestui apel.',
  'workbench.editors.request.scripts.wsBeforeConnectPlaceholder':
    'Folosiți JavaScript pentru a modifica handshake-ul înainte de conectarea acestei sesiuni.',
  'workbench.editors.request.scripts.wsBeforeSendPlaceholder':
    'Folosiți JavaScript pentru a modifica sau a elimina fiecare mesaj înainte de trimitere.',
  'workbench.editors.request.scripts.wsOnMessagePlaceholder':
    'Folosiți JavaScript pentru a reacționa la fiecare mesaj pe măsură ce sosește.',
  'workbench.editors.request.scripts.wsAfterClosePlaceholder':
    'Folosiți JavaScript pentru a verifica și a citi această sesiune după închidere.',
  'workbench.editors.request.scripts.mqttBeforeConnectPlaceholder':
    'Folosiți JavaScript pentru a modifica pachetul CONNECT înainte de conectarea acestei sesiuni.',
  'workbench.editors.request.scripts.mqttBeforePublishPlaceholder':
    'Folosiți JavaScript pentru a modifica sau a elimina fiecare mesaj înainte de publicare.',
  'workbench.editors.request.scripts.mqttOnMessagePlaceholder':
    'Folosiți JavaScript pentru a reacționa la fiecare mesaj pe măsură ce sosește.',
  'workbench.editors.request.scripts.mqttAfterClosePlaceholder':
    'Folosiți JavaScript pentru a verifica și a citi această sesiune după deconectare.',
  'workbench.editors.request.scripts.grpcBeforeInvokePlaceholderContainer':
    'Scrieți scripturi care să ruleze înainte de invocarea fiecărui apel gRPC.',
  'workbench.editors.request.scripts.grpcOnMessagePlaceholderContainer':
    'Scrieți scripturi care să ruleze la fiecare cadru de mesaj gRPC.',
  'workbench.editors.request.scripts.grpcAfterResponsePlaceholderContainer':
    'Scrieți scripturi care să ruleze la sfârșitul fiecărui apel gRPC.',
  'workbench.editors.request.scripts.wsBeforeConnectPlaceholderContainer':
    'Scrieți scripturi care să ruleze înainte de conectarea fiecărei sesiuni WebSocket.',
  'workbench.editors.request.scripts.wsBeforeSendPlaceholderContainer':
    'Scrieți scripturi care să ruleze înainte de trimiterea fiecărui mesaj WebSocket.',
  'workbench.editors.request.scripts.wsOnMessagePlaceholderContainer':
    'Scrieți scripturi care să ruleze la fiecare mesaj WebSocket primit.',
  'workbench.editors.request.scripts.wsAfterClosePlaceholderContainer':
    'Scrieți scripturi care să ruleze după închiderea fiecărei sesiuni WebSocket.',
  'workbench.editors.request.scripts.mqttBeforeConnectPlaceholderContainer':
    'Scrieți scripturi care să ruleze înainte de conectarea fiecărei sesiuni MQTT.',
  'workbench.editors.request.scripts.mqttBeforePublishPlaceholderContainer':
    'Scrieți scripturi care să ruleze înainte de publicarea fiecărui mesaj MQTT.',
  'workbench.editors.request.scripts.mqttOnMessagePlaceholderContainer':
    'Scrieți scripturi care să ruleze la fiecare mesaj MQTT primit.',
  'workbench.editors.request.scripts.mqttAfterClosePlaceholderContainer':
    'Scrieți scripturi care să ruleze după deconectarea fiecărei sesiuni MQTT.',
  'workbench.editors.request.scripts.grpcBeforeInvokeInfoTitle': 'Script înainte de invocare',
  'workbench.editors.request.scripts.grpcBeforeInvokeInfoSummary':
    'Rulează o dată înainte de invocarea apelului. Rescrieți metadatele și mesajul cererii cu interfața API oh; oh.session poartă starea în hook-urile ulterioare ale apelului.',
  'workbench.editors.request.scripts.grpcOnMessageInfoTitle': 'Script la mesaj',
  'workbench.editors.request.scripts.grpcOnMessageInfoSummary':
    'Rulează la fiecare cadru de mesaj capturat de apel, în ambele direcții, după captură. Citiți mesajul decodat; captura nu este întârziată niciodată.',
  'workbench.editors.request.scripts.grpcAfterResponseInfoTitle': 'Script după răspuns',
  'workbench.editors.request.scripts.grpcAfterResponseInfoSummary':
    'Rulează o dată la încheierea apelului. Citiți starea, antetele, trailerele și mesajele; rezultatele verificărilor ajung în panoul de răspuns.',
  'workbench.editors.request.scripts.wsBeforeConnectInfoTitle': 'Script înainte de conectare',
  'workbench.editors.request.scripts.wsBeforeConnectInfoSummary':
    'Rulează la fiecare stabilire a conexiunii, inclusiv la reconectări. Rescrieți adresa URL, antetele, parametrii și subprotocoalele cu interfața API oh; o eroare este înregistrată, iar conexiunea continuă neschimbată.',
  'workbench.editors.request.scripts.wsBeforeSendInfoTitle': 'Script înainte de trimitere',
  'workbench.editors.request.scripts.wsBeforeSendInfoSummary':
    'Rulează înaintea fiecărui mesaj pe care îl trimiteți. Rescrieți sau eliminați mesajul de ieșire; cadrele heartbeat și de protocol nu trec niciodată pe aici.',
  'workbench.editors.request.scripts.wsOnMessageInfoTitle': 'Script la mesaj',
  'workbench.editors.request.scripts.wsOnMessageInfoSummary':
    'Rulează la fiecare mesaj primit, după captură. Reacționați la el: răspundeți cu oh.send, păstrați starea în oh.session, înregistrați verificări.',
  'workbench.editors.request.scripts.wsAfterCloseInfoTitle': 'Script după închidere',
  'workbench.editors.request.scripts.wsAfterCloseInfoSummary':
    'Rulează o dată la încheierea sesiunii, după ce s-a deschis. Citiți înregistrarea de închidere și contoarele sesiunii; rezultatele verificărilor ajung în panoul sesiunii.',
  'workbench.editors.request.scripts.mqttBeforeConnectInfoTitle': 'Script înainte de conectare',
  'workbench.editors.request.scripts.mqttBeforeConnectInfoSummary':
    'Rulează la fiecare stabilire a conexiunii, inclusiv la reconectări. Rescrieți id-ul de client, acreditările, ultima dorință și abonările cu interfața API oh; o eroare este înregistrată, iar conexiunea continuă neschimbată.',
  'workbench.editors.request.scripts.mqttBeforePublishInfoTitle': 'Script înainte de publicare',
  'workbench.editors.request.scripts.mqttBeforePublishInfoSummary':
    'Rulează înaintea fiecărui mesaj pe care îl publicați. Rescrieți subiectul, conținutul util, QoS, indicatorul retain și proprietățile sau eliminați publicarea.',
  'workbench.editors.request.scripts.mqttOnMessageInfoTitle': 'Script la mesaj',
  'workbench.editors.request.scripts.mqttOnMessageInfoSummary':
    'Rulează la fiecare mesaj primit, după captură. Reacționați la el: răspundeți cu oh.publish, păstrați starea în oh.session, înregistrați verificări.',
  'workbench.editors.request.scripts.mqttAfterCloseInfoTitle': 'Script după închidere',
  'workbench.editors.request.scripts.mqttAfterCloseInfoSummary':
    'Rulează o dată la încheierea sesiunii, după ce s-a deschis. Citiți înregistrarea de final, pachetul CONNACK și contoarele sesiunii; rezultatele verificărilor ajung în panoul sesiunii.',
  'workbench.editors.request.scripts.apiConnect':
    'conexiunea așa cum a fost compusă — adresa URL, antete, parametri, subprotocoale, încercare',
  'workbench.editors.request.scripts.apiSetSubprotocols': 'înlocuiește oferta de subprotocoale',
  'workbench.editors.request.scripts.apiMessage': 'mesajul — text, tip de cadru, index de captură',
  'workbench.editors.request.scripts.apiSetMessage': 'înlocuiește textul de ieșire',
  'workbench.editors.request.scripts.apiSetEvent': 'redenumește evenimentul Socket.IO',
  'workbench.editors.request.scripts.apiDrop': 'elimină mesajul — nimic nu ajunge pe fir',
  'workbench.editors.request.scripts.apiSend': 'trimite un cadru text în sesiune',
  'workbench.editors.request.scripts.apiSendBinary': 'trimite un cadru binar (base64)',
  'workbench.editors.request.scripts.apiEmit': 'emite un eveniment Socket.IO',
  'workbench.editors.request.scripts.apiClose': 'înregistrarea de final — cod de închidere, motiv, contoare, durată',
  'workbench.editors.request.scripts.apiSession': 'stare partajată de fiecare hook al acestei sesiuni',
  'workbench.editors.request.scripts.apiMqttConnect':
    'pachetul CONNECT așa cum a fost compus — id de client, acreditări, ultima dorință, abonări, proprietăți de utilizator, încercare',
  'workbench.editors.request.scripts.apiSetClientId': 'înlocuiește id-ul de client',
  'workbench.editors.request.scripts.apiSetUsername': 'înlocuiește numele de utilizator',
  'workbench.editors.request.scripts.apiSetPassword': 'înlocuiește parola',
  'workbench.editors.request.scripts.apiSetWill': 'înlocuiește ultima dorință (null nu înregistrează niciuna)',
  'workbench.editors.request.scripts.apiAddSubscription': 'abonează un filtru de subiecte la deschidere',
  'workbench.editors.request.scripts.apiSetUserProperty': 'setează o proprietate de utilizator 5.0',
  'workbench.editors.request.scripts.apiMqttMessage': 'mesajul — subiect, conținut util, QoS, retain, index de captură',
  'workbench.editors.request.scripts.apiSetTopic': 'redirecționează publicarea',
  'workbench.editors.request.scripts.apiSetPayload': 'înlocuiește conținutul util (text sau octeți base64)',
  'workbench.editors.request.scripts.apiSetQos': 'setează QoS',
  'workbench.editors.request.scripts.apiSetRetain': 'setează indicatorul RETAIN',
  'workbench.editors.request.scripts.apiPublish': 'publică un mesaj în sesiune',
  'workbench.editors.request.scripts.apiMqttClose':
    'înregistrarea de final — cum s-a încheiat, pachetul CONNACK, contoare, durată',
  'workbench.editors.request.scripts.apiInvoke':
    'apelul așa cum a fost compus — țintă, metodă, forma apelului, metadate, textul mesajului',
  'workbench.editors.request.scripts.apiSetMetadata': 'setează o pereche de metadate',
  'workbench.editors.request.scripts.apiRemoveMetadata': 'elimină o pereche de metadate',
  'workbench.editors.request.scripts.apiGrpcSetMessage': 'înlocuiește textul mesajului (JSON)',
  'workbench.editors.request.scripts.apiGrpcMessage':
    'cadrul capturat — direcție, tip, mesajul decodat, index de captură',
  'workbench.editors.request.scripts.apiGrpcResponse':
    'înregistrarea de final — stare, metadate, trailere, contoare în ambele direcții, durată',

  // ── Settings tab — wired knobs ─────────────────────────────────────
  'workbench.editors.request.settings.followRedirects': 'Urmărire redirecționări',
  'workbench.editors.request.settings.followRedirectsInfo':
    'Urmărește răspunsurile HTTP 3xx până la ținta lor. Dezactivați pentru a vă opri la redirecționarea în sine — răspunsul apare ca o redirecționare opacă, fără antete sau corp, util pentru a confirma că o redirecționare are loc.',
  'workbench.editors.request.settings.maxRedirects': 'Redirecționări maxime',
  'workbench.editors.request.settings.maxRedirectsInfo':
    'Câte redirecționări poate urmări o trimitere înainte de a eșua cu o eroare care numește limita. Lăsați gol pentru valoarea implicită de 20. Setați 0 pentru a eșua la orice redirecționare.',
  'workbench.editors.request.settings.followOriginalMethod': 'Păstrare metodă HTTP originală',
  'workbench.editors.request.settings.followOriginalMethodInfo':
    'Păstrează metoda și corpul originale când o redirecționare 301, 302 sau 303 ar trece în mod normal cererea la GET. Redirecționările 307 și 308 păstrează metoda oricum.',
  'workbench.editors.request.settings.followAuthHeader': 'Păstrare antet Authorization',
  'workbench.editors.request.settings.followAuthHeaderInfo':
    'Păstrează antetul Authorization când o redirecționare trece la altă origine. În mod normal este eliminat la un salt între origini, astfel încât acreditările să nu ajungă niciodată la o gazdă căreia cererea nu i s-a adresat.',
  'workbench.editors.request.settings.followAuthHeaderWarning':
    'Acreditările ajung la orice gazdă pe care se oprește lanțul de redirecționări. Un răspuns al cărui lanț a traversat efectiv origini este marcat.',
  'workbench.editors.request.settings.sendBrowserCookies': 'Trimitere cookie-uri din browser',
  'workbench.editors.request.settings.sendBrowserCookiesInfo':
    'Atașează la această cerere cookie-urile existente ale browserului pentru site-ul țintă. Dezactivat este implicitul sigur: cererea este trimisă fără cookie-uri, astfel încât rezultatele să nu depindă de starea de conectare a browserului dvs.',
  'workbench.editors.request.settings.sslVerification': 'Verificare certificat SSL',
  'workbench.editors.request.settings.sslVerificationSummary':
    'Verifică certificatul TLS al serverului față de depozitul de autorități de certificare de încredere al runtime-ului — activat implicit.',
  'workbench.editors.request.settings.sslVerificationDescription':
    'O gazdă cu un certificat autosemnat, expirat sau altfel neacceptat eșuează cu o eroare de certificat TLS — dezactivați verificarea pentru a ajunge oricum la ea, de ex. un server de dezvoltare cu certificat autosemnat.',
  'workbench.editors.request.settings.sslVerificationWarning':
    'Trimiterile omit verificarea identității serverului — orice certificat este acceptat, inclusiv cele autosemnate și expirate.',
  'workbench.editors.request.settings.tlsMin': 'Versiune TLS minimă',
  'workbench.editors.request.settings.tlsMinSummary':
    'Cea mai mică versiune a protocolului TLS pe care o poate negocia o trimitere — gol păstrează implicitul runtime-ului, TLS 1.2.',
  'workbench.editors.request.settings.tlsMinDescription':
    'Alegerea 1.0 sau 1.1 coboară pragul minim sub cel implicit pentru a ajunge la servere vechi — un răspuns trimis cu prag coborât este marcat.',
  'workbench.editors.request.settings.tlsMinPlaceholder': '1.2 (implicit)',
  'workbench.editors.request.settings.tlsMinWarning':
    'Trimiterile pot negocia TLS sub 1.2 — versiuni de protocol cu slăbiciuni cunoscute. Răspunsul este marcat.',
  'workbench.editors.request.settings.tlsMax': 'Versiune TLS maximă',
  'workbench.editors.request.settings.tlsMaxSummary':
    'Cea mai mare versiune a protocolului TLS pe care o poate negocia o trimitere — gol păstrează implicitul runtime-ului, TLS 1.3.',
  'workbench.editors.request.settings.tlsMaxDescription':
    'Coborâți-o pentru a verifica cum se comportă un server pe un protocol mai vechi — s-ar putea să fie nevoie să coborâți și minimul, altfel cele două nu se vor suprapune.',
  'workbench.editors.request.settings.tlsVersionsHeading': 'Versiuni',
  'workbench.editors.request.settings.tlsVersionLegacyDesc': 'Veche, slăbiciuni cunoscute — trimiterile sunt marcate.',
  'workbench.editors.request.settings.tlsVersion12Desc': 'Pragul minim implicit.',
  'workbench.editors.request.settings.tlsVersion13Desc': 'Pragul maxim implicit — bunele practici actuale.',
  'workbench.editors.request.settings.tlsMaxPlaceholder': '1.3 (implicit)',
  'workbench.editors.request.settings.tlsCipherSuites': 'Suite de cifrare TLS',
  'workbench.editors.request.settings.tlsCipherSuitesSummary':
    'Suitele de cifrare oferite în timpul handshake-ului TLS, ca o singură listă separată prin două puncte — gol oferă suitele implicite ale runtime-ului.',
  'workbench.editors.request.settings.tlsCipherSuitesDescription':
    'Serverul alege suita dintre cele oferite, în propria ordine de preferință.',
  'workbench.editors.request.settings.tlsCipherSuitesFormatHeading': 'Format',
  'workbench.editors.request.settings.tlsCipherSuitesIanaDesc': 'O suită TLS 1.3 după numele său IANA.',
  'workbench.editors.request.settings.tlsCipherSuitesOpensslDesc':
    'O suită mai veche după numele său OpenSSL — ambele feluri intră în aceeași listă.',
  'workbench.editors.request.settings.tlsCipherSuitesJoinDesc': 'Unește intrările — fără spații.',
  'workbench.editors.request.settings.tlsCipherSuitesPlaceholder': 'Suitele implicite ale runtime-ului',
  'workbench.editors.request.settings.tlsCipherSuitesError':
    'Doar nume de suite OpenSSL separate prin două puncte — fără spații.',
  'workbench.editors.request.settings.tlsCipherSuitesExample':
    'de ex. TLS_AES_256_GCM_SHA384:ECDHE-RSA-AES128-GCM-SHA256',
  'workbench.editors.request.settings.maxRedirectsPlaceholder': '20 de salturi (implicit)',
  'workbench.editors.request.settings.maxRedirectsHops': ({ count }, locale) =>
    plural(locale, Number(count), { one: '{count} salt', few: '{count} salturi', other: '{count} de salturi' }),
  'workbench.editors.request.settings.responseSizeLimitPlaceholder': '2 MB (implicit)',
  'workbench.editors.request.settings.resetToDefault': 'Resetare la implicit',
  'workbench.editors.request.settings.group.redirects': 'Redirecționări',
  'workbench.editors.request.settings.group.tls': 'TLS și încredere',
  'workbench.editors.request.settings.group.connection': 'Conexiune',
  'workbench.editors.request.settings.group.cookies': 'Cookie-uri',
  'workbench.editors.request.settings.group.execution': 'Execuție și limite',
  'workbench.editors.request.settings.groupInfo.connection':
    'Cum ajunge trimiterea la server — protocolul HTTP pe care îl vorbește și calea pe care o urmează: direct, printr-un proxy, către o adresă fixată sau într-un socket local.',
  'workbench.editors.request.settings.groupInfo.tls':
    'În ce are încredere și ce oferă trimiterea la handshake-ul TLS — verificarea certificatului, fereastra de protocol, suitele de cifrare și un certificat de client.',
  'workbench.editors.request.settings.groupInfo.redirects':
    'Ce se întâmplă când serverul răspunde cu o redirecționare — dacă lanțul este urmărit, cât de departe și ce poartă cererile ulterioare.',
  'workbench.editors.request.settings.groupInfo.cookies':
    'Dacă trimiterea poartă cookie-uri — dezactivat implicit, astfel încât rezultatele să nu depindă niciodată de starea de conectare ambientală.',
  'workbench.editors.request.settings.groupInfo.execution':
    'Cum este delimitată rularea în sine — modul scripturilor, bugetul de timp și plafonul dimensiunii răspunsului.',
  'workbench.editors.request.settings.httpVersion': 'Versiune HTTP',
  'workbench.editors.request.settings.httpVersionSummary':
    'Cum vorbește trimiterea HTTP — Auto (implicit) oferă HTTP/2 alături de HTTP/1.1, iar serverul alege.',
  'workbench.editors.request.settings.httpVersionDescription':
    'O versiune fixată pe care serverul nu o poate vorbi eșuează cu o eroare clară, niciodată cu o revenire tăcută. Popover-ul Rețea de pe răspuns arată întotdeauna protocolul negociat efectiv pe fir.',
  'workbench.editors.request.settings.httpVersionValuesHeading': 'Valori',
  'workbench.editors.request.settings.httpVersionAutoDesc':
    'Oferă HTTP/2 + HTTP/1.1 în timpul handshake-ului TLS, iar serverul alege — http:// simplu rămâne HTTP/1.1.',
  'workbench.editors.request.settings.httpVersion11Desc': 'Fixează semantica HTTP/1.1 clasică.',
  'workbench.editors.request.settings.httpVersion2Desc': 'Fixează HTTP/2 prin oferta de la handshake.',
  'workbench.editors.request.settings.httpVersionPkDesc':
    'Vorbește HTTP/2 imediat, fără negociere — calea pentru serverele HTTP/2 în text clar.',
  'workbench.editors.request.settings.httpVersion3Desc':
    'Stabilește conexiunea cu serverul direct prin QUIC, fără revenire la TCP.',
  'workbench.editors.request.settings.exampleCaption': 'Exemplu de trimitere',
  'workbench.editors.request.settings.httpVersionPlaceholder': 'Auto — serverul alege',
  'workbench.editors.request.settings.httpVersionPriorKnowledge': 'HTTP/2 (prior knowledge)',
  'workbench.editors.request.settings.resolveToAddress': 'Rezolvare la adresa',
  'workbench.editors.request.settings.resolveToAddressInfo':
    'Trimite această cerere la o anumită adresă de server în locul celei pe care o răspunde DNS — numele de gazdă din adresa URL este folosit în continuare pentru TLS și antetul Host, deci cu verificarea activată certificatul trebuie să i se potrivească în continuare. Util pentru a testa un anumit backend din spatele unui echilibrator de sarcină. Adresa URL își păstrează propriul port, iar o redirecționare către altă gazdă ajunge tot la această adresă. Lăsați gol pentru a rezolva prin DNS ca de obicei.',
  'workbench.editors.request.settings.resolveToAddressPlaceholder': 'DNS de sistem',
  'workbench.editors.request.settings.resolveToAddressError':
    'Doar adresă IPv4 sau IPv6 — fără nume de gazdă, fără port.',
  'workbench.editors.request.settings.resolveToAddressExample': 'de ex. 10.0.0.12 sau 2001:db8::1',
  'workbench.editors.request.settings.sni': 'Nume de server SNI',
  'workbench.editors.request.settings.sniInfo':
    'Numele de server prezentat la handshake-ul TLS în locul gazdei din adresa URL — un gateway care servește multe nume de gazdă pe o singură adresă sau un certificat emis pentru un nume pe care DNS nu îl răspunde. Gol trimite gazda din adresa URL.',
  'workbench.editors.request.settings.sniPlaceholder': 'Auto — gazda din adresa URL',
  'workbench.editors.request.settings.sniExample': 'de ex. api.openheaders.com',
  'workbench.editors.request.settings.clientCertificate': 'Certificat de client (mTLS)',
  'workbench.editors.request.settings.clientCertificateInfo':
    'Prezintă un certificat de client la handshake-ul TLS — TLS reciproc (mTLS) — pentru interfețele API din spatele gateway-urilor cu TLS reciproc, care autentifică apelantul după certificat. Alegeți o intrare de certificat din vault — cererea salvează doar numele intrării, iar fiecare dispozitiv prezintă propria intrare din vault cu acel nume; certificatul și cheia nu părăsesc niciodată vault. Lăsați gol pentru a vă conecta fără certificat de client.',
  'workbench.editors.request.settings.clientCertificatePlaceholder': 'Fără certificat de client',
  'workbench.editors.request.settings.clientCertificateEmpty':
    'Nicio intrare de certificat de client în vault de pe acest dispozitiv încă.',
  'workbench.editors.request.settings.vaultManageCertificates': 'Gestionare certificate în vault',
  'workbench.editors.request.settings.clientCertificateDangling':
    'Nicio intrare de certificat din vault numită „{name}” pe acest dispozitiv — trimiterile vor eșua până când intrarea există sau această setare este golită.',
  'workbench.editors.request.settings.proxy': 'Proxy',
  'workbench.editors.request.settings.proxySummary':
    'Cum ajunge această trimitere în rețea. Implicit moștenește configurația de sistem a dispozitivului care o execută — setările de proxy de sistem, PAC sau variabilele de mediu pentru proxy — astfel încât proxy-ul impus pe un computer de companie pur și simplu funcționează; Direct scoate această cerere de sub orice proxy ambiental, iar Adresă URL personalizată o direcționează printr-un proxy propriu.',
  'workbench.editors.request.settings.proxyDescription':
    'Metadatele răspunsului înregistrează întotdeauna calea pe care a urmat-o efectiv trimiterea — ce proxy și dacă a decis cererea sau sistemul. Sunt acceptate proxy-uri HTTP(S) și SOCKS5 — o adresă URL socks5:// funcționează ca proxy personalizat și ca răspuns al sistemului; doar familia SOCKS4 primește o eroare clară care o numește.',
  'workbench.editors.request.settings.proxyModesHeading': 'Moduri',
  'workbench.editors.request.settings.proxyModePlaceholder': 'Moștenire — sistemul decide',
  'workbench.editors.request.settings.proxyModeDirect': 'Direct — fără proxy',
  'workbench.editors.request.settings.proxyModeCustom': 'Adresă URL personalizată',
  'workbench.editors.request.settings.proxyModeInheritDesc':
    'Sistemul dispozitivului care execută decide per adresă URL — un proxy acolo unde computerul este configurat pentru unul, direct în rest. Un proxy moștenit se retrage pentru trimiterile care fixează HTTP/3, folosesc un socket local sau se rezolvă la o adresă fixă.',
  'workbench.editors.request.settings.proxyModeDirectDesc':
    'Niciodată un proxy pentru această cerere, indiferent ce spun setările de sistem ale computerului.',
  'workbench.editors.request.settings.proxyModeCustomDesc':
    'Tunel prin adresa URL de proxy proprie a acestei cereri — sincronizată cu cererea, aceeași cale pe fiecare dispozitiv.',
  'workbench.editors.request.settings.proxyUrl': 'Adresă URL proxy',
  'workbench.editors.request.settings.proxyUrlInfo':
    'Direcționează această cerere prin acest proxy HTTP(S). Conexiunea către țintă trece prin tunel prin proxy, astfel încât un schimb https rămâne criptat de la un capăt la altul, iar verificarea certificatului rulează în continuare față de țintă. Acreditările intră în setarea „Acreditări proxy” de mai jos, niciodată în această adresă URL.',
  'workbench.editors.request.settings.proxyUrlPlaceholder': 'http://proxy.example:8080',
  'workbench.editors.request.settings.proxyUrlMissing':
    'Modul Adresă URL personalizată are nevoie de o adresă URL de proxy — introduceți una sau schimbați modul înapoi.',
  'workbench.editors.request.settings.proxyError':
    'Doar adresă URL http://, https:// sau socks5:// cu gazdă și port — fără acreditări în adresa URL.',
  'workbench.editors.request.settings.proxyUrlExample': 'de ex. http://127.0.0.1:8080 sau socks5://127.0.0.1:1080',
  'workbench.editors.request.settings.proxyResolveConflict':
    'Setează și rezolvarea la adresă, dar un proxy rezolvă singur numele de gazdă — trimiterile vor eșua până când una dintre cele două este golită.',
  'workbench.editors.request.settings.proxyCredentials': 'Acreditări proxy',
  'workbench.editors.request.settings.proxyCredentialsInfo':
    'Autentifică față de proxy cu acreditări din vault, ca utilizator:parolă într-o intrare de tip șir. Cererea salvează doar numele intrării, iar fiecare dispozitiv îl rezolvă față de propriul vault local — acreditările nu părăsesc niciodată vault și sunt trimise doar proxy-ului, niciodată țintei. Lăsați gol pentru un proxy care nu are nevoie de autentificare.',
  'workbench.editors.request.settings.proxyCredentialsPlaceholder': 'Fără autentificare',
  'workbench.editors.request.settings.proxyCredentialsEmpty':
    'Nicio intrare de tip șir în vault de pe acest dispozitiv încă.',
  'workbench.editors.request.settings.vaultManageCredentials': 'Gestionare acreditări în vault',
  'workbench.editors.request.settings.proxyCredentialsDangling':
    'Nicio intrare de tip șir din vault numită „{name}” pe acest dispozitiv — trimiterile vor eșua până când intrarea există sau această setare este golită.',
  // ── Session resilience block (WebSocket / Socket.IO / MQTT) ─────────
  'workbench.editors.request.settings.autoReconnect': 'Reconectare automată',
  'workbench.editors.request.settings.autoReconnectInfo':
    'Redeschide sesiunea când o conexiune deschisă cade — un socket întrerupt, o închidere de la server, timpul de așteptare inactiv — reîncercând conexiunea la perioada de reconectare până se deschide din nou sau până vă deconectați. O primă conectare care eșuează nu se reîncearcă niciodată. Dezactivat implicit.',
  'workbench.editors.request.settings.reconnectPeriod': 'Perioadă de reconectare',
  'workbench.editors.request.settings.reconnectPeriodInfo':
    'Așteptarea între încercările de reconectare. Gol folosește implicitul de 5 s.',
  'workbench.editors.request.settings.reconnectPeriodPlaceholder': '5 s (implicit)',
  'workbench.editors.request.settings.reconnectMaxAttempts': 'Încercări de reconectare',
  'workbench.editors.request.settings.reconnectMaxAttemptsInfo':
    'Plafonul încercărilor consecutive de reconectare după o cădere — o reconectare reușită resetează contorul; un plafon epuizat încheie sesiunea cu Reconectarea a renunțat. Gol încearcă până când serverul revine sau până vă deconectați.',
  'workbench.editors.request.settings.reconnectMaxAttemptsPlaceholder': 'Nelimitat (implicit)',
  'workbench.editors.request.settings.reconnectBackoff': 'Backoff exponențial',
  'workbench.editors.request.settings.reconnectBackoffInfo':
    'Dublează așteptarea după fiecare încercare eșuată — perioada, apoi 2×, 4× … până la 60 s — cu puțin jitter aleatoriu, astfel încât clienții să nu reîncerce niciodată în același ritm. Activat implicit; dezactivat așteaptă exact perioada de fiecare dată.',
  'workbench.editors.request.settings.idleTimeout': 'Timp de așteptare inactiv',
  'workbench.editors.request.settings.idleTimeoutInfo':
    'Închide conexiunea ca pierdută când nu sosește nimic atât timp — verificarea de viață pe care un client nu o poate face cu un cadru ping. Cu Reconectare automată activată, sesiunea reîncearcă conexiunea. Gol nu setează niciun termen de inactivitate.',
  'workbench.editors.request.settings.idleTimeoutSocketioInfo':
    'Închide conexiunea ca pierdută când nu sosește nimic atât timp. Cu Reconectare automată activată, sesiunea reîncearcă conexiunea. Gol urmează handshake-ul serverului — un ping este așteptat la fiecare pingInterval și poate întârzia cu pingTimeout, regula clientului oficial.',
  'workbench.editors.request.settings.idleTimeoutPlaceholder': 'Dezactivat (implicit)',
  'workbench.editors.request.settings.idleTimeoutSocketioPlaceholder': 'Cadența ping a serverului (implicit)',
  'workbench.editors.request.settings.heartbeatMessage': 'Mesaj heartbeat',
  'workbench.editors.request.settings.heartbeatMessageInfo':
    'Un cadru text trimis la intervalul heartbeat pentru a menține în viață o sesiune inactivă prin echilibratoare de sarcină și proxy-uri — orice așteaptă serverul dvs. Niciunul dintre clienții WebSocket nu poate trimite un cadru ping de protocol, așa că keepalive-ul este un mesaj de aplicație; este capturat ca orice cadru trimis. Șabloanele sunt binevenite. Gol nu trimite niciun heartbeat.',
  'workbench.editors.request.settings.heartbeatMessagePlaceholder': 'Fără heartbeat',
  'workbench.editors.request.settings.heartbeatMessageExample': 'de ex. ping sau {"type":"ping"}',
  'workbench.editors.request.settings.heartbeatInterval': 'Interval heartbeat',
  'workbench.editors.request.settings.heartbeatIntervalInfo':
    'Așteptarea între mesajele heartbeat. Gol folosește implicitul de 30 s — sub tăierea la 60 s de inactivitate aplicată de majoritatea echilibratoarelor de sarcină.',
  'workbench.editors.request.settings.heartbeatIntervalPlaceholder': '30 s (implicit)',
  'workbench.editors.request.settings.unixSocket': 'Socket Unix',
  'workbench.editors.request.settings.unixSocketInfo':
    'Stabilește conexiunea cu acest socket local — o cale absolută de socket Unix sau un named pipe Windows precum \\\\.\\pipe\\name — în loc să deschidă o conexiune TCP, de ex. un daemon Docker sau un serviciu local de dezvoltare care ascultă pe un socket. Gazda din adresa URL nu mai decide unde merge conexiunea, dar antetul Host, numele de server TLS și verificarea certificatului o folosesc în continuare, iar o redirecționare către altă gazdă folosește tot acest socket. Lăsați gol pentru o conexiune TCP normală.',
  'workbench.editors.request.settings.unixSocketPlaceholder': 'Fără socket — conexiune TCP',
  'workbench.editors.request.settings.unixSocketError':
    'Doar cale absolută de socket Unix (/…) sau named pipe Windows (\\\\.\\pipe\\…).',
  'workbench.editors.request.settings.unixSocketProxyConflict':
    'Setează și un proxy, dar un tunel prin proxy nu poate folosi un socket local — trimiterile vor eșua până când una dintre cele două este golită.',
  'workbench.editors.request.settings.unixSocketResolveConflict':
    'Setează și rezolvarea la adresă, dar o conexiune prin socket nu rezolvă niciun nume de gazdă — trimiterile vor eșua până când una dintre cele două este golită.',
  'workbench.editors.request.settings.unixSocketExample': 'de ex. /var/run/docker.sock',
  'workbench.editors.request.settings.cookieJar': 'Utilizare depozit cookie',
  'workbench.editors.request.settings.cookieJarInfo':
    'Stochează răspunsurile Set-Cookie ale acestei cereri în depozitul de cookie-uri propriu al aplicației și atașează automat cookie-urile potrivite — astfel încât o cerere de conectare urmată de un apel autentificat să funcționeze fără a copia manual valorile cookie-urilor. Depozitul stă în memorie per spațiu de lucru, este folosit doar de cererile cu această setare activată, nu se sincronizează niciodată și este golit la închiderea aplicației. Un antet Cookie setat de dvs. are întotdeauna prioritate. Dezactivat este implicitul: nu se atașează cookie-uri, iar răspunsurile Set-Cookie sunt eliminate.',
  'workbench.editors.request.settings.timeout': 'Timp de așteptare cerere',
  'workbench.editors.request.settings.timeoutInfo':
    'Timpul maxim pe care îl poate lua întreaga cerere — conectarea, așteptarea răspunsului și citirea corpului. Când limita expiră, trimiterea este abandonată și eșuează cu o eroare de expirare care o numește. Lăsați gol pentru nicio limită per cerere; se aplică doar timpii de așteptare proprii ai stivei de rețea.',
  'workbench.editors.request.settings.timeoutPlaceholder': 'Fără limită',
  'workbench.editors.request.settings.responseSizeLimit': 'Limită dimensiune răspuns',
  'workbench.editors.request.settings.responseSizeLimitInfo':
    'Dimensiunea maximă a corpului răspunsului citită de pe fir; tot ce depășește este tăiat, iar răspunsul este marcat ca trunchiat. Lăsați gol pentru limita implicită de 2.048 KB (2 MB). Ridicați-o până la 10.240 KB (10 MB) pentru conținut util mai mare sau coborâți-o pentru a testa cum arată un răspuns trunchiat.',

  'workbench.editors.request.settings.maxMessageSize': 'Dimensiune maximă mesaj',
  'workbench.editors.request.settings.maxMessageSizeInfo':
    'Cel mai mare mesaj de intrare pe care îl acceptă sesiunea. Un mesaj peste plafon nu este capturat niciodată: sesiunea se închide cu codul 1009 (Message Too Big), numind ambele dimensiuni, iar reconectarea automată nu o redeschide — clientul a cerut-o. Lăsați gol pentru niciun plafon per cerere; runtime-ul desktop asamblează mesaje de până la 128 MB, browserul nu setează nicio limită.',
  'workbench.editors.request.settings.maxMessageSizePlaceholder': 'Fără limită (implicit)',
  'workbench.editors.request.settings.followRedirectsWsInfo':
    'Urmărește un răspuns 3xx la handshake și stabilește conexiunea cu Location-ul său — forma în care un gateway de autorizare redirecționează upgrade-urile. Dezactivat implicit, regula proprie a standardului WebSocket: un handshake redirecționat eșuează, numind redirecționarea. Se aplică atunci când sesiunea rulează în aplicația desktop sau pe server; browserele nu urmăresc niciodată.',
  'workbench.editors.request.settings.maxRedirectsWsInfo':
    'Câte redirecționări de handshake poate urmări o conectare înainte de a eșua cu o eroare care numește limita. Lăsați gol pentru valoarea implicită de 20.',
  'workbench.editors.request.settings.managed.browserKicker': 'Gestionat de browser',
  'workbench.editors.request.settings.managed.nodeKicker': 'Gestionat de runtime',
  'workbench.editors.request.settings.managed.browserIntro':
    'Fixate de browser pentru fiecare cerere trimisă dintr-o extensie — afișate ca să știți ce nu este negociabil.',
  'workbench.editors.request.settings.managed.nodeIntro':
    'Fixate de runtime-ul de rețea al aplicației pentru fiecare cerere — afișate ca să știți ce nu este negociabil.',
  'workbench.editors.request.settings.managed.hideBrowser': 'Ascundere setări gestionate de browser',
  'workbench.editors.request.settings.managed.hideNode': 'Ascundere setări gestionate de runtime',
  'workbench.editors.request.settings.managed.countBrowser': 'gestionate de browser: {count}',
  'workbench.editors.request.settings.managed.countNode': 'gestionate de runtime: {count}',
  'workbench.editors.request.settings.managed.on': 'Activat',
  'workbench.editors.request.settings.managed.off': 'Dezactivat',
  'workbench.editors.request.settings.managed.auto': 'Auto',
  'workbench.editors.request.settings.managed.policy': 'Politică',
  'workbench.editors.request.settings.managed.browser': 'Browser',
  'workbench.editors.request.settings.managed.browserStore': 'Depozitul browserului',
  'workbench.editors.request.settings.managed.about20': '~20',
  'workbench.editors.request.settings.managed.notSent': 'Netrimis',
  'workbench.editors.request.settings.managed.offered': 'Sugerat',
  'workbench.editors.request.settings.managed.none': 'Niciunul',
  'workbench.editors.request.settings.managed.never': 'Niciodată',
  'workbench.editors.request.settings.managed.websocketOnly': 'Doar WebSocket',
  'workbench.editors.request.settings.managed.http2': 'HTTP/2',
  'workbench.editors.request.settings.managed.compression': 'Compresie',
  'workbench.editors.request.settings.managed.compressionWsDesc':
    'permessage-deflate este oferit la fiecare handshake, iar serverul decide dacă se comprimă cadrele; rândul Conectat arată ce a fost negociat. Oferta nu poate fi reținută per cerere.',
  'workbench.editors.request.settings.managed.compressionGrpcDesc':
    'Mesajele pleacă necomprimate și nu se negociază niciun grpc-encoding; un cadru comprimat de la server este afișat ca fiind comprimat, nu decodat.',
  'workbench.editors.request.settings.managed.transport': 'Transport',
  'workbench.editors.request.settings.managed.transportSocketioDesc':
    'Sesiunea stabilește direct conexiunea prin transportul WebSocket, sărind peste handshake-ul HTTP long-polling cu care începe clientul oficial și de la care face upgrade.',
  'workbench.editors.request.settings.managed.httpVersionGrpcDesc':
    'gRPC circulă doar pe HTTP/2: canalele TLS negociază h2 prin ALPN, canalele în text clar vorbesc h2 cu prior knowledge.',
  'workbench.editors.request.settings.managed.connectionReuse': 'Reutilizarea conexiunii',
  'workbench.editors.request.settings.managed.onePerCall': 'Una per apel',
  'workbench.editors.request.settings.managed.connectionReuseGrpcDesc':
    'Fiecare apel deschide propria conexiune HTTP/2 și o închide la încheierea apelului; nimic nu este grupat sau menținut activ între apeluri, deci un keepalive rulează doar cât timp un apel este deschis.',
  'workbench.editors.request.settings.managed.followRedirectsBrowserDesc':
    'Browserul nu urmărește niciodată un handshake redirecționat; un răspuns 3xx face conexiunea să eșueze. Rulați sesiunea în aplicația desktop sau pe server pentru a urmări redirecționările.',
  'workbench.editors.request.settings.managed.httpVersion': 'Versiune HTTP',
  'workbench.editors.request.settings.managed.httpVersionDesc':
    'Browserul negociază HTTP/1.1, HTTP/2 sau HTTP/3 per conexiune; interfața API fetch nu expune un selector de versiune.',
  'workbench.editors.request.settings.managed.sslVerificationDesc':
    'Certificatele sunt verificate conform politicii browserului. O cerere către o gazdă cu certificat nevalid eșuează; verificarea nu poate fi dezactivată per cerere.',
  'workbench.editors.request.settings.managed.followOriginalMethodDesc':
    'La o redirecționare 301/302/303 browserul trece metodele non-GET la GET conform specificației fetch. 307/308 păstrează întotdeauna metoda.',
  'workbench.editors.request.settings.managed.followAuthHeaderDesc':
    'Browserul elimină antetul Authorization când o redirecționare trece la altă origine; acest comportament de siguranță nu poate fi suprascris.',
  'workbench.editors.request.settings.managed.refererRedirect': 'Eliminare antet Referer la redirecționare',
  'workbench.editors.request.settings.managed.refererRedirectDesc':
    'Tratarea antetului Referer prin redirecționări urmează politica de referrer a browserului pentru contextul extensiei.',
  'workbench.editors.request.settings.managed.strictParser': 'Analizor HTTP strict',
  'workbench.editors.request.settings.managed.strictParserBrowserDesc':
    'Stiva de rețea a browserului respinge întotdeauna antetele de răspuns malformate; nu există un mod permisiv.',
  'workbench.editors.request.settings.managed.strictParserNodeDesc':
    'Analizorul HTTP al runtime-ului respinge antetele de răspuns malformate; nu există un mod permisiv.',
  'workbench.editors.request.settings.managed.encodeUrl': 'Codificare automată a adresei URL',
  'workbench.editors.request.settings.managed.encodeUrlDesc':
    'Calea și interogarea adresei URL sunt codificate procentual de analizorul de adrese URL înainte ca cererea să ajungă pe fir. Tastați secvențe deja codificate pentru a le păstra ca atare.',
  'workbench.editors.request.settings.managed.cipherOrder': 'Ordinea suitelor de cifrare a serverului',
  'workbench.editors.request.settings.managed.cipherOrderDesc':
    'Negocierea cifrurilor TLS aparține browserului; nici lista de suite, nici ordinea nu sunt configurabile.',
  'workbench.editors.request.settings.managed.maxRedirectsDesc':
    'Interfața API fetch plafonează lanțul de redirecționări la aproximativ 20 de salturi. Un plafon per cerere nu poate fi implementat: modul de redirecționare manual returnează un răspuns opac, fără antete de urmărit.',
  'workbench.editors.request.settings.managed.tlsVersions': 'Versiuni de protocol TLS/SSL',
  'workbench.editors.request.settings.managed.tlsVersionsDesc':
    'Versiunile de protocol TLS activate sunt fixate de browser; selecția per cerere nu este expusă.',
  'workbench.editors.request.settings.managed.referer': 'Antet Referer',
  'workbench.editors.request.settings.managed.refererDesc':
    'Runtime-ul nu are context de pagină, deci niciun Referer nu ajunge pe fir dacă nu adăugați dvs. unul ca antet.',
  'workbench.editors.request.settings.managed.scripts': 'Scripturi pre-cerere / post-răspuns',
  'workbench.editors.request.settings.managed.scriptsNotRun': 'Nu rulează aici',
  'workbench.editors.request.settings.managed.scriptsNotRunDesc':
    'Gazda care răspunde la trimiterile acestei suprafețe nu are runtime de scripturi, deci scripturile pre-cerere și post-răspuns sunt omise, iar răspunsul nu poartă rezultate de script.',
  'workbench.editors.request.settings.managed.scriptsSafeForwarded': 'Mod sigur',
  'workbench.editors.request.settings.managed.scriptsSafeForwardedDesc':
    'Trimiterile acestei suprafețe se execută pe backend-ul conectat, care rulează scripturile pre-cerere și post-răspuns în runtime-ul său sigur, izolat în sandbox: doar interfața API de script oh.* — fără sistem de fișiere, fără acces la procese, fără încărcător de module. Trimiterile redirecționate nu rulează niciodată în Mod dezvoltator, iar fiecare rulare înregistrează pe răspuns modul în care s-a executat.',

  // ── Settings tab — script execution chooser (per-workspace,
  //    host-local — never syncs) ───────────────────────────────────────
  'workbench.editors.request.settings.scriptMode': 'Execuția scripturilor',
  'workbench.editors.request.settings.scriptModeSummary':
    'Cum rulează pe acest dispozitiv scripturile pre-cerere și post-răspuns din acest spațiu de lucru.',
  'workbench.editors.request.settings.scriptModeDescription':
    'Alegerea se aplică fiecărei cereri din spațiul de lucru, rămâne pe acest dispozitiv și nu se sincronizează niciodată — fiecare rulare înregistrează pe răspuns modul în care s-a executat.',
  'workbench.editors.request.settings.scriptModeModesHeading': 'Moduri',
  'workbench.editors.request.settings.scriptModeSafe': 'Mod sigur',
  'workbench.editors.request.settings.scriptModeDeveloper': 'Mod dezvoltator',
  'workbench.editors.request.settings.scriptModeWarning':
    'Modul dezvoltator rulează scripturile acestui spațiu de lucru cu acces deplin la sistem — sistem de fișiere, procese și rețea. Activați-l doar dacă aveți încredere în toți cei care pot edita scripturile acestui spațiu de lucru. Pașii fluxurilor de lucru și cererile redirecționate de alte dispozitive rulează în continuare în Mod sigur.',

  // ── Request editor — script-mode tag (tab-bar chip + chooser popover;
  //    same per-workspace host-local slot as the Settings row) ─────────
  'workbench.editors.request.settings.scriptModeTagAria': 'Execuția scripturilor: {mode}',
  'workbench.editors.request.settings.scriptModeRecommended': 'Recomandat',
  'workbench.editors.request.settings.scriptModeSafeCard':
    'Scripturile rulează în runtime-ul de scripturi al aplicației, izolat în sandbox — doar interfața API de script oh.*, fără acces la sistemul de fișiere sau la procese și fără încărcător de module.',
  'workbench.editors.request.settings.scriptModeDeveloperCard':
    'Scripturile rulează într-un runtime Node.js complet — require, sistem de fișiere, procese și acces la rețea.',
  'workbench.editors.request.settings.scriptModeDeveloperTrust':
    'Folosiți doar dacă aveți încredere în toți cei care pot edita scripturile acestui spațiu de lucru',
  'workbench.editors.request.settings.scriptModeScopeNote':
    'Se aplică fiecărei cereri din acest spațiu de lucru, doar pe acest dispozitiv — alegerea nu se sincronizează niciodată.',

  // ── Settings tab — cookie jar row ──────────────────────────────────
  'workbench.editors.request.settings.jar.count': ({ count }, locale) =>
    plural(locale, Number(count), {
      one: '{count} cookie în depozitul acestui spațiu de lucru',
      few: '{count} cookie-uri în depozitul acestui spațiu de lucru',
      other: '{count} de cookie-uri în depozitul acestui spațiu de lucru',
    }),
  'workbench.editors.request.settings.jar.infoTitle': 'Conținutul depozitului Cookie',
  'workbench.editors.request.settings.jar.infoSummary':
    'Cookie-urile deținute în prezent de depozitul din memorie al acestui spațiu de lucru — stocate de trimiterile cu depozitul activat, atașate trimiterilor cu depozitul activat care se potrivesc și dispărute la închiderea aplicației. Valorile sunt acreditări de sesiune și rămân în runtime-ul de rețea al aplicației; se afișează doar numele, sfera și expirarea.',
  'workbench.editors.request.settings.jar.storedHeading': 'Cookie-uri stocate',
  'workbench.editors.request.settings.jar.clear': 'Golire',
  'workbench.editors.request.settings.jar.delete': 'Ștergere {name}',
  'workbench.editors.request.settings.jar.expires': 'expiră {date}',
  'workbench.editors.request.settings.jar.session': 'sesiune',
  'workbench.editors.request.settings.jar.httpsOnly': 'doar https',

  // ── Response panel shell (status/duration/size VALUES stay raw —
  //    parity vocabulary and diagnostic measurement, plan §3) ─────────
  'workbench.editors.request.response.title': 'Răspuns',
  'workbench.editors.request.response.clear': 'Golire',
  'workbench.editors.request.response.saveResponse': 'Salvare răspuns',
  'workbench.editors.request.response.createWorkflow': 'Creare flux de lucru',
  'workbench.editors.request.response.createWorkflowNew': 'Creare flux de lucru nou',
  'workbench.editors.request.response.createWorkflowAttach': 'Legare de un flux de lucru existent',
  'workbench.editors.request.response.createWorkflowNeedsSave':
    'Această cerere nu este salvată — salvați-o mai întâi pentru a o folosi într-un flux de lucru',
  'workbench.editors.request.response.copyBody': 'Copiere corp',
  'workbench.editors.request.response.saveBodyToFile': 'Salvare corp în fișier',
  'workbench.editors.request.response.saveBodyToFileTruncated':
    'Salvare corp în fișier (trunchiat — salvează ce a fost păstrat)',
  'workbench.editors.request.response.clearResponse': 'Golire răspuns',
  'workbench.editors.request.response.moreActionsAria': 'Mai multe acțiuni pentru răspuns',
  'workbench.editors.request.response.copied': 'Copiat',
  // View-tab nouns are DevTools parity vocabulary — keyed for uniform
  // lookup, glossary-protected on translator handoff (S4 precedent).
  'workbench.editors.request.response.tab.body': 'Corp',
  'workbench.editors.request.response.tab.headers': 'Antete ({count})',
  'workbench.editors.request.response.tab.cookies': 'Cookie-uri ({count})',
  'workbench.editors.request.response.tab.assertions': 'Verificări',
  'workbench.editors.request.response.tab.assertionsFailed': 'Verificări (eșuate: {count})',
  'workbench.editors.request.response.tab.assertionsPassed': 'Verificări (trecute: {count})',
  'workbench.editors.request.response.tab.console': 'Consolă ({count})',

  // ── Response meta strip (values raw; chip labels + popovers keyed) ──
  'workbench.editors.request.response.meta.kicker': 'Metadatele răspunsului',
  'workbench.editors.request.response.meta.timingTitle': 'Timp',
  'workbench.editors.request.response.meta.timingSummary': 'Măsurat în jurul apelului fetch: {duration}.',
  'workbench.editors.request.response.meta.timingNoEntry':
    'Platforma nu a înregistrat nicio intrare de resource-timing pentru această cerere, deci nu este disponibilă nicio defalcare pe faze.',
  'workbench.editors.request.response.meta.timingTotalOnly':
    'Total rețea {duration}. Serverul nu a expus detalii de timp acestei cereri între origini (niciun antet Timing-Allow-Origin), deci fazele DNS / conectare / TTFB / descărcare sunt ascunse.',
  // Phase-ladder labels — devtools waterfall parity vocabulary,
  // glossary-protected on translator handoff.
  'workbench.editors.request.response.meta.phase.redirect': 'Redirecționări',
  'workbench.editors.request.response.meta.phase.stalled': 'Blocat',
  'workbench.editors.request.response.meta.phase.dns': 'Interogare DNS',
  'workbench.editors.request.response.meta.phase.connect': 'Conexiune TCP',
  'workbench.editors.request.response.meta.phase.tls': 'Handshake TLS',
  'workbench.editors.request.response.meta.phase.waiting': 'Așteptare (TTFB)',
  'workbench.editors.request.response.meta.phase.download': 'Descărcare conținut',
  'workbench.editors.request.response.meta.totalNetwork': 'Total (rețea)',
  'workbench.editors.request.response.meta.noteNodePhaseLegs':
    'DNS, conectarea și TLS nu sunt observabile per trimitere din runtime-ul de rețea al aplicației — sunt incluse în Așteptare.',
  'workbench.editors.request.response.meta.sizeTitle': 'Dimensiune',
  'workbench.editors.request.response.meta.sizeSummary': 'Octeții în fiecare direcție a acestui schimb.',
  'workbench.editors.request.response.meta.responseSize': 'Dimensiune răspuns',
  'workbench.editors.request.response.meta.requestSize': 'Dimensiune cerere',
  'workbench.editors.request.response.meta.rowHeaders': 'Antete',
  'workbench.editors.request.response.meta.rowBody': 'Corp',
  'workbench.editors.request.response.meta.rowCompressed': 'Comprimat',
  'workbench.editors.request.response.meta.rowTransferred': 'Transferat',
  'workbench.editors.request.response.meta.noteHeaderBytes':
    'Octeții antetelor așa cum sunt vizibili — HTTP/2+ îi comprimă pe fir.',
  'workbench.editors.request.response.meta.noteRequestHeaders':
    'Antetele cererii numără doar ce a setat această trimitere; browserul le adaugă pe ale sale (Host, User-Agent, …).',
  'workbench.editors.request.response.meta.noteRequestHeadersNode':
    'Antetele cererii numără doar ce a setat această trimitere; runtime-ul le adaugă pe ale sale (Host, Accept-Encoding, …).',
  'workbench.editors.request.response.meta.noteTruncatedAtCap':
    'Corp trunchiat la limita de dimensiune a răspunsului de {cap}; dimensiunea completă este numărată.',
  'workbench.editors.request.response.meta.noteTruncated':
    'Vizualizarea corpului este trunchiată; dimensiunea completă este numărată.',
  'workbench.editors.request.response.meta.noteBodyApproximate':
    'Dimensiunea corpului cererii este aproximativă — boundary-ul multipart este generat de browser.',
  'workbench.editors.request.response.meta.noteWireHidden':
    'Dimensiunile de pe fir (comprimat, transferat) sunt ascunse: serverul nu a trimis Timing-Allow-Origin.',
  'workbench.editors.request.response.meta.networkTitle': 'Rețea',
  'workbench.editors.request.response.meta.networkSummary': 'Date la nivel de conexiune pentru acest schimb.',
  'workbench.editors.request.response.meta.httpVersion': 'Versiune HTTP',
  'workbench.editors.request.response.meta.localAddress': 'Adresă locală',
  'workbench.editors.request.response.meta.remoteAddress': 'Adresă la distanță',
  'workbench.editors.request.response.meta.noteVersionHiddenNode':
    'Versiunea HTTP este ascunsă: protocolul negociat nu a fost observabil pentru această trimitere (trimiterile prin proxy negociază în interiorul tunelului).',
  'workbench.editors.request.response.meta.noteVersionHiddenBrowser':
    'Versiunea HTTP este ascunsă: platforma nu a înregistrat nicio intrare de timp pentru această cerere.',
  'workbench.editors.request.response.meta.noteNoIp':
    'Adresa la distanță nu este disponibilă: captura de pe fir nu a văzut nimic pentru acest fetch.',
  'workbench.editors.request.response.meta.tlsProtocol': 'Protocol TLS',
  'workbench.editors.request.response.meta.tlsCipher': 'Nume cifru',
  'workbench.editors.request.response.meta.tlsCertificate': 'CN certificat',
  'workbench.editors.request.response.meta.tlsIssuer': 'CN emitent',
  'workbench.editors.request.response.meta.tlsValidUntil': 'Valid până la',
  'workbench.editors.request.response.meta.tlsUnverifiedVerdict': 'Certificat neverificat ({code})',
  'workbench.editors.request.response.meta.trustPinned':
    'Certificat fixat pe acest dispozitiv — trimiteți din nou pentru verificare.',
  'workbench.editors.request.response.meta.noteNoTls':
    'Adresa locală, detaliile TLS și ale certificatului nu sunt expuse codului extensiei pe Chromium.',
  'workbench.editors.request.response.meta.tlsSelfSigned': 'Certificat autosemnat',
  'workbench.editors.request.response.meta.tlsUnverified': 'Certificat neverificat',
  'workbench.editors.request.response.meta.tlsFloorLowered': 'Prag TLS coborât',
  'workbench.editors.request.response.meta.tlsFloorLoweredSummary':
    'Această cerere a fost trimisă cu versiunea TLS minimă setată sub 1.2 în fila sa Setări, deci conexiunii i s-a permis să negocieze TLS 1.0 sau 1.1 — versiuni de protocol cu slăbiciuni cunoscute, pe care runtime-urile le dezactivează implicit.',
  'workbench.editors.request.response.meta.authForwarded': 'Authorization retrimis',
  'workbench.editors.request.response.meta.authForwardedSummary':
    'O redirecționare a dus această cerere la altă origine, iar fila sa Setări păstrează antetul Authorization între origini — deci acreditările au fost retrimise noii gazde. În mod normal antetul este eliminat când o redirecționare părăsește originea inițială.',
  'workbench.editors.request.response.meta.authTitle': 'Autorizare',
  'workbench.editors.request.response.meta.authSummaryRequest': 'Trimisă cu configurația {type} proprie a cererii.',
  'workbench.editors.request.response.meta.authSummaryInherited': '{type} — moștenit de la {source}.',
  'workbench.editors.request.response.meta.authSummaryNone':
    'Trimisă fără autorizare — nimic nu este setat deasupra cererii.',
  'workbench.editors.request.response.meta.authDangling':
    'Intrarea aleasă de cerere nu mai există — s-a aplicat în schimb cea implicită.',
  // The Inherited settings tag — the knobs the run took from the
  // levels above the request, each listed against its source.
  'workbench.editors.request.response.meta.inheritedSettingsTag': 'Setări moștenite · {count}',
  'workbench.editors.request.response.meta.inheritedSettingsTitle': 'Setări moștenite',
  'workbench.editors.request.response.meta.inheritedSettingsSummary':
    'Setările pe care rularea le-a luat din colecția sau folderul de deasupra cererii — rezolvate așa cum le arată fila sa Setări, valorile proprii ale cererii având prioritate față de lanț.',
  'workbench.editors.request.response.meta.inheritedSettingsHeading': 'Setare · sursă',
  'workbench.editors.request.response.meta.scriptsTag': 'Scripturi · {count}',
  'workbench.editors.request.response.meta.scriptsTitle': 'Lanț de scripturi',
  'workbench.editors.request.response.meta.scriptsSummary':
    'Fiecare nivel al lanțului a rulat și a reușit — scripturile colecției și ale folderului înaintea celor proprii ale cererii, pre-cerere și post-răspuns deopotrivă. Înregistrat din ce a făcut efectiv rularea.',
  'workbench.editors.request.response.meta.scriptsSummaryFailed':
    'Un nivel al lanțului a eșuat — rândurile de mai jos numesc care și de ce.',
  'workbench.editors.request.response.meta.scriptsLevelRequest': 'Cerere',
  'workbench.editors.request.response.meta.scriptsDuration': '{ms} ms',
  'workbench.editors.request.response.meta.executedOnTag': 'Trimis de la {name}',
  'workbench.editors.request.response.meta.executedOnTitle': 'Executat pe backend-ul conectat',
  'workbench.editors.request.response.meta.executedOnSummary':
    'Această cerere a fost trimisă de „{name}” — backend-ul la care este conectată această suprafață — nu de pe acest dispozitiv. Serverul țintă a văzut adresa IP și locația de rețea ale acelui computer, deci comportamentul bazat pe geolocație sau IP reflectă locul în care rulează backend-ul. Înregistrat pe această rulare de gazda care a executat-o.',
  'workbench.editors.request.response.meta.cookieJar': 'Depozit Cookie',
  'workbench.editors.request.response.meta.cookieJarSummary':
    'Această cerere a folosit depozitul de cookie-uri din memorie al spațiului de lucru: cookie-urile stocate potrivite au fost atașate automat, iar răspunsurile Set-Cookie au fost păstrate pentru trimiterile ulterioare cu depozitul activat.',
  'workbench.editors.request.response.meta.jarAttachedLabel': 'Atașate la prima cerere',
  'workbench.editors.request.response.meta.jarAttachedNone':
    'Nimic — niciun cookie stocat nu s-a potrivit sau un antet Cookie setat pe cerere a avut prioritate.',
  'workbench.editors.request.response.meta.jarStoredLabel': 'Stocate din răspunsurile Set-Cookie',
  'workbench.editors.request.response.meta.jarStoredNone': 'Nimic — niciun răspuns nu a setat un cookie.',
  'workbench.editors.request.response.meta.proxyTag': 'Prin proxy',
  'workbench.editors.request.response.meta.proxyTitle': 'Calea prin proxy',
  'workbench.editors.request.response.meta.proxySummaryRequest':
    'Această rulare a trecut prin tunel prin proxy-ul setat în propriile setări ale cererii — înregistrat din ce a făcut efectiv trimiterea.',
  'workbench.editors.request.response.meta.proxySummarySystem':
    'Această rulare a trecut prin tunel prin proxy-ul numit de sistemul dispozitivului care o execută — înregistrat din ce a făcut efectiv rularea, niciodată o citire live a setărilor.',
  'workbench.editors.request.response.meta.proxyRowUrl': 'Proxy',
  'workbench.editors.request.response.meta.proxyRowSource': 'Decis de',
  'workbench.editors.request.response.meta.proxySourceRequest': 'Setările cererii',
  'workbench.editors.request.response.meta.proxySourceDevice': 'Setările de proxy ale dispozitivului',
  'workbench.editors.request.response.meta.proxySourceEnv': 'Variabile de mediu',
  'workbench.editors.request.response.meta.proxySourceSystem': 'Setările de proxy de sistem',
  'workbench.editors.request.response.meta.proxySourceManual': 'Configurare manuală a proxy-ului',
  'workbench.editors.request.response.meta.proxySourcePac': 'Script PAC',
  'workbench.editors.request.response.meta.proxyStandDownTag': 'Proxy ocolit',
  'workbench.editors.request.response.meta.proxyStandDownTitle': 'Proxy-ul de sistem s-a retras',
  'workbench.editors.request.response.meta.proxyStandDownUnixSocket':
    'Sistemul numește un proxy, dar această rulare vizează un socket local pe care un tunel prin proxy nu îl poate folosi — a continuat direct.',
  'workbench.editors.request.response.meta.proxyStandDownResolveToAddress':
    'Sistemul numește un proxy, dar această rulare își fixează propria rezolvare a adresei, pe care un proxy ar suprascrie-o — a continuat direct.',
  'workbench.editors.request.response.meta.proxyStandDownHttpVersion3':
    'Sistemul numește un proxy, dar această rulare este fixată pe HTTP/3, care își stabilește propria cale QUIC — a continuat direct.',
  'workbench.editors.request.response.meta.redirects': ({ count }, locale) =>
    plural(locale, Number(count), {
      one: '{count} redirecționare',
      few: '{count} redirecționări',
      other: '{count} de redirecționări',
    }),
  'workbench.editors.request.response.meta.redirectsTitle': 'Lanț de redirecționări',
  'workbench.editors.request.response.meta.redirectsSummary':
    'Salturile pe care le-a urmat această cerere înaintea răspunsului final — fiecare arată cererea trimisă și redirecționarea cu care i s-a răspuns, înregistrate la rularea trimiterii.',
  'workbench.editors.request.response.meta.redirectMethodChanged':
    'Metoda schimbată în {method} pentru cererea următoare',
  'workbench.editors.request.response.meta.redirectAuthStripped':
    'Antetul Authorization eliminat — cererea următoare a trecut la altă origine',
  'workbench.editors.request.response.meta.redirectAuthForwarded':
    'Antetul Authorization retrimis între origini — păstrat de fila Setări a acestei cereri',
  'workbench.editors.request.response.meta.redirectFinal': 'Răspuns final',
  'workbench.editors.request.response.meta.streamedEnd': 'Flux încheiat',
  'workbench.editors.request.response.meta.streamedStop': 'Oprit',
  'workbench.editors.request.response.meta.streamedCap': 'Flux trunchiat la limită',
  'workbench.editors.request.response.meta.streamedTimeout': 'Timp de așteptare expirat la mijlocul fluxului',
  'workbench.editors.request.response.meta.streamedError': 'Fluxul a eșuat',
  'workbench.editors.request.response.meta.streamedEndSummary':
    'Acest răspuns a sosit în flux, live, până când serverul a închis fluxul. Corpul de mai jos este captura completă.',
  'workbench.editors.request.response.meta.streamedPartialSummary':
    'Răspunsul era încă în flux când schimbul s-a încheiat, deci corpul de mai jos este captura parțială până în acel moment — tot ce a sosit a fost păstrat.',
  'workbench.editors.request.response.streamReceiving': 'Se primește fluxul — {size}',

  // ── SSE event list (event names like `message`/`comment` are wire
  //    grammar terms and stay untranslated) ────────────────────────────
  'workbench.editors.request.response.sse.connected': 'Conectat la {url}',
  'workbench.editors.request.response.sse.closed': 'Conexiune închisă',
  'workbench.editors.request.response.sse.stopped': 'Conexiune oprită',
  'workbench.editors.request.response.sse.capped': 'Captură trunchiată — limita corpului a fost atinsă',
  'workbench.editors.request.response.sse.timedOut': 'Timpul de așteptare al conexiunii a expirat',
  'workbench.editors.request.response.sse.failed': 'Conexiunea a eșuat',
  'workbench.editors.request.response.sse.searchEvents': 'Căutare evenimente',
  'workbench.editors.request.response.sse.noMatches': 'Niciun eveniment nu se potrivește.',
  'workbench.editors.request.response.sse.waiting': 'Se așteaptă evenimente…',
  'workbench.editors.request.response.sse.eventCount': ({ count }, locale) =>
    plural(locale, Number(count), {
      one: '{count} eveniment',
      few: '{count} evenimente',
      other: '{count} de evenimente',
    }),
  'workbench.editors.request.response.sse.clearEvents': 'Golire evenimente (doar afișarea)',
  'workbench.editors.request.response.sse.newEvents': 'Evenimente noi',
  'workbench.editors.request.response.sse.sortOrder': 'Ordine de sortare',
  'workbench.editors.request.response.sse.newestFirst': 'Cele mai noi primele',
  'workbench.editors.request.response.sse.oldestFirst': 'Cele mai vechi primele',
  'workbench.editors.request.response.sse.groupByName': 'Grupare după numele evenimentului',
  'workbench.editors.request.response.sse.rowsPerGroup': 'Rânduri per grup',
  'workbench.editors.request.response.sse.noLimit': 'Fără limită',
  'workbench.editors.request.response.sse.infoId': 'ID',
  'workbench.editors.request.response.sse.infoSize': 'Dimensiune',
  'workbench.editors.request.response.sse.infoRetry': 'Reîncercare',
  'workbench.editors.request.response.sse.eventInfoAria': 'Detalii eveniment',

  // ── Response body view (filter syntax + format examples stay raw) ──
  'workbench.editors.request.response.body.truncatedNotice': 'Răspuns trunchiat la {cap} (original {size}).',
  'workbench.editors.request.response.body.increaseLimit': 'Mărire limită',
  'workbench.editors.request.response.body.limitHint': 'Limita se poate ajusta în setările Cereri API.',
  'workbench.editors.request.response.body.viewPickerAria': 'Vizualizare corp',
  'workbench.editors.request.response.body.preview': 'Previzualizare',
  'workbench.editors.request.response.body.wrapLines': 'Încadrare linii',
  'workbench.editors.request.response.body.unwrapLines': 'Fără încadrare linii',
  'workbench.editors.request.response.body.renderAnsi': 'Afișare culori ANSI',
  'workbench.editors.request.response.body.plainAnsi': 'Afișare text simplu',
  'workbench.editors.request.response.body.filterJsonPathTooltip': 'Filtrare corp (JSONPath)',
  'workbench.editors.request.response.body.filterXPathTooltip': 'Filtrare corp (XPath)',
  'workbench.editors.request.response.body.filterMetricsTooltip': 'Filtrare corp (familii de metrici)',
  'workbench.editors.request.response.body.filterAria': 'Filtrare corp',
  'workbench.editors.request.response.body.invalidJsonPath': 'Expresie JSONPath nevalidă.',
  'workbench.editors.request.response.body.invalidXPath':
    'Expresie XPath nevalidă sau documentul nu poate fi analizat.',
  'workbench.editors.request.response.body.invalidMetricsFilter': 'Selector de metrici nevalid.',
  'workbench.editors.request.response.body.noMatches': 'Nicio potrivire pentru această cale.',
  'workbench.editors.request.response.body.showingLastMatch': 'Se afișează ultima potrivire.',
  'workbench.editors.request.response.body.hexCapNotice': 'Vizualizarea hex arată primii {shown} din {total}.',
  'workbench.editors.spec.tab': 'Specificație',
  'workbench.editors.spec.noSpecs': 'Nicio specificație {format} în acest spațiu de lucru încă.',
  'workbench.editors.spec.goToSpecs': 'Către specificații',
  'workbench.editors.timelineViewer.format': 'Format mesaj',
  'workbench.editors.timelineViewer.showMessage': 'Afișare mesaj',
  'workbench.editors.timelineViewer.showHexdump': 'Afișare hexdump',
  'workbench.editors.request.response.body.previewIframeTitle': 'Previzualizare răspuns',
  'workbench.editors.request.response.body.pdfPreviewIframeTitle': 'Previzualizare PDF',
  'workbench.editors.request.response.body.imagePreviewAlt': 'Imaginea răspunsului',
  'workbench.editors.request.response.body.imagePreviewFailed':
    'Datele imaginii nu pot fi decodate — vedeți octeții bruți în vizualizarea Hex.',
  'workbench.editors.request.response.body.mediaPreviewAria': 'Previzualizare media',
  'workbench.editors.request.response.body.mediaPreviewFailed':
    'Datele media nu pot fi decodate — vedeți octeții bruți în vizualizarea Hex.',
  'workbench.editors.request.response.body.requestBodyOmittedNotice':
    'Corpul cererii nu a fost trimis — browserul nu poate atașa un corp cererilor GET sau HEAD.',
  'workbench.editors.request.response.body.duplicateJsonKeysNotice':
    'Chei JSON duplicate — se afișează ultima valoare: {keys}',
  'workbench.editors.request.response.body.partialJsonNotice':
    'Corp trunchiat — Previzualizarea și filtrul arată doar valorile capturate complet.',
  'workbench.editors.request.response.body.schemalessDecodeNotice':
    'Decodare fără schemă (cât mai bine posibil) — se afișează numerele câmpurilor; imbricarea și textul sunt deduse din octeții de pe fir.',

  // ── Response headers view ──────────────────────────────────────────
  'workbench.editors.request.response.headers.name': 'Nume',
  'workbench.editors.request.response.headers.value': 'Valoare',
  'workbench.editors.request.response.headers.filterPlaceholder': 'Filtrare antete',
  'workbench.editors.request.response.headers.copyAll': 'Copiere toate antetele',
  'workbench.editors.request.response.headers.copyAria': 'Copiere {name}',
  'workbench.editors.request.response.headers.copyTitle': 'Copiere antet',
  'workbench.editors.request.response.headers.empty': 'Niciun antet',
  'workbench.editors.request.response.headers.noMatch': 'Niciun antet nu se potrivește cu „{query}”',
  'workbench.editors.request.response.headers.trailers': 'Trailere',

  // ── Response cookies view (Set-Cookie attribute column names stay
  //    raw wire vocabulary: Domain / Path / Expires / HttpOnly /
  //    Secure / SameSite) ─────────────────────────────────────────────
  'workbench.editors.request.response.cookies.name': 'Nume',
  'workbench.editors.request.response.cookies.value': 'Valoare',
  'workbench.editors.request.response.cookies.copyAria': 'Copiere Set-Cookie pentru {name}',
  'workbench.editors.request.response.cookies.copyTitle': 'Copiere linie Set-Cookie',
  'workbench.editors.request.response.cookies.noteCredentialsInclude':
    'Această cerere a rulat cu acreditările incluse, deci browserul poate să fi stocat aceste cookie-uri (în funcție de atributele fiecărui cookie) și le va trimite la cererile viitoare cu acreditări.',
  'workbench.editors.request.response.cookies.noteCredentialsOmit':
    'Serverul a trimis aceste cookie-uri, dar această cerere a rulat cu acreditările omise (implicit), deci browserul le-a eliminat — nimic nu a fost stocat.',
  'workbench.editors.request.response.cookies.noteJarOff':
    'Aceste cookie-uri nu au fost stocate — această cerere a rulat fără depozitul de cookie-uri (implicit) sau depozitul nu a acceptat niciunul dintre ele.',
  'workbench.editors.request.response.cookies.noteJarStored':
    'Această cerere a rulat cu depozitul de cookie-uri activat, care a stocat {names} în depozitul din memorie al spațiului de lucru pentru cererile viitoare cu depozitul activat.',
  'workbench.editors.request.response.cookies.noteJarStoredMidChain':
    'Această cerere a rulat cu depozitul de cookie-uri activat, care a stocat {names} în depozitul din memorie al spațiului de lucru pentru cererile viitoare cu depozitul activat. Unele au fost setate la salturi intermediare de redirecționare, deci liniile lor Set-Cookie nu sunt enumerate aici — doar antetele răspunsului final sunt.',

  // ── Response assertions / console views (log levels + script output
  //    stay raw; assertion durations are diagnostic timing — exempt) ──
  'workbench.editors.request.response.assertions.pass': 'TRECUT',
  'workbench.editors.request.response.assertions.fail': 'EȘUAT',
  'workbench.editors.request.response.console.preRequest': 'Înainte de cerere',
  'workbench.editors.request.response.console.postResponse': 'După răspuns',

  // ── Response empty / error states (executor error text stays raw) ──
  'workbench.editors.request.response.empty.sending': 'Se trimite cererea…',
  'workbench.editors.request.response.empty.prompt': 'Trimiteți cererea pentru a vedea răspunsul aici.',
  'workbench.editors.request.response.error.title': 'Cererea nu a putut fi trimisă',
  'workbench.editors.request.response.error.openInTab': 'Deschidere în filă nouă',
  'workbench.editors.request.response.error.trust.title': 'Încredere în certificatul prezentat de {origin}',
  'workbench.editors.request.response.error.trust.probing': 'Se citește certificatul prezentat de server…',
  'workbench.editors.request.response.error.trust.probeFailed':
    'Certificatul serverului nu a putut fi citit: {message}',
  'workbench.editors.request.response.error.trust.retryProbe': 'Reîncercare',
  'workbench.editors.request.response.error.trust.failure': 'Eșec',
  'workbench.editors.request.response.error.trust.noAnchor':
    'Serverul nu își prezintă certificatul rădăcină, deci nimic de aici nu poate fi fixat. Adăugați autoritatea de certificare emitentă în „Setări › Cereri API › TLS”.',
  'workbench.editors.request.response.error.trust.trustOnDevice': 'Încredere pe acest dispozitiv',
  'workbench.editors.request.response.error.trust.addToWorkspace': 'Adăugare în spațiul de lucru',
  'workbench.editors.request.response.error.certSteps.summary':
    'Serverele locale de dezvoltare rulează de obicei cu un certificat autosemnat, pe care trebuie să îl acceptați.',
  'workbench.editors.request.response.error.certSteps.step1': 'Deschideți adresa URL într-o filă nouă',
  'workbench.editors.request.response.error.certSteps.step2': 'Acceptați avertismentul privind certificatul',
  'workbench.editors.request.response.error.certSteps.step2DetailChromium': 'Avansate → Continuă la site (nesigur)',
  'workbench.editors.request.response.error.certSteps.step2DetailFirefox': 'Avansat… → Acceptă riscul și continuă',
  'workbench.editors.request.response.error.certSteps.step3': 'Trimiteți cererea din nou',
  'workbench.editors.request.response.error.certSteps.glyphNewTab': 'filă nouă',
  'workbench.editors.request.response.error.certSteps.glyphAdvanced': 'Avansate',
  'workbench.editors.request.response.error.certSteps.glyphSend': '▶ Trimitere',
  'workbench.editors.request.response.error.certSteps.glyphProceedChromium': 'Continuă la site (nesigur)',
  'workbench.editors.request.response.error.certSteps.glyphProceedFirefox': 'Acceptă riscul și continuă',
} as const satisfies Catalog;
