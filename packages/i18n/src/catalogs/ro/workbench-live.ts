/**
 * Workbench live/workflows station — Romanian. Mirrors
 * `catalogs/en/workbench-live.ts` key for key. Technical plane stays
 * raw inside keyed sentences: `{{live.NAME}}` reference syntax, policy
 * kind ids (expires-in / expires-at), duration values and relative-time
 * phrases interpolated as {when} / {countdown}, step ids / capture
 * names / workflow names, code examples ({"expires_in": 3600},
 * run_time + captured_seconds, epoch ms), MV3, `lead`, oh.* API names,
 * dependsOn, server error text ({error} / {message}); `id` / `Foreach`
 * / `Composite` / `AND` / `OR` ride raw (ja / ko / ru parity); the
 * `liveTag` is raw `Live` (the register's product noun). Quotes the
 * shipped ro mints: întrerupător de circuit = the circuit (breaker)
 * with „Reîncercare” / „Resetare circuit” (workbench-chrome's
 * workflowStatus info — deschis / se închide / se deschide = open /
 * closes / opens), Starea fluxurilor de lucru = the tool window,
 * captură = capture, extractor raw (shared-conflicts), politică de
 * reîncercare = retry policy, avans = lead (shared-conflicts „secunde
 * de avans la reîmprospătare”), flux de lucru / variabilă Live
 * (sidebar, chrome), legată = bound (sidebar), Reîmprospătare =
 * Refresh (the rule editor quotes it), publicare = publish,
 * suprascriere = override, verificare = probe, backoff raw with the
 * hyphenated enclitic (backoff-ul — the mqtt editor), Activat /
 * Dezactivat = Enabled / Disabled, Sănătos = healthy (shared-chrome),
 * Scripturi (the translated tab family), Expresie regulată (the Regex
 * extractor), Cod de stare = Status code. MINTS: pas strămoș =
 * ancestor step (pasul anterior stays the prior step); condiție de
 * rulare = run condition; implicit / explicit; lexicografic; condiție =
 * a gate clause (the clause list IS the condition list); valoare
 * fixată = the pinned override value; rezolvator = resolver;
 * planificator = scheduler; inactiv = idle; the circuit pills SĂNĂTOS /
 * REÎNCERCARE / VERIFICARE / ÎN PAUZĂ keep en's caps (fr / de parity),
 * their summary rows read `{count} sănătoase / cu reîncercare / în
 * verificare / în pauză`. Plurals one / few / other (eșec / eșecuri /
 * de eșecuri, condiție / condiții / de condiții, pas strămoș / pași
 * strămoși / de pași strămoși, variabilă / variabile / de variabile,
 * pas / pași / de pași). The `{id}` / `{ref}` / `{stepId}` holes take
 * pasul / captura as head nouns or a colon frame (capturi: {count};
 * prioritate: {ref}; Ordine după {ref}); `la fiecare {seconds}s`
 * copies the raw unit while `avans {lead} s` takes the spaced Romanian
 * unit; `(e.g.` (expiresAtHelpMid) is whole-raw and copies verbatim.
 */

import { plural } from '../../runtime';
import type { Catalog } from '../../types';

