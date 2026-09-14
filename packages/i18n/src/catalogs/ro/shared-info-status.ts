/**
 * Shared info-popover corpus — HTTP status codes — Romanian. Mirrors
 * `catalogs/en/shared-info-status.ts` key for key; codes, canonical
 * reason phrases and header names (Location, Range, WWW-Authenticate,
 * …) stay raw — only prose translates. Mints: frază-motiv = reason
 * phrase (carried from panel-network); redirecționare = redirection;
 * gateway raw (the ro networking loanword — never poartă; gateway-ul);
 * serverul din amonte = upstream server; limită de rată = rate limit;
 * portal captiv = captive portal (the ro router / hotspot convention);
 * reprezentare = representation (content negotiation); cerere
 * condiționată = conditional request; negociere de conținut = content
 * negotiation; răspuns intermediar = interim response; serverul de
 * origine = the origin behind the proxy (502 — the S116 split against
 * origine = the web-platform origin); the Body / Authorization tab
 * names ride raw with fila as head noun. Every raw header name takes
 * antetul as head noun (antetul de răspuns Location, antetul de cerere
 * Range), the protocolul / conexiunea head nouns cover HTTP/2 and
 * WebSocket, and the lowercase-en `cookie` of 431 stays Latin per the
 * ledger.
 */

import type { Catalog } from '../../types';

