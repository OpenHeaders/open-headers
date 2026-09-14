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
  'workbench.editors.live.workflow.viewEditor': 'Editor',
  'workbench.editors.live.workflow.viewPreview': 'Previzualizare',
  'workbench.editors.live.workflow.refresh': 'Reîmprospătare',
  'workbench.editors.live.workflow.disabledTag': 'Dezactivat',
  'workbench.editors.live.workflow.notFound': 'Fluxul de lucru nu a fost găsit.',
  'workbench.editors.live.workflow.deletedElsewhere': 'Fluxul de lucru a fost șters din altă filă',
  'workbench.editors.live.workflow.saveFailed': 'Salvarea fluxului de lucru a eșuat',
  'workbench.editors.live.workflow.createFailed': 'Crearea fluxului de lucru a eșuat',
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

  // ── Workflow step editor ────────────────────────────────────────────
  'workbench.editors.live.step.title': 'Pasul {number}',
  'workbench.editors.live.step.idPrefix': 'id',
  'workbench.editors.live.step.namePrefix': 'nume',
  'workbench.editors.live.step.typeTooltip': 'Tipul pasului — Foreach și Composite vor veni într-o versiune viitoare.',
  'workbench.editors.live.step.typeRequest': 'Cerere',
  'workbench.editors.live.step.typeForeach': 'Foreach',
  'workbench.editors.live.step.typeComposite': 'Composite',
  'workbench.editors.live.step.runsIfTag': ({ count }, locale) =>
    plural(locale, Number(count), {
      one: 'rulează dacă {count} condiție',
      few: 'rulează dacă {count} condiții',
      other: 'rulează dacă {count} de condiții',
    }),
  'workbench.editors.live.step.priorityTag': 'prioritate: {ref}',
  'workbench.editors.live.step.scriptsTag': 'scripturi',
  'workbench.editors.live.step.selectRequest': 'Selectați o cerere',
  'workbench.editors.live.step.descriptionPlaceholder': 'Descriere pas (opțional)',
  'workbench.editors.live.step.capturesHeader': 'CAPTURI ({count})',
  'workbench.editors.live.step.addCapture': '+ Captură',
  'workbench.editors.live.step.captureRequired':
    'Este necesară cel puțin o captură înainte ca o variabilă Live să se poată lega de acest pas.',
  'workbench.editors.live.step.removeCaptureAria': 'Eliminare captură {name}',
  'workbench.editors.live.step.exposeAria': 'Expunere captură {name} ca variabilă Live',
  'workbench.editors.live.step.exposeAs': 'Expunere ca',
  'workbench.editors.live.step.exposeTooltip':
    'Când este activat, salvarea fluxului de lucru creează o variabilă Live care rezolvă `{{live.<name>}}` din această captură. Dezactivați pentru a folosi captura doar în interiorul acestui flux de lucru (de ex. prin {{step.<stepId>.<captureName>}}).',
  'workbench.editors.live.step.afterChip': '↳ după {parents}',
  'workbench.editors.live.step.implicitMark': '(implicit)',
  'workbench.editors.live.step.implicitTooltip':
    'Dependență implicită de pasul anterior (niciun dependsOn explicit declarat). Setați un dependsOn explicit pentru a fixa relația.',

  // ── Step collapse sections (depends on / run condition / priority / retry / timeout / scripts) ──
  'workbench.editors.live.sections.dependsOn': 'Depinde de',
  'workbench.editors.live.sections.dependsOnImplicit': '(implicit — pasul anterior)',
  'workbench.editors.live.sections.dependsOnRoot': '(rădăcină)',
  'workbench.editors.live.sections.dependsOnPlaceholder': 'Selectați pașii strămoși — gol = pas rădăcină',
  'workbench.editors.live.sections.dependsOnImplicitHint':
    'Niciun dependsOn explicit — depinde implicit de pasul anterior în ordinea declarată.',
  'workbench.editors.live.sections.dependsOnRootHint':
    'Rădăcină explicită — rulează imediat ce pornește fluxul de lucru.',
  'workbench.editors.live.sections.useImplicit': 'Utilizare implicită',
  'workbench.editors.live.sections.waitsFor': ({ count }, locale) =>
    plural(locale, Number(count), {
      one: 'Pasul așteaptă ca {count} pas strămoș să se încheie sau să fie sărit.',
      few: 'Pasul așteaptă ca {count} pași strămoși să se încheie sau să fie săriți.',
      other: 'Pasul așteaptă ca {count} de pași strămoși să se încheie sau să fie săriți.',
    }),
  'workbench.editors.live.sections.reset': 'Resetare',
  'workbench.editors.live.sections.runCondition': 'Condiție de rulare',
  'workbench.editors.live.sections.none': '(niciuna)',
  'workbench.editors.live.sections.priority': 'Prioritate',
  'workbench.editors.live.sections.priorityStepPlaceholder': 'Pas strămoș',
  'workbench.editors.live.sections.priorityCapturePlaceholder': 'Nume captură',
  'workbench.editors.live.sections.sortNumeric': 'Numeric',
  'workbench.editors.live.sections.sortLexicographic': 'Lexicografic',
  'workbench.editors.live.sections.priorityTooltip':
    'Când mai mulți pași pot rula în continuare, primul rulează cel cu cea mai mică valoare de prioritate. Valorile lipsă se ordonează la sfârșit.',
  'workbench.editors.live.sections.clear': 'Golire',
  'workbench.editors.live.sections.retryPolicy': 'Politică de reîncercare',
  'workbench.editors.live.sections.retrySummary': '(încercări: {count})',
  'workbench.editors.live.sections.retrySummaryExponential': '(încercări: {count}, exponențial)',
  'workbench.editors.live.sections.attemptsPlaceholder': 'Încercări',
  'workbench.editors.live.sections.attemptsPrefix': 'încercări',
  'workbench.editors.live.sections.delayPrefix': 'întârziere ms',
  'workbench.editors.live.sections.backoffFixed': 'Fix',
  'workbench.editors.live.sections.backoffExponential': 'Exponențial',
  'workbench.editors.live.sections.retryOnNetwork': 'Doar erori de rețea',
  'workbench.editors.live.sections.retryOn5xx': 'Rețea + 5xx',
  'workbench.editors.live.sections.retryOn429': 'Rețea + 429',
  'workbench.editors.live.sections.retryOn4xx': 'Rețea + 4xx',
  'workbench.editors.live.sections.retryOnCustom': 'Personalizată (editată ca date)',
  'workbench.editors.live.sections.retryTooltip':
    'Eșecurile de rețea (DNS, conexiune, timp de așteptare) se reîncearcă întotdeauna cât timp rămân încercări. Adăugarea unei potriviri de stare reîncearcă și răspunsurile potrivite; erorile de extragere nu se reîncearcă niciodată. Goliți câmpul încercărilor pentru a dezactiva reîncercările.',
  'workbench.editors.live.sections.timeout': 'Timp de așteptare',
  'workbench.editors.live.sections.noTimeoutPlaceholder': 'Fără timp de așteptare',
  'workbench.editors.live.sections.timeoutTooltip':
    'Per încercare — cererea (inclusiv citirea corpului) se abandonează după acest plafon. Un pas cu reîncercări primește întregul timp de așteptare la fiecare încercare. Goliți câmpul pentru a nu avea plafon.',
  'workbench.editors.live.sections.scripts': 'Scripturi',
  'workbench.editors.live.sections.scriptsOn': '(activat)',
  'workbench.editors.live.sections.scriptsOff': '(dezactivat)',
  'workbench.editors.live.sections.runScriptsAria': 'Rulare scripturi ale cererii pe acest pas',
  'workbench.editors.live.sections.runScriptsLabel': 'Rulare scripturi pre-cerere / post-răspuns ale cererii',
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
  'workbench.editors.live.gate.conditionCount': 'condiții: {count}',
  'workbench.editors.live.gate.addCondition': 'Adăugare condiție',
  'workbench.editors.live.gate.andTag': 'AND',
  'workbench.editors.live.gate.stepPlaceholder': 'Pas',
  'workbench.editors.live.gate.capturePlaceholder': 'Nume captură',
  'workbench.editors.live.gate.equalsPlaceholder': 'Valoarea de comparat',
  'workbench.editors.live.gate.removeClauseAria': 'Eliminare condiție {number}',
  'workbench.editors.live.gate.statusClassTooltip': 'Se potrivește cu orice stare din clasă (de ex. 2xx = 200-299).',

  // ── Workflow graph view ─────────────────────────────────────────────
  'workbench.editors.live.graph.clauseStatusIs': 'starea pasului {stepId} este {value}',
  'workbench.editors.live.graph.clauseStatusIsNot': 'starea pasului {stepId} nu este {value}',
  'workbench.editors.live.graph.clauseStatusIn': 'starea pasului {stepId} în [{list}]',
  'workbench.editors.live.graph.clauseCaptureExists': 'captura {ref} există',
  'workbench.editors.live.graph.clauseCaptureMatches': 'captura {ref} se potrivește cu /{pattern}/',
  'workbench.editors.live.graph.menuAddStep': 'Adăugare pas',
  'workbench.editors.live.graph.menuEditStep': 'Editare pas',
  'workbench.editors.live.graph.menuDeleteStep': 'Ștergere pas',
  'workbench.editors.live.graph.connectTitle': 'Trageți spre alt pas pentru a adăuga o dependență',
  'workbench.editors.live.graph.removeDependency': 'Eliminare dependență',
  'workbench.editors.live.graph.zoomIn': 'Mărire',
  'workbench.editors.live.graph.zoomOut': 'Micșorare',
  'workbench.editors.live.graph.recenter': 'Recentrare',
  'workbench.editors.live.graph.legendClick': 'clic',
  'workbench.editors.live.graph.legendSelect': 'selectare',
  'workbench.editors.live.graph.legendEditKeys': '2×clic / ⏎',
  'workbench.editors.live.graph.legendEdit': 'editare',
  'workbench.editors.live.graph.legendDelete': 'ștergere',
  'workbench.editors.live.graph.legendConnectKeys': 'tragere ○',
  'workbench.editors.live.graph.legendConnect': 'conectare',
  'workbench.editors.live.graph.legendRightClick': 'clic dreapta',
  'workbench.editors.live.graph.legendMenu': 'meniu',
  'workbench.editors.live.graph.legendDragNode': 'tragere nod',
  'workbench.editors.live.graph.legendMove': 'mutare',
  'workbench.editors.live.graph.legendDragBg': 'tragere fundal',
  'workbench.editors.live.graph.legendPan': 'panoramare',
  'workbench.editors.live.graph.legendScroll': 'derulare',
  'workbench.editors.live.graph.legendZoom': 'zoom',
  'workbench.editors.live.graph.editStepInForm': 'Editare pas în formular',
  'workbench.editors.live.graph.requestNotFound': 'Cererea nu a fost găsită',
  'workbench.editors.live.graph.noRequestSelected': 'Nicio cerere selectată',
  'workbench.editors.live.graph.noCaptures': 'Nicio captură',
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

  // ── Graph run overlay ───────────────────────────────────────────────
  'workbench.editors.live.runOverlay.valuesPreserved': 'valori păstrate dintr-o rulare anterioară',
  'workbench.editors.live.runOverlay.responseBytes': 'răspuns {bytes} octeți',

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
} as const satisfies Catalog;