export const workbenchLive = {
  // ── live-display: circuit descriptors ───────────────────────────────
  'workbench.editors.live.circuit.idleLabel': 'inactiv',
  'workbench.editors.live.circuit.idleHint': 'Niciun cache încă — rulați o reîmprospătare pentru a-l popula.',
  'workbench.editors.live.circuit.pausedLabel': 'în pauză',
  'workbench.editors.live.circuit.pausedHint': ({ count }, locale) =>
    plural(locale, Number(count), {
      one: 'Circuitul este deschis după {count} eșec consecutiv. Reîncercarea automată este amânată. Apăsați „Reîncercare acum” pentru a ocoli backoff-ul.',
      few: 'Circuitul este deschis după {count} eșecuri consecutive. Reîncercarea automată este amânată. Apăsați „Reîncercare acum” pentru a ocoli backoff-ul.',
      other:
        'Circuitul este deschis după {count} de eșecuri consecutive. Reîncercarea automată este amânată. Apăsați „Reîncercare acum” pentru a ocoli backoff-ul.',
    }),
  'workbench.editors.live.circuit.probingLabel': 'verificare…',
  'workbench.editors.live.circuit.probingHint': 'Încercare de verificare în zbor — un singur succes închide circuitul.',
  'workbench.editors.live.circuit.retryLabel': 'reîncercare {attempt} din 3',
  'workbench.editors.live.circuit.retryHint':
    'Nivelul de reîncercări dinaintea întrerupătorului — reîncercări rapide cu un backoff de 5–10 s între încercări. Circuitul se deschide după 3 eșecuri consecutive.',
  'workbench.editors.live.circuit.healthyLabel': 'sănătos',
  'workbench.editors.live.circuit.healthyHint': 'Circuit închis, fără eșecuri recente.',

  // ── live-display: schedule + policy wording ─────────────────────────
  'workbench.editors.live.schedule.last': 'ultima {when}',
  'workbench.editors.live.schedule.manualOnly': 'doar reîmprospătare manuală',
  'workbench.editors.live.schedule.autoRefresh': 'reîmprospătare automată {when}',
  'workbench.editors.live.schedule.expires': 'expiră {when}',
  'workbench.editors.live.policy.interval': 'la fiecare {seconds}s',
  'workbench.editors.live.policy.expiresIn': 'expires-in din captura {source} (avans {lead} s)',
  'workbench.editors.live.policy.expiresAt': 'expires-at din captura {source} (avans {lead} s)',
  'workbench.editors.live.policy.manual': 'reîmprospătare manuală',

  // ── live-display: per-step run states ───────────────────────────────
  'workbench.editors.live.stepRun.completed': 'Finalizat la ultima rulare',
  'workbench.editors.live.stepRun.failed': 'Ultima rulare a eșuat la acest pas',
  'workbench.editors.live.stepRun.extractFailed': 'Preluat, dar un extractor de captură nu s-a potrivit',
  'workbench.editors.live.stepRun.skipped': 'Sărit de condiția sa de rulare la ultima rulare',
  'workbench.editors.live.stepRun.notRun': 'Nu face încă parte dintr-o rulare reușită',
  'workbench.editors.live.maskEmpty': '(gol)',

  // ── Shared live form chrome (live/layout) ───────────────────────────
  'workbench.editors.live.form.namePlaceholder': 'Nume',
  'workbench.editors.live.form.descriptionPlaceholder': 'Descriere (opțional)',

  // ── Live-variable editor: edit mode ─────────────────────────────────
  'workbench.editors.live.variable.sourceNotFound': 'Sursa nu a fost găsită.',
  'workbench.editors.live.variable.liveTag': 'Live',
  'workbench.editors.live.variable.disabledTag': 'Dezactivat',
  'workbench.editors.live.variable.overrideTag': 'suprascriere',
  'workbench.editors.live.variable.refresh': 'Reîmprospătare',
  'workbench.editors.live.variable.valueLabel': 'Valoare',
  'workbench.editors.live.variable.neverRefreshed': '(niciodată reîmprospătată)',
  'workbench.editors.live.variable.nameLabel': 'Nume',
  'workbench.editors.live.variable.nameHint': 'Referință: {{live.NAME}}',
  'workbench.editors.live.variable.descriptionLabel': 'Descriere',
  'workbench.editors.live.variable.bindingSection': 'Legare',
  'workbench.editors.live.variable.workflowLabel': 'Flux de lucru',
  'workbench.editors.live.variable.stepLabel': 'Pas',
  'workbench.editors.live.variable.captureLabel': 'Captură',
  'workbench.editors.live.variable.selectWorkflow': 'Selectați un flux de lucru',
  'workbench.editors.live.variable.selectStep': 'Selectați un pas',
  'workbench.editors.live.variable.selectCapture': 'Selectați o captură',
  'workbench.editors.live.variable.stepOption': '{id} (capturi: {count})',
  'workbench.editors.live.variable.openFlow': 'Deschidere flux',
  'workbench.editors.live.variable.overrideSection': 'Suprascriere manuală',
  'workbench.editors.live.variable.overrideValuePlaceholder': 'Valoare fixă de suprascriere',
  'workbench.editors.live.variable.overrideExpiresLabel': 'Expiră (ms)',
  'workbench.editors.live.variable.overrideExpiresHint':
    'Timp real în epoch ms — lăsați gol pentru o suprascriere permanentă',
  'workbench.editors.live.variable.applyOverride': 'Aplicare suprascriere',
  'workbench.editors.live.variable.clearOverride': 'Golire',
  'workbench.editors.live.variable.setOverride': 'Setare suprascriere manuală',
  'workbench.editors.live.variable.overrideNote':
    'Rezolvatorul servește valoarea fixată; planificatorul reîmprospătează în continuare fluxul de lucru de bază.',
  'workbench.editors.live.variable.deletedElsewhere': 'Sursa a fost ștearsă din altă filă',
  'workbench.editors.live.variable.saveFailed': 'Salvarea variabilei Live a eșuat',
  'workbench.editors.live.variable.refreshFailed': 'Reîmprospătarea a eșuat: {error}',
  'workbench.editors.live.variable.refreshed': 'Reîmprospătat',
  'workbench.editors.live.variable.overrideSaveFailed': 'Salvarea suprascrierii a eșuat.',
  'workbench.editors.live.variable.overrideApplied': 'Suprascriere aplicată',
  'workbench.editors.live.variable.overrideCleared': 'Suprascriere golită',

  // ── Live-variable editor: create mode ───────────────────────────────
  'workbench.editors.live.create.title': 'Variabilă Live nouă',
  'workbench.editors.live.create.namePlaceholder': 'Nume (de ex. accessToken)',
  'workbench.editors.live.create.referenceAs': 'Referință: {{live.{name}}}',
  'workbench.editors.live.create.createWorkflow': 'Creare flux de lucru',
  'workbench.editors.live.create.noWorkflows': 'Niciun flux de lucru încă.',
  'workbench.editors.live.create.nameRequired': 'Numele este obligatoriu',
  'workbench.editors.live.create.bindingRequired': 'Selectați un flux de lucru, un pas și o captură',
  'workbench.editors.live.create.createFailed': 'Crearea variabilei Live a eșuat',

  // ── Toggles row (Enabled / Wait for fresh value) ────────────────────
  'workbench.editors.live.toggles.enabled': 'Activat',
  'workbench.editors.live.toggles.enabledTooltip':
    'Când este dezactivat, referințele {{live.NAME}} nu se mai rezolvă în reguli și cereri.',
  'workbench.editors.live.toggles.waitForFresh': 'Așteptare valoare proaspătă',
  'workbench.editors.live.toggles.waitForFreshTooltip':
    'Înainte de aplicarea regulilor, așteaptă ca fluxul de lucru de bază să încheie o reîmprospătare (până la ~5 s). Dezactivat: regulile folosesc ultima valoare din cache și reîmprospătează în fundal — mai rapid, dar valoarea poate fi scurt învechită după trezirea extensiei.',

  // ── Refresh-policy picker ───────────────────────────────────────────
  'workbench.editors.live.refreshPolicy.manual': 'Doar manual',
  'workbench.editors.live.refreshPolicy.interval': 'Interval fix',
  'workbench.editors.live.refreshPolicy.expiresIn': 'Expiră în N secunde (relativ)',
  'workbench.editors.live.refreshPolicy.expiresAt': 'Expiră la epoch ms (absolut)',
  'workbench.editors.live.refreshPolicy.leadUnit': 'avans s',
  'workbench.editors.live.refreshPolicy.selectCapture': 'Selectare captură',
  'workbench.editors.live.refreshPolicy.noCaptures': 'Nicio captură definită încă.',
  'workbench.editors.live.refreshPolicy.subMinuteWarning':
    'Intervalele sub un minut ating pragul minim al alarmelor MV3 și consumă rapid cota. Folosiți-le doar când este necesar.',
  'workbench.editors.live.refreshPolicy.expiresInHelpPrefix':
    'Valoarea capturii = secunde până la expirare (de ex. OAuth',
  'workbench.editors.live.refreshPolicy.expiresInHelpMid':
    '). Reîmprospătarea se declanșează cu `lead` secunde înainte de',
  'workbench.editors.live.refreshPolicy.expiresInHelpSuffix': '.',
  'workbench.editors.live.refreshPolicy.expiresAtHelpPrefix': 'Valoarea capturii = timp unix epoch absolut în',
  'workbench.editors.live.refreshPolicy.expiresAtHelpMilliseconds': 'milisecunde',
  'workbench.editors.live.refreshPolicy.expiresAtHelpMid': '(e.g.',
  'workbench.editors.live.refreshPolicy.expiresAtHelpSuffix':
    '). Reîmprospătarea se declanșează cu `lead` secunde înainte de acel moment.',
  'workbench.editors.live.refreshPolicy.noCapturesWarning':
    'Adăugați mai întâi o captură în fluxul de lucru, pentru ca aritmetica expirării să aibă o sursă.',

  // ── Workflow editor shell (LiveWorkflowEditor) ──────────────────────
  'workbench.editors.live.panel.noStep':
    'Niciun pas selectat, așa că se afișează întregul flux de lucru. Faceți clic pe un pas din graf pentru a-l deschide.',
  'workbench.editors.live.panel.stepOf': 'Pasul {number} din {total}',
  'workbench.editors.live.panel.closeStep': 'Închide pasul și afișează fluxul de lucru',
  'workbench.editors.live.panel.lastRun': 'Ultima rulare',
  'workbench.editors.live.panel.stepName': 'Numele pasului',
  'workbench.editors.live.panel.stepKind': 'Tipul pasului',
  'workbench.editors.live.panel.moveUp': 'Mutați pasul în sus',
  'workbench.editors.live.panel.moveDown': 'Mutați pasul în jos',
  'workbench.editors.live.panel.duplicate': 'Duplicați',
  'workbench.editors.live.panel.delete': 'Ștergeți',
  'workbench.editors.live.panel.response': 'Răspuns',
  'workbench.editors.live.panel.message': 'Mesaj',
  'workbench.editors.live.lastRun.stateIdle': 'Nerulat încă',
  'workbench.editors.live.lastRun.stateRetrying': 'Se reîncearcă',
  'workbench.editors.live.lastRun.stateOpen': 'Deschisă',
  'workbench.editors.live.lastRun.idle': 'Apăsați {button} pentru a vedea ce face acest pas.',
  'workbench.editors.live.lastRun.waiting': 'Încă nu i-a venit rândul în această rulare.',
  'workbench.editors.live.lastRun.notRun': 'Rularea s-a încheiat înaintea acestui pas.',
  'workbench.editors.live.lastRun.returned': 'A returnat {status}.',
  'workbench.editors.live.lastRun.ready': 'Sesiunea era gata să primească.',
  'workbench.editors.live.lastRun.sent': 'Mesajul a fost trimis.',
  'workbench.editors.live.lastRun.matched': 'A sosit un mesaj care se potrivește.',
  'workbench.editors.live.lastRun.status': 'Stare',
  'workbench.editors.live.lastRun.response': 'Răspuns',
  'workbench.editors.live.lastRun.duration': 'Durată',
  'workbench.editors.live.lastRun.size': 'Dimensiune',
  'workbench.editors.live.lastRun.attempts': 'Încercări',
  'workbench.editors.live.lastRun.attemptOf': '{attempt} din {max}',
  'workbench.editors.live.lastRun.readyIn': 'Gata în',
  'workbench.editors.live.lastRun.limit': 'Limită',
  'workbench.editors.live.lastRun.matchedAfter': 'Potrivire după',
  'workbench.editors.live.lastRun.acknowledgedIn': 'Confirmat în',
  'workbench.editors.live.lastRun.limitOf': 'limită {duration}',
  'workbench.editors.live.deps.description': 'Așteaptă ca aceștia să se termine.',
  'workbench.editors.live.deps.add': 'Adăugați',
  'workbench.editors.live.deps.none': 'Nimic. Acest pas pornește odată cu fluxul de lucru.',
  'workbench.editors.live.deps.byDefault': 'Implicit, așteaptă pasul dinaintea lui.',
  'workbench.editors.live.deps.chosen': 'Ales pentru acest pas.',
  'workbench.editors.live.requiredBy.title': 'Necesar pentru',
  'workbench.editors.live.requiredBy.description': 'Aceștia așteaptă acest pas.',
  'workbench.editors.live.requiredBy.none': 'Nimic nu așteaptă acest pas.',
  'workbench.editors.live.gate.description': 'Verificată după ce se termină toate dependențele.',
  'workbench.editors.live.gate.colCheck': 'Verificare',
  'workbench.editors.live.gate.colExpected': 'Așteptat',
  'workbench.editors.live.gate.truthTrue': 'Adevărat',
  'workbench.editors.live.gate.truthFalse': 'Fals',
  'workbench.editors.live.gate.summaryAll': 'Rulează când fiecare condiție este îndeplinită: {conditions}.',
  'workbench.editors.live.gate.summaryRoot': 'Fără dependențe, deci acest pas rulează când pornește fluxul de lucru.',
  'workbench.editors.live.request.title': 'Cerere',
  'workbench.editors.live.request.description': 'Cererea salvată pe care o trimite acest pas.',
  'workbench.editors.live.request.open': 'Deschidere cerere',
  'workbench.editors.live.request.saved': 'Cerere salvată',
  'workbench.editors.live.request.inCollection': 'în {path}',
  'workbench.editors.live.connection.title': 'Conexiune',
  'workbench.editors.live.connection.description': 'Rămâne deschisă până la sfârșitul rulării.',
  'workbench.editors.live.connection.readyWithin': 'Gata în (ms)',
  'workbench.editors.live.expect.title': 'Așteptare mesaj',
  'workbench.editors.live.expect.description': 'Ce așteaptă acest pas și cât timp.',
  'workbench.editors.live.expect.topic': 'Subiect',
  'workbench.editors.live.expect.onlyAfter': 'Doar mesajele de după',
  'workbench.editors.live.expect.within': 'În (ms)',
  'workbench.editors.live.step.onConnection': 'Pe conexiunea',
  'workbench.editors.live.send.title': 'Trimitere mesaj',
  'workbench.editors.live.send.description': 'Mesajul salvat pe care îl publică acest pas.',
  'workbench.editors.live.send.savedMessage': 'Mesaj salvat',
  'workbench.editors.live.criteria.matchTitle': 'Criterii de potrivire',
  'workbench.editors.live.criteria.matchDescription': 'Un mesaj se potrivește când fiecare rând este îndeplinit.',
  'workbench.editors.live.criteria.colSource': 'Sursă',
  'workbench.editors.live.criteria.colPath': 'Cale',
  'workbench.editors.live.criteria.colOperator': 'Operator',
  'workbench.editors.live.criteria.lastRun': 'Ultima rulare: {outcome}',
  'workbench.editors.live.criteria.neverMatched': 'Nu s-a potrivit niciodată',
  'workbench.editors.live.run.empty':
    'Nicio rulare în această sesiune încă. Apăsați {button} pentru a rula acest flux de lucru.',
  'workbench.editors.live.run.verdict.running': 'În curs',
  'workbench.editors.live.run.verdict.passed': 'Reușită',
  'workbench.editors.live.run.verdict.failed': 'Eșuată',
  'workbench.editors.live.run.verdict.cannotRun': 'Nu poate rula aici',
  'workbench.editors.live.run.total.passed': 'reușiți: {count}',
  'workbench.editors.live.run.total.failed': 'eșuați: {count}',
  'workbench.editors.live.run.total.skipped': 'săriți: {count}',
  'workbench.editors.live.run.total.notRun': 'nerulați: {count}',
  'workbench.editors.live.run.total.cannotRun': 'nu pot rula: {count}',
  'workbench.editors.live.run.action.call': 'Apel',
  'workbench.editors.live.run.row.waiting': 'În așteptare',
  'workbench.editors.live.run.row.sending': 'Se trimite…',
  'workbench.editors.live.run.row.attempt': 'Încercarea {attempt} din {max}',
  'workbench.editors.live.run.row.passedOnAttempt': 'Reușit la încercarea {attempt} din {max}',
  'workbench.editors.live.run.row.readyIn': 'Gata în {duration}',
  'workbench.editors.live.run.row.sent': 'Trimis',
  'workbench.editors.live.run.row.acknowledgedIn': 'Confirmat în {duration}',
  'workbench.editors.live.run.row.matchedAfter': 'Potrivire după {duration}',
  'workbench.editors.live.run.row.captures': ({ count }, locale) =>
    plural(locale, Number(count), {
      one: '{count} captură',
      few: '{count} capturi',
      other: '{count} de capturi',
    }),
  'workbench.editors.live.run.row.failed': 'Eșuat',
  'workbench.editors.live.run.row.timedOut': 'Timp expirat',
  'workbench.editors.live.run.row.skipped': 'Sărit',
  'workbench.editors.live.run.row.skippedReason': 'Condiția sa de rulare nu a fost îndeplinită.',
  'workbench.editors.live.run.row.notRun': 'Nerulat',
  'workbench.editors.live.run.row.cannotRun': 'Nu poate rula aici',
  'workbench.editors.live.run.footer.failed': 'Nu s-a publicat nimic. Ultimele valori bune rămân.',
  'workbench.editors.live.run.footer.cannotRun': 'Niciun pas nu a rulat.',
  'workbench.editors.live.run.pane.none': 'Acest pas nu are nimic de arătat.',
  'workbench.editors.live.run.pane.gone': 'Răspunsul acestui pas nu mai este păstrat.',
  'workbench.editors.live.run.action.listen': 'Ascultare',
  'workbench.editors.live.run.action.send': 'Trimitere',
  'workbench.editors.live.run.row.heldByRateLimit': 'Așteaptă limita de frecvență',
  'workbench.editors.live.run.row.connecting': 'Se conectează…',
  'workbench.editors.live.run.row.waitingFor': 'Se așteaptă {address}',
  'workbench.editors.live.run.row.waitingForMessage': 'Se așteaptă un mesaj',
  'workbench.editors.live.run.row.elapsedOf': '{elapsed} din {deadline}',
  'workbench.editors.live.run.row.open': 'deschisă',
  'workbench.editors.live.run.row.closedAfter': 'închisă după {duration}',
  'workbench.editors.live.run.row.identityGenerated': 'ID de client generat',
  'workbench.editors.live.run.row.identityOwn': 'ID de client setat pe cerere',
  'workbench.editors.live.run.row.cleanStart': 'Pornire curată',
  'workbench.editors.live.run.row.resumed': 'Sesiune stocată reluată',
  'workbench.editors.live.run.row.granted': ({ count }, locale) =>
    plural(locale, Number(count), {
      one: '{count} abonament acordat',
      few: '{count} abonamente acordate',
      other: '{count} de abonamente acordate',
    }),
  'workbench.editors.live.run.pane.window.since': 'Mesaje pe adresă de când a pornit „{step}”',
  'workbench.editors.live.run.pane.window.empty': 'Niciun mesaj nu a sosit pe adresă.',
  'workbench.editors.live.run.pane.note.matched': 'Se potrivește',
  'workbench.editors.live.run.pane.note.notMatched': 'Nu se potrivește',
  'workbench.editors.live.run.pane.note.stored': 'Stocat · omis',
  'workbench.editors.live.run.pane.note.sent': 'Trimis',
  'workbench.editors.live.run.pane.note.reply': 'Răspuns',
  'workbench.editors.live.workflow.refresh': 'Reîmprospătare',
  'workbench.editors.live.workflow.runUnavailable': 'Fluxurile de lucru nu rulează într-o copie publică.',
  'workbench.editors.live.workflow.disabledTag': 'Dezactivat',
  'workbench.editors.live.workflow.notFound': 'Fluxul de lucru nu a fost găsit.',
  'workbench.editors.live.workflow.needsUpdate':
    'Acest flux de lucru are pași care necesită o versiune mai nouă de OpenHeaders. Actualizați pentru a-l edita sau rula.',
  'workbench.editors.live.workflow.sessionRunsElsewhere':
    'Un flux de lucru cu pași de sesiune rulează în fila „{surface}”.',
  'workbench.editors.live.workflow.deletedElsewhere': 'Fluxul de lucru a fost șters din altă filă',
  'workbench.editors.live.workflow.saveFailed': 'Salvarea fluxului de lucru a eșuat',
  'workbench.editors.live.workflow.createFailed': 'Crearea fluxului de lucru a eșuat',
  'workbench.editors.live.workflow.nothingPicked': 'Pasul „{id}” nu are încă nimic selectat.',
  'workbench.editors.live.workflow.refreshed': 'Reîmprospătat',
  'workbench.editors.live.workflow.refreshFailed': 'Reîmprospătarea a eșuat: {error}',
  'workbench.editors.live.workflow.defaultName': 'Flux de lucru',
  'workbench.editors.live.workflow.newDraftName': 'Flux de lucru nou',

  // ── Workflow form body ──────────────────────────────────────────────
  'workbench.editors.live.form.structuralIssues': 'Fluxul de lucru are probleme structurale',
  'workbench.editors.live.form.stepsTitle': 'Pași ({count})',
  'workbench.editors.live.form.addStepButton': 'Pas',
  'workbench.editors.live.form.noSteps':
    'Niciun pas încă — adăugați unul pentru a lega o cerere și o extragere în acest flux de lucru.',
  'workbench.editors.live.form.enabledAria': 'Flux de lucru activat',
  'workbench.editors.live.form.enabled': 'Activat',
  'workbench.editors.live.form.disabled': 'Dezactivat',
  'workbench.editors.live.form.parallelLabel': 'Rulare pași independenți în paralel',
  'workbench.editors.live.form.parallelTooltip':
    'Doar secvențial în v1. Execuția paralelă va veni într-o versiune viitoare.',
  'workbench.editors.live.form.refreshPolicySection': 'Politică de reîmprospătare',
  'workbench.editors.live.form.sessionPolicyInfo':
    'Un flux de lucru cu pași de sesiune rulează când apăsați Reîmprospătare.',
  'workbench.editors.live.form.sessionNoLiveVariables':
    'Un flux de lucru cu pași de sesiune dă un verdict; capturile sale nu sunt expuse ca variabile Live.',

  // ── Workflow step editor ────────────────────────────────────────────
  'workbench.editors.live.step.needsUpdate': 'Acest pas necesită o versiune mai nouă de OpenHeaders.',
  'workbench.editors.live.step.typeTooltip': 'Tipul pasului — Foreach și Composite vor veni într-o versiune viitoare.',
  'workbench.editors.live.step.typeForeach': 'Foreach',
  'workbench.editors.live.step.typeComposite': 'Composite',
  'workbench.editors.live.step.selectRequest': 'Selectați o cerere',
  'workbench.editors.live.step.selectSessionRequest': 'Selectați o cerere MQTT',
  'workbench.editors.live.step.sessionScriptsLabel': 'Rulare scripturi ale cererii',
  'workbench.editors.live.step.identityTitle': 'Identitatea sesiunii',
  'workbench.editors.live.step.identityInfo':
    'Sesiunea se conectează așa cum este setată cererea ei MQTT. Modificați pe cerere.',
  'workbench.editors.live.step.onPrefix': 'pe',
  'workbench.editors.live.step.selectMessage': 'Selectați un mesaj salvat',
  'workbench.editors.live.step.afterPrefix': 'după',
  'workbench.editors.live.step.includeStored': 'Include mesajele stocate',
  'workbench.editors.live.step.descriptionPlaceholder': 'Descriere pas (opțional)',
  'workbench.editors.live.step.addCapture': 'Adăugare captură',
  'workbench.editors.live.captures.title': 'Capturi',
  'workbench.editors.live.captures.description': 'Valori pe care acest pas le păstrează pentru pașii următori.',
  'workbench.editors.live.captures.none':
    'Nicio captură încă. Adăugați una pentru a trece o valoare din acest pas către unul următor.',
  'workbench.editors.live.captures.colName': 'Nume',
  'workbench.editors.live.captures.colUsedBy': 'Folosită de',
  'workbench.editors.live.captures.lastValue': 'Ultima valoare:',
  'workbench.editors.live.captures.reveal': 'Afișează ultimele valori',
  'workbench.editors.live.uses.title': 'Folosite din alți pași',
  'workbench.editors.live.uses.description': 'Valori pe care acest pas le citește din capturi anterioare.',
  'workbench.editors.live.uses.none': 'Niciuna. Acest pas nu citește valori capturate de alți pași.',
  'workbench.editors.live.uses.colValue': 'Valoare',
  'workbench.editors.live.uses.colUsedIn': 'Folosită în',
  'workbench.editors.live.uses.goToStep': 'Mergi la pas',
  'workbench.editors.live.priority.description': 'Contează doar când mai mulți pași sunt gata în același timp.',
  'workbench.editors.live.priority.rule': 'Valoarea cea mai mică rulează prima. Valorile lipsă ajung ultimele.',
  'workbench.editors.live.priority.fromStep': 'Valoare din pasul',
  'workbench.editors.live.priority.capture': 'Captură',
  'workbench.editors.live.priority.compareAs': 'Compară ca',
  'workbench.editors.live.priority.none': 'Niciuna',
  'workbench.editors.live.step.removeCaptureAria': 'Eliminare captură {name}',
  'workbench.editors.live.step.exposeAria': 'Expunere captură {name} ca variabilă Live',
  'workbench.editors.live.step.exposeAs': 'Expunere ca',
  'workbench.editors.live.step.exposeTooltip':
    'Când este activat, salvarea fluxului de lucru creează o variabilă Live care rezolvă `{{live.<name>}}` din această captură. Dezactivați pentru a folosi captura doar în interiorul acestui flux de lucru (de ex. prin {{step.<stepId>.<captureName>}}).',

  // ── Step collapse sections (depends on / run condition / priority / retry / timeout / scripts) ──
  'workbench.editors.live.sections.dependsOn': 'Depinde de',
  'workbench.editors.live.sections.reset': 'Resetare',
  'workbench.editors.live.sections.runCondition': 'Condiție de rulare',
  'workbench.editors.live.sections.priority': 'Prioritate',
  'workbench.editors.live.sections.sortNumeric': 'Numeric',
  'workbench.editors.live.sections.sortLexicographic': 'Lexicografic',
  'workbench.editors.live.sections.clear': 'Golire',
  'workbench.editors.live.sections.retryPolicy': 'Politică de reîncercare',
  'workbench.editors.live.sections.backoffFixed': 'Fix',
  'workbench.editors.live.sections.backoffExponential': 'Exponențial',
  'workbench.editors.live.sections.retryOnNetwork': 'Doar erori de rețea',
  'workbench.editors.live.sections.retryOn5xx': 'Rețea + 5xx',
  'workbench.editors.live.sections.retryOn429': 'Rețea + 429',
  'workbench.editors.live.sections.retryOn4xx': 'Rețea + 4xx',
  'workbench.editors.live.sections.retryOnCustom': 'Personalizată (editată ca date)',
  'workbench.editors.live.sections.timeout': 'Timp de așteptare',
  'workbench.editors.live.sections.noTimeoutPlaceholder': 'Fără timp de așteptare',
  'workbench.editors.live.sections.successCriteria': 'Criterii de succes',
  'workbench.editors.live.criteria.noneForCall': 'Niciun criteriu — orice răspuns primit trece.',
  'workbench.editors.live.criteria.noneForExpect': 'Niciun rând — primul mesaj sosit se potrivește.',
  'workbench.editors.live.criteria.kindExists': 'Există',
  'workbench.editors.live.criteria.kindEquals': 'Este egal cu',
  'workbench.editors.live.criteria.kindMatches': 'Se potrivește cu',
  'workbench.editors.live.criteria.add': 'Adăugare criteriu',
  'workbench.editors.live.criteria.removeAria': 'Eliminare criteriu {number}',
  'workbench.editors.live.sections.poll': 'Interogare repetată',
  'workbench.editors.live.sections.attempts': 'Încercări',
  'workbench.editors.live.sections.pollWait': 'Așteptare (ms)',
  'workbench.editors.live.sections.noPollPlaceholder': 'Fără interogare',
  'workbench.editors.live.sections.retryDescription': 'Retrimite cererea când o încercare eșuează.',
  'workbench.editors.live.sections.retryInfo':
    'Un eșec de rețea se reîncearcă cât timp rămân încercări. Răspunsurile cu o stare aleasă pot fi reîncercate și ele; o eroare de extragere, niciodată.',
  'workbench.editors.live.sections.retryDelay': 'Întârziere (ms)',
  'workbench.editors.live.sections.backoff': 'Backoff',
  'workbench.editors.live.sections.retryOn': 'Reîncearcă la',
  'workbench.editors.live.sections.noRetryPlaceholder': 'Fără reîncercare',
  'workbench.editors.live.sections.timeoutDescription': 'Cât poate dura cel mult o încercare.',
  'workbench.editors.live.sections.timeoutPerAttempt': 'Per încercare (ms)',
  'workbench.editors.live.criteria.successDescription': 'Răspunsul trece când fiecare rând este îndeplinit.',
  'workbench.editors.live.sections.pollInfo': 'Retrimite cererea până când criteriile ei de succes sunt îndeplinite.',
  'workbench.editors.live.sections.scriptsTooltip':
    'Rulează la fiecare încercare a lanțului. Scripturile pasului primesc o suprafață oh.* doar în citire (oh.sendRequest și oh.variables.set sunt respinse). O eroare de script sau o aserțiune oh.test eșuată face pasul să eșueze, astfel că ultimele valori bune sunt păstrate — aserțiunile controlează ce publică acest flux de lucru. Necesită un runtime cu suport de scripturi; pe gazdele fără unul, pasul rulează fără scripturi.',

  // ── Step gate editor (run-condition clauses) ────────────────────────
  'workbench.editors.live.gate.kindStatus': 'Stare',
  'workbench.editors.live.gate.kindCaptureExists': 'Captura există',
  'workbench.editors.live.gate.kindCaptureEquals': 'Captura este egală cu',
  'workbench.editors.live.gate.kindCaptureMatches': 'Captura se potrivește',
  'workbench.editors.live.gate.kindNumericCompare': 'Comparare numerică a capturii',
  'workbench.editors.live.gate.kindInList': 'Captura în listă',
  'workbench.editors.live.gate.kindHeaderContains': 'Antetul conține',
  'workbench.editors.live.gate.futureNumericCompare': 'Compararea numerică — va veni într-o versiune viitoare.',
  'workbench.editors.live.gate.futureInList': 'Potrivirea în listă — va veni într-o versiune viitoare.',
  'workbench.editors.live.gate.futureHeaderContains': '„Antetul conține” — va veni într-o versiune viitoare.',
  'workbench.editors.live.gate.status2xx': '2xx (orice succes)',
  'workbench.editors.live.gate.status3xx': '3xx (redirecționare)',
  'workbench.editors.live.gate.status4xx': '4xx (eroare client)',
  'workbench.editors.live.gate.status5xx': '5xx (eroare server)',
  'workbench.editors.live.gate.statusEquals': 'egal cu…',
  'workbench.editors.live.gate.statusNotEquals': 'diferit de…',
  'workbench.editors.live.gate.statusOneOf': 'unul dintre…',
  'workbench.editors.live.gate.allAnd': 'Toate (AND)',
  'workbench.editors.live.gate.anyOr': 'Oricare (OR)',
  'workbench.editors.live.gate.orTooltip':
    'Logica OR va veni într-o versiune viitoare. Deocamdată folosiți mai mulți pași cu condiții reciproc exclusive.',
  'workbench.editors.live.gate.matchModesAria': 'Despre modurile de potrivire',
  'workbench.editors.live.gate.noConditions':
    'Nicio condiție — pasul rulează ori de câte ori i se încheie dependențele.',
  'workbench.editors.live.gate.addCondition': 'Adăugare condiție',
  'workbench.editors.live.gate.stepPlaceholder': 'Pas',
  'workbench.editors.live.gate.capturePlaceholder': 'Nume captură',
  'workbench.editors.live.gate.equalsPlaceholder': 'Valoarea de comparat',
  'workbench.editors.live.gate.removeClauseAria': 'Eliminare condiție {number}',
  'workbench.editors.live.gate.statusClassTooltip': 'Se potrivește cu orice stare din clasă (de ex. 2xx = 200-299).',

  // ── Workflow graph view ─────────────────────────────────────────────
  'workbench.editors.live.graph.lineAlways': 'mereu',
  'workbench.editors.live.graph.lineIf': 'dacă {condition}',
  'workbench.editors.live.graph.lineStatusNot': 'nu {value}',
  'workbench.editors.live.graph.lineCaptureExists': '{name} există',
  'workbench.editors.live.graph.lineCaptureMatches': '{name} se potrivește cu /{pattern}/',
  'workbench.editors.live.graph.capsuleAll': 'TOATE',
  'workbench.editors.live.graph.menuAddStep': 'Adăugare pas',
  'workbench.editors.live.graph.menuDeleteStep': 'Ștergere pas',
  'workbench.editors.live.graph.connectTitle': 'Trageți spre alt pas pentru a adăuga o dependență',
  'workbench.editors.live.graph.removeDependency': 'Eliminare dependență',
  'workbench.editors.live.graph.zoomIn': 'Mărire',
  'workbench.editors.live.graph.zoomOut': 'Micșorare',
  'workbench.editors.live.graph.recenter': 'Recentrare',
  'workbench.editors.live.graph.legendClick': 'clic',
  'workbench.editors.live.graph.legendSelect': 'selectare',
  'workbench.editors.live.graph.legendDelete': 'ștergere',
  'workbench.editors.live.graph.legendConnectKeys': 'tragere ○',
  'workbench.editors.live.graph.legendConnect': 'conectare',
  'workbench.editors.live.graph.legendRightClick': 'clic dreapta',
  'workbench.editors.live.graph.legendMenu': 'meniu',
  'workbench.editors.live.graph.legendDragBg': 'tragere fundal',
  'workbench.editors.live.graph.legendPan': 'panoramare',
  'workbench.editors.live.graph.legendScroll': 'derulare',
  'workbench.editors.live.graph.legendZoom': 'zoom',
  'workbench.editors.live.graph.requestNotFound': 'Cererea nu a fost găsită',
  'workbench.editors.live.graph.noRequestSelected': 'Nicio cerere selectată',
  'workbench.editors.live.graph.capturesPrefix': 'capturează',
  'workbench.editors.live.graph.usedByPrefix': 'folosit de',
  'workbench.editors.live.graph.kindWait': 'Așteptare',
  'workbench.editors.live.graph.legendTitle': 'Scurtături',
  'workbench.editors.live.graph.orderedBy': 'Ordine după {ref}',
  'workbench.editors.live.graph.exposedAs': 'Expus ca {{live.{name}}}',
  'workbench.editors.live.graph.exposedAsPending': 'Expus ca {{live.{name}}} — în așteptarea primei rulări',

  // ── Workflow status panel + run status strip ────────────────────────
  'workbench.editors.live.status.title': 'Starea fluxurilor de lucru',
  'workbench.editors.live.status.noEnvironment': 'Fără mediu',
  'workbench.editors.live.status.unknownEnv': 'Mediu necunoscut',
  'workbench.editors.live.status.activeSuffix': '(activ)',
  'workbench.editors.live.status.pillPaused': 'ÎN PAUZĂ',
  'workbench.editors.live.status.pillProbing': 'VERIFICARE',
  'workbench.editors.live.status.pillRetrying': 'REÎNCERCARE',
  'workbench.editors.live.status.pillHealthy': 'SĂNĂTOS',
  'workbench.editors.live.status.summaryHealthy': '{count} sănătoase',
  'workbench.editors.live.status.summaryRetrying': '{count} cu reîncercare',
  'workbench.editors.live.status.summaryProbing': '{count} în verificare',
  'workbench.editors.live.status.summaryPaused': '{count} în pauză',
  'workbench.editors.live.status.loading': 'Se încarcă…',
  'workbench.editors.live.status.empty':
    'Nicio rulare de flux de lucru încă. Creați un flux de lucru și apăsați „Reîmprospătare” pentru a popula.',
  'workbench.editors.live.status.failuresCount': 'eșecuri: {count}',
  'workbench.editors.live.status.failuresTooltip': 'Eșecuri consecutive de la ultima reîmprospătare reușită.',
  'workbench.editors.live.status.openingsCount': 'deschideri: {count}',
  'workbench.editors.live.status.openingsTooltip':
    'De câte ori a trecut circuitul în starea DESCHIS în ciclul curent. Se înjumătățește la o recuperare bine așezată în timp și scade cu unu la o recuperare recentă.',
  'workbench.editors.live.status.nextAttempt': 'următoarea încercare {countdown}',
  'workbench.editors.live.status.nextAttemptTooltip':
    'Ora reală la care va rula următoarea verificare automată. Apăsați „Reîmprospătare acum” pentru a o ocoli.',
  'workbench.editors.live.status.refreshNow': 'Reîmprospătare acum',
  'workbench.editors.live.status.resetCircuit': 'Resetare circuit',
  'workbench.editors.live.status.resetCircuitTooltip':
    'Golește contoarele de eșecuri și backoff-ul în așteptare. Nu rulează o verificare.',
  'workbench.editors.live.status.circuitReset': 'Circuit resetat',
  'workbench.editors.live.status.resetFailed': 'Resetarea a eșuat: {error}',
  'workbench.editors.live.status.dragToResize': 'Trageți pentru a redimensiona',
  'workbench.editors.live.status.boundCount': ({ count }, locale) =>
    plural(locale, Number(count), {
      one: 'legate: {count} variabilă',
      few: 'legate: {count} variabile',
      other: 'legate: {count} de variabile',
    }),
  'workbench.editors.live.status.needsReRun': 'necesită rerulare',
  'workbench.editors.live.status.needsReRunTooltip':
    'Fluxul de lucru sau o intrare pe care o rezolvă s-a schimbat de când a fost extrasă această valoare — rulați „Reîmprospătare” pentru a extrage din nou.',
  'workbench.editors.live.status.neverRunForEnv':
    'nicio rulare pentru acest mediu — apăsați „Reîmprospătare” pentru a popula',
  'workbench.editors.live.status.notRunYet': 'încă nerulat — apăsați „Reîmprospătare” pentru a rula',

  // ── Create Workflow from requests modal ─────────────────────────────
  'workbench.editors.live.fromRequests.title': 'Creare flux de lucru din „{name}”',
  'workbench.editors.live.fromRequests.createButton': ({ count }, locale) =>
    plural(locale, Number(count), {
      one: 'Creare flux de lucru ({count} pas)',
      few: 'Creare flux de lucru ({count} pași)',
      other: 'Creare flux de lucru ({count} de pași)',
    }),
  'workbench.editors.live.fromRequests.empty':
    'Acest container nu are cereri din care să se construiască un flux de lucru.',
  'workbench.editors.live.fromRequests.hint':
    'Fiecare cerere selectată devine un pas al fluxului de lucru, în ordinea afișată.',

  // ── Extractor picker (capture extraction kinds) ─────────────────────
  'workbench.editors.live.extractor.groupPlaceholder': 'grup',
  'workbench.editors.live.extractor.groupBody': 'Corp răspuns',
  'workbench.editors.live.extractor.groupResponse': 'Răspuns',
  'workbench.editors.live.extractor.wholeBody': 'Întregul corp',
  'workbench.editors.live.extractor.jsonPath': 'Cale JSON',
  'workbench.editors.live.extractor.regex': 'Expresie regulată',
  'workbench.editors.live.extractor.header': 'Antet',
  'workbench.editors.live.extractor.statusCode': 'Cod de stare',
  'workbench.editors.live.extractor.groupPayload': 'Conținut util mesaj',
  'workbench.editors.live.extractor.wholePayload': 'Întregul conținut util',
  'workbench.editors.live.extractor.groupMessage': 'Mesaj',
  'workbench.editors.live.extractor.field': 'Câmp',
} as const satisfies Catalog;