export const sharedInfoStatus = {
  // ── Popover chrome + fallbacks ─────────────────────────────────────
  'shared.info.status.kicker': 'Stare HTTP · {range}',
  'shared.info.status.undocumented':
    'Acest cod exact nu este documentat în registrul nostru — intervalul de mai sus dă sensul său standard.',
  'shared.info.status.serverPhrase': 'Serverul a trimis fraza-motiv „{statusText}”.',

  // ── Range kickers + fallback summaries ─────────────────────────────
  'shared.info.status.range1xx.kicker': '1xx Informațional',
  'shared.info.status.range1xx.fallback': 'Răspuns intermediar — schimbul este încă în curs și urmează o stare finală.',
  'shared.info.status.range2xx.kicker': '2xx Succes',
  'shared.info.status.range2xx.fallback': 'Cererea a fost primită, înțeleasă și acceptată.',
  'shared.info.status.range3xx.kicker': '3xx Redirecționare',
  'shared.info.status.range3xx.fallback':
    'Este nevoie de o acțiune suplimentară pentru a finaliza cererea — consultați antetul de răspuns Location.',
  'shared.info.status.range4xx.kicker': '4xx Eroare de client',
  'shared.info.status.range4xx.fallback':
    'Serverul a respins cererea așa cum a fost trimisă — ceva din cerere trebuie schimbat.',
  'shared.info.status.range5xx.kicker': '5xx Eroare de server',
  'shared.info.status.range5xx.fallback':
    'Serverul nu a reușit să onoreze o cerere aparent validă — defecțiunea este de partea serverului.',
  'shared.info.status.rangeOther.kicker': 'Nestandard',
  'shared.info.status.rangeOther.fallback': 'Acest cod este în afara intervalelor standard de stare HTTP.',

  // ── Curated codes ──────────────────────────────────────────────────
  'shared.info.status.s100.summary':
    'Răspuns intermediar — serverul a primit antetele cererii, iar clientul poate continua cu trimiterea corpului.',
  'shared.info.status.s101.summary':
    'Serverul a acceptat schimbarea protocolului cerută prin antetul Upgrade (de ex. la WebSocket).',
  'shared.info.status.s102.summary':
    'Răspuns intermediar WebDAV — serverul a acceptat cererea, dar nu a finalizat-o încă.',
  'shared.info.status.s103.summary':
    'Răspuns intermediar care aduce antete (de regulă preîncărcări Link) înaintea răspunsului final.',
  'shared.info.status.s200.summary': 'Cererea a reușit, iar răspunsul aduce rezultatul în corpul său.',
  'shared.info.status.s201.summary': 'Cererea a reușit și a fost creată o resursă nouă.',
  'shared.info.status.s201.body': 'Antetul de răspuns Location indică de obicei resursa nouă.',
  'shared.info.status.s202.summary': 'Cererea a fost acceptată pentru procesare, dar procesarea nu s-a încheiat.',
  'shared.info.status.s202.body':
    'Frecvent la sarcinile asincrone — rezultatul trebuie preluat mai târziu, adesea printr-o adresă URL de stare din corp.',
  'shared.info.status.s203.summary':
    'Răspunsul a reușit, dar a fost modificat de un proxy de transformare aflat între server și client.',
  'shared.info.status.s204.summary': 'Cererea a reușit și, în mod deliberat, nu există corp de răspuns.',
  'shared.info.status.s204.body': 'O filă Body goală este de așteptat aici, nu o eroare.',
  'shared.info.status.s205.summary':
    'Cererea a reușit, iar clientul ar trebui să reseteze vizualizarea care a trimis-o (de ex. să golească formularul).',
  'shared.info.status.s206.summary':
    'Serverul a returnat doar intervalul de octeți cerut prin antetul de cerere Range.',
  'shared.info.status.s206.body': 'Content-Range descrie ce felie din resursa completă este acest corp.',
  'shared.info.status.s207.summary':
    'Răspuns WebDAV în lot — corpul aduce o stare separată pentru fiecare sub-operație.',
  'shared.info.status.s208.summary':
    'WebDAV — acest membru a fost deja enumerat mai devreme în același răspuns multi-stare.',
  'shared.info.status.s226.summary':
    'Răspunsul este o diferență (manipulare de instanță) față de o versiune anterioară, nu resursa completă.',
  'shared.info.status.s300.summary': 'Sunt disponibile mai multe reprezentări, iar serverul nu alege niciuna.',
  'shared.info.status.s301.summary': 'Resursa s-a mutat definitiv la adresa URL din antetul Location.',
  'shared.info.status.s301.body':
    'Clienții și cache-urile rețin acest lucru; actualizați adresa URL a cererii la noua adresă.',
  'shared.info.status.s302.summary': 'Resursa se află temporar la adresa URL din antetul Location.',
  'shared.info.status.s302.body':
    'Browserele rescriu de obicei metoda în GET când o urmează — folosiți 307 pentru a păstra metoda.',
  'shared.info.status.s303.summary': 'Rezultatul se află la adresa URL din Location și ar trebui preluat cu GET.',
  'shared.info.status.s303.body': 'Tipic după un POST, cu redirecționare către pagina creată sau rezultată.',
  'shared.info.status.s304.summary': 'Copia din cache este încă validă — serverul nu a trimis corp în mod intenționat.',
  'shared.info.status.s304.body': 'Trimis ca răspuns la cererile condiționate (If-None-Match / If-Modified-Since).',
  'shared.info.status.s305.summary':
    'Depreciat — resursa trebuie accesată prin proxy-ul din Location. Clienții moderni îl ignoră.',
  'shared.info.status.s307.summary':
    'Temporar la adresa URL din Location; metoda și corpul trebuie păstrate la urmărire.',
  'shared.info.status.s308.summary':
    'Definitiv la adresa URL din Location; metoda și corpul trebuie păstrate la urmărire.',
  'shared.info.status.s400.summary': 'Serverul nu a putut parsa sau accepta cererea așa cum a fost trimisă.',
  'shared.info.status.s400.body':
    'Verificați sintaxa corpului, parametrii de interogare și antetele obligatorii — corpul răspunsului numește adesea câmpul problematic.',
  'shared.info.status.s401.summary': 'Cererii îi lipsesc acreditări de autentificare valide.',
  'shared.info.status.s401.body':
    'Antetul de răspuns WWW-Authenticate numește schema așteptată. Verificați fila Authorization / prospețimea tokenului.',
  'shared.info.status.s402.summary':
    'Cod rezervat, folosit de unele interfețe API pentru limite de cotă sau de facturare.',
  'shared.info.status.s403.summary': 'Serverul a înțeles cererea și acreditările, dar refuză să o permită.',
  'shared.info.status.s403.body':
    'Spre deosebire de 401, reautentificarea nu ajută — această identitate nu are permisiune pentru această resursă.',
  'shared.info.status.s404.summary':
    'Nu există nicio resursă la această adresă URL (sau serverul ascunde dacă există).',
  'shared.info.status.s404.body':
    'Verificați calea și orice ID din ea; unele interfețe API returnează 404 în loc de 403 ca să nu dezvăluie existența.',
  'shared.info.status.s405.summary': 'Resursa există, dar nu pentru această metodă HTTP.',
  'shared.info.status.s405.body': 'Antetul de răspuns Allow enumeră metodele pe care le acceptă această adresă URL.',
  'shared.info.status.s406.summary':
    'Serverul nu poate produce o reprezentare care să corespundă antetelor Accept ale cererii.',
  'shared.info.status.s407.summary':
    'Un proxy aflat între dvs. și server cere acreditări (Proxy-Authenticate numește schema).',
  'shared.info.status.s408.summary': 'Serverul a renunțat să mai aștepte restul cererii și a închis schimbul.',
  'shared.info.status.s409.summary': 'Cererea intră în conflict cu starea curentă a resursei.',
  'shared.info.status.s409.body':
    'Tipic la editările concurente sau la creările duplicate — recitiți resursa și reîncercați.',
  'shared.info.status.s410.summary': 'Resursa a existat, dar a fost eliminată intenționat și definitiv.',
  'shared.info.status.s411.summary':
    'Serverul cere un antet Content-Length și refuză corpurile fragmentate sau fără dimensiune.',
  'shared.info.status.s412.summary':
    'Un antet condițional (If-Match, If-Unmodified-Since, …) nu s-a verificat, așa că serverul a refuzat să acționeze.',
  'shared.info.status.s413.summary': 'Corpul cererii depășește ce acceptă serverul.',
  'shared.info.status.s414.summary':
    'Adresa URL a cererii depășește limita serverului — de obicei date din șirul de interogare care ar trebui să stea într-un corp.',
  'shared.info.status.s415.summary': 'Serverul respinge formatul corpului.',
  'shared.info.status.s415.body': 'Verificați antetul de cerere Content-Type față de ce așteaptă interfața API.',
  'shared.info.status.s416.summary': 'Antetul de cerere Range cere octeți din afara resursei.',
  'shared.info.status.s417.summary':
    'Serverul nu poate onora antetul de cerere Expect (de regulă Expect: 100-continue).',
  'shared.info.status.s418.summary': 'Cod RFC de 1 aprilie; unele interfețe API îl folosesc ca refuz jucăuș.',
  'shared.info.status.s421.summary':
    'Cererea a ajuns la un server care nu este configurat să răspundă pentru această authority (frecvent la conexiunile HTTP/2 refolosite).',
  'shared.info.status.s422.summary': 'Corpul este valid sintactic, dar greșit semantic — validarea a eșuat.',
  'shared.info.status.s422.body': 'Corpul răspunsului enumeră de obicei erorile de validare per câmp.',
  'shared.info.status.s423.summary': 'WebDAV — resursa este blocată de o altă operație.',
  'shared.info.status.s424.summary':
    'WebDAV — această acțiune a eșuat fiindcă a eșuat o acțiune anterioară de care depindea.',
  'shared.info.status.s425.summary':
    'Serverul refuză să proceseze o cerere care ar putea fi reluată (date TLS timpurii).',
  'shared.info.status.s426.summary':
    'Serverul insistă asupra unui alt protocol — antetul de răspuns Upgrade îl numește.',
  'shared.info.status.s428.summary':
    'Serverul cere un antet condițional (de regulă If-Match) pentru a preveni actualizările pierdute.',
  'shared.info.status.s429.summary': 'Limită de rată atinsă — încetiniți.',
  'shared.info.status.s429.body':
    'Antetul de răspuns Retry-After (când există) spune cât să așteptați; multe interfețe API trimit și antete RateLimit-*.',
  'shared.info.status.s431.summary':
    'Un antet de cerere (sau toate laolaltă) depășește limita de dimensiune a serverului — adesea un cookie supradimensionat.',
  'shared.info.status.s451.summary':
    'Serverul refuză accesul din motive legale (cenzură, hotărâre judecătorească, eliminare GDPR).',
  'shared.info.status.s500.summary':
    'Serverul a întâmpinat o condiție neașteptată — defecțiunea este de partea serverului.',
  'shared.info.status.s500.body':
    'Reîncercarea poate reuși dacă defecțiunea este trecătoare; altfel, rezolvarea stă în jurnalele serverului, nu în cerere.',
  'shared.info.status.s501.summary': 'Serverul nu acceptă funcționalitatea cerută — adesea o metodă nerecunoscută.',
  'shared.info.status.s502.summary': 'Un gateway sau un proxy a primit un răspuns nevalid de la serverul din amonte.',
  'shared.info.status.s502.body':
    'Serverul de origine din spatele proxy-ului eșuează sau este inaccesibil — de obicei trecător.',
  'shared.info.status.s503.summary': 'Serverul nu poate trata temporar cererea (suprasarcină sau mentenanță).',
  'shared.info.status.s503.body': 'Retry-After (când există) spune când să reîncercați.',
  'shared.info.status.s504.summary': 'Un gateway sau un proxy a expirat așteptând serverul din amonte.',
  'shared.info.status.s505.summary': 'Serverul refuză versiunea protocolului HTTP folosită în cerere.',
  'shared.info.status.s506.summary':
    'Configurare greșită a serverului la negocierea de conținut — varianta aleasă se negociază pe sine.',
  'shared.info.status.s507.summary': 'WebDAV — serverul nu poate stoca ce cere cererea.',
  'shared.info.status.s508.summary': 'WebDAV — serverul a găsit o buclă infinită în timpul procesării cererii.',
  'shared.info.status.s510.summary':
    'Cererea are nevoie de o extensie suplimentară pentru ca serverul să o poată onora.',
  'shared.info.status.s511.summary':
    'Rețeaua (de regulă un portal captiv) cere autentificare înainte de a acorda accesul.',
} as const satisfies Catalog;
