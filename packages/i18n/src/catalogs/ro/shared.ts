/**
 * Shared namespace — Romanian. Mirrors `catalogs/en/shared.ts` key for
 * key; see that file for the namespace rules. Register contract for the
 * ro catalogs (pattern-setter): formal plural address (dumneavoastră
 * implied — never tu); requests to the user are polite plural
 * imperatives in -ți (Apăsați, Introduceți, Copiați); the written
 * pronoun, where a sentence needs it, is the abbreviation dvs.
 * (Dispozitivele dvs.); labels, buttons and menu rows are nouns or
 * infinitives-as-nouns (Salvare, Închidere, Copiere, Anulare — the
 * fr / es / de noun convention), never imperatives; sentence case
 * everywhere — only the first word of a label is capitalized
 * (Modificare antete); en ALL-CAPS kickers and status pills keep caps
 * (REGULI, ÎNAINTE / DUPĂ). Orthography: comma-below ș ț (U+0219 /
 * U+021B) always, NEVER the cedilla forms; â inside words, î at word
 * edges (sunt, not sînt — the 1993 Academy norm). Typography: „…”
 * (U+201E / U+201D) for UI labels quoted in prose (en's “” and ""
 * alike), JSON-wire quotes stay ASCII; the en aside dash KEEPS as a
 * spaced em dash ` — ` (native Romanian punctuation — never
 * restructured); ellipsis is `…`; no space before `?!:;`; en's
 * unspaced `{percent}%` figure style kept; a Romanian `{count} s` unit
 * takes a space (5 s, 30 s) while raw glossary units (`{period}s`,
 * `{ms} ms`) copy en's spacing; thousands take a period and decimals a
 * comma (2.048 KB, 1,5 s). RAW-TOKEN LAW (the ru case-ending law's ro
 * twin): a raw token NEVER takes a butted enclitic article or plural
 * (`URLul`, `JWTul` read as dropped terms) — the hyphenated enclitic
 * (`URL-ul`, `API-ul`) is legal Romanian and lint-legal, but every ro
 * file prefers a HEAD NOUN for the diagram width and for parity with
 * the ru appositions: adresa URL, tokenul JWT, cheia API, antetul
 * Cookie, fereastra DevTools, browserul Chrome, conexiunea WebSocket,
 * valoarea JSON, directivele CSP, antetele HTTP; a `{placeholder}`
 * hole takes no article and no agreeing adjective — restructure with
 * a head noun (versiunea {version}, gazda {host}, fișierul {filename},
 * conexiunea cu {label}) or a colon frame (`Respins: {reason}`);
 * `New {name}` becomes `{name} (nou)` only when every filler shares one
 * gender, else restructure. Gender of raw nouns, decided once: URL
 * carries f. through its head noun adresă (adresa URL), API n.
 * (interfața API f. as head noun), JWT n. (tokenul JWT), WebSocket
 * carries f. through conexiune (conexiunea WebSocket), Vault n. (the
 * section — secretele din Vault), Live raw as a product noun with a
 * head noun (variabile Live, fluxul de lucru Live — never „în direct”),
 * Cookie n. (fișier cookie — prose lowercase `cookie` stays Latin as
 * Chrome's ro UI writes it: cookie-uri — the hyphen breaks the glossary boundary; the
 * capitalized `Cookie` header stays raw with antet as head noun), CLI
 * n., DNR n., Org f. (organizația — această Org); en prose "header"
 * TRANSLATES as antet (the CJK "Header raw" law does not carry) — only
 * the glossary `Header` JWT part / `Headers` DevTools tab ride raw.
 * Plurals: `plural()` with one / few / other (CLDR ro — the lint
 * enforces exactly the three keys; `many` is NOT a ro category):
 * {count} regulă / {count} reguli / {count} de reguli — `few` covers
 * 2–19 (and 102–119 …), `other` takes the `de` particle (20 de reguli,
 * 100 de reguli); after `din` the same three forms ({matched} din
 * {count} reguli / de reguli); never pluralize a raw token. Loanword
 * ledger: server, antet = header, browser, utilizator = user, editor,
 * folder (the Windows / Google ro convention — never dosar), spațiu de
 * lucru = workspace, backend, handshake raw (a glossary-adjacent
 * protocol noun — never strângere de mână), asociere = pairing,
 * aplicația desktop = desktop app, fereastră popup = popup (popup raw
 * as apposition), verificare = probe (Test connection = verificarea
 * conexiunii), clipboard, colecție, secret, proxy, script, cadru =
 * frame, flux = stream, domeniu = domain, cache, indicator = flag,
 * panou = panel, doc = dock, filă = tab, shell, commit, token (raw
 * spelling, Romanian article by head noun: tokenul), flux de lucru =
 * workflow, fereastră de instrumente = tool window, pastilă = pill,
 * subsistem, extensie, mediu = environment, variabilă, sferă = scope
 * (decided over domeniu de aplicare so scope never collides with
 * domeniu = domain), referință = reference, captură = capture,
 * învechit = stale. Domain nouns: regulă = rule, cerere = request,
 * răspuns = response, Suprascriere = Override, Îmbinare = Merge,
 * Adăugare la sfârșit = Append, Comutare = Switch, Setări = Settings,
 * Activat / Dezactivat = Enabled / Disabled, dinamic = Dynamic, pas =
 * Step, Workbench RAW as the surface name (the ja / ko choice — never
 * Banc de lucru; head noun where prose needs one: fereastra
 * Workbench), Copie de rezervă și sincronizare = Backup and Sync. Dev
 * nouns retain English liberally: the glossary raw-token laws carry
 * over unchanged (WebSocket, URL, Org / DevTools / JWT part names raw).
 * Romanian runs ~20% longer than English — diagram labels take the
 * shortest correct form.
 */

import { plural } from '../../runtime';
import type { Catalog } from '../../types';

export const shared = {
  'shared.action.save': 'Salvare',
  'shared.action.cancel': 'Anulare',
  'shared.action.close': 'Închidere',
  'shared.action.copy': 'Copiere',
  'shared.action.remove': 'Eliminare',
  'shared.toast.copiedToClipboard': 'Copiat în clipboard',
  'shared.toast.copyFailed': 'Accesul la clipboard a fost refuzat — copiați valoarea manual',
  'shared.count.rules': ({ count }, locale) =>
    plural(locale, Number(count), {
      one: '{count} regulă',
      few: '{count} reguli',
      other: '{count} de reguli',
    }),

  // ── Top-level error boundary ─────────────────────────────────────────
  'shared.errorBoundary.title': 'Ceva nu a funcționat',
  'shared.errorBoundary.subtitle': 'Fereastra popup nu a putut fi încărcată. Închideți-o și deschideți-o din nou.',
  'shared.errorBoundary.reload': 'Reîncărcare',

  // ── Invalidated-context notice (DevTools panel orphan watch) ────────
  'shared.contextInvalidated.title': 'Extensia Open Headers a fost actualizată sau reîncărcată',
  'shared.contextInvalidated.body': 'Închideți și redeschideți fereastra DevTools pentru a continua.',

  // ── Connection-probe notices ─────────────────────────────────────────
  'shared.probe.connectionOk': 'Conexiune stabilită',
  'shared.probe.reachableDescription': 'Conexiunea cu {label} a fost stabilită.',
  'shared.probe.notReachable': 'Inaccesibil',
  'shared.probe.title.authRequired': 'Accesibil, dar necesită autentificare',
  'shared.probe.title.workspaceUnknown': 'Accesibil, dar nu partajează acest spațiu de lucru',
  'shared.probe.title.versionMismatch': 'Accesibil, dar versiunile nu corespund',
  'shared.probe.title.notReady': 'Accesibil, dar nu este pregătit',
  'shared.probe.fail.invalidUrl': 'Adresă URL nevalidă.',
  'shared.probe.fail.invalidUrlDetail': 'Adresă URL nevalidă. {detail}',
  'shared.probe.fail.timeout': 'Timpul de așteptare a răspunsului a expirat — backend-ul rulează?',
  'shared.probe.fail.closedBeforeWelcome':
    'Conexiunea s-a închis înainte de handshake — probabil backend-ul nu rulează pe acel port.',
  'shared.probe.fail.openFailed': 'Conexiunea WebSocket nu a putut fi deschisă.',
  'shared.probe.fail.openFailedDetail': 'Conexiunea WebSocket nu a putut fi deschisă: {detail}.',
  'shared.probe.fail.protocolMismatch':
    'Accesibil, dar versiunile de protocol sunt incompatibile — actualizați ambele aplicații.',
  'shared.probe.fail.workspaceUnknown':
    'Accesibil — backend-ul rulează, dar încă nu partajează acest spațiu de lucru. Comutarea le va asocia.',
  'shared.probe.fail.protocolTooOld':
    'Accesibil — dar această aplicație este mai veche decât backend-ul. Actualizați această parte.',
  'shared.probe.fail.protocolTooNew':
    'Accesibil — dar backend-ul este mai vechi decât această aplicație. Actualizați backend-ul.',
  'shared.probe.fail.authRequired':
    'Accesibil — dar acest dispozitiv nu este încă autentificat. Asociați-l cu un cod sau lipiți un token mai sus, ' +
    'apoi apăsați „Comutare”.',
  'shared.probe.fail.rejected': 'Respins: {reason}',
  'shared.probe.fail.rejectedUnknown': 'Respins: motiv necunoscut',
  'shared.probe.fail.malformedWelcome': 'S-a găsit un server, dar nu vorbește protocolul Open Headers.',
  'shared.probe.fail.generic': 'Verificarea a eșuat.',
} as const satisfies Catalog;
