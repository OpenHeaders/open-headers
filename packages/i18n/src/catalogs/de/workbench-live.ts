/**
 * Workbench live/workflows station — German. Mirrors
 * `catalogs/en/workbench-live.ts` key for key. Reuses the live
 * register shipped in de/workbench-variables + the chrome mints:
 * Refresh = Aktualisieren, Überschreibung = override, Schritt = step,
 * Bindung = binding, der Resolver, anheften = pin, Stufe = tier, and
 * the S72 Schutzschalter contract — der Schaltkreis = circuit, der
 * Schutzschalter = breaker, with the manual actions **Wiederholen**
 * (Retry/Refresh now) and **Schaltkreis zurücksetzen** (Reset
 * circuit) quoted from the chrome dashboard mint. `Workflow` and
 * `Backoff` stay dev loanwords (m.), `Live` rides raw, capture = die
 * Erfassung (panel-docs mint). MINTS: probe = sondieren / die
 * Sondierung; lead = der Vorlauf; Freigeben = expose. Technical
 * plane stays raw inside keyed sentences: `{{live.NAME}}` syntax,
 * policy kind ids (expires-in / expires-at), `lead` / `dependsOn` /
 * oh.* field tokens, step ids / capture names, code examples, MV3,
 * AND/OR/OPEN, the `(e.g.` abbrev fragment (S57 whole-raw), server
 * error text ({error}).
 */

import { plural } from '../../runtime';
import type { Catalog } from '../../types';

export const workbenchLive = {
  // ── live-display: circuit descriptors ───────────────────────────────
  'workbench.editors.live.circuit.idleLabel': 'Leerlauf',
  'workbench.editors.live.circuit.idleHint': 'Noch kein Cache — starte eine Aktualisierung, um ihn zu füllen.',
  'workbench.editors.live.circuit.pausedLabel': 'pausiert',
  'workbench.editors.live.circuit.pausedHint': ({ count }, locale) =>
    plural(locale, Number(count), {
      one:
        'Der Schaltkreis ist nach {count} Fehlschlag in Folge offen. Die automatische Wiederholung ist ' +
        'aufgeschoben. Klicke auf Wiederholen, um den Backoff zu umgehen.',
      other:
        'Der Schaltkreis ist nach {count} Fehlschlägen in Folge offen. Die automatische Wiederholung ist ' +
        'aufgeschoben. Klicke auf Wiederholen, um den Backoff zu umgehen.',
    }),
  'workbench.editors.live.circuit.probingLabel': 'sondiert…',
  'workbench.editors.live.circuit.probingHint':
    'Sondierungsversuch läuft — ein einziger Erfolg schließt den Schaltkreis.',
  'workbench.editors.live.circuit.retryLabel': 'Wiederholung {attempt} von 3',
  'workbench.editors.live.circuit.retryHint':
    'Wiederholungsstufe vor dem Schutzschalter — schnelle Wiederholungen mit 5–10s Backoff zwischen den ' +
    'Versuchen. Der Schaltkreis öffnet nach 3 Fehlschlägen in Folge.',
  'workbench.editors.live.circuit.healthyLabel': 'gesund',
  'workbench.editors.live.circuit.healthyHint': 'Schaltkreis geschlossen, keine jüngsten Fehlschläge.',

  // ── live-display: schedule + policy wording ─────────────────────────
  'workbench.editors.live.schedule.last': 'zuletzt {when}',
  'workbench.editors.live.schedule.manualOnly': 'nur manuelle Aktualisierung',
  'workbench.editors.live.schedule.autoRefresh': 'Auto-Aktualisierung {when}',
  'workbench.editors.live.schedule.expires': 'läuft ab {when}',
  'workbench.editors.live.policy.interval': 'alle {seconds}s',
  'workbench.editors.live.policy.expiresIn': 'expires-in aus {source} (Vorlauf {lead}s)',
  'workbench.editors.live.policy.expiresAt': 'expires-at aus {source} (Vorlauf {lead}s)',
  'workbench.editors.live.policy.manual': 'manuelle Aktualisierung',

  // ── live-display: per-step run states ───────────────────────────────
  'workbench.editors.live.stepRun.completed': 'Beim letzten Lauf abgeschlossen',
  'workbench.editors.live.stepRun.failed': 'Der letzte Lauf schlug an diesem Schritt fehl',
  'workbench.editors.live.stepRun.extractFailed': 'Abgerufen, aber ein Erfassungs-Extraktor hat nicht gepasst',
  'workbench.editors.live.stepRun.skipped': 'Beim letzten Lauf durch seine Laufbedingung übersprungen',
  'workbench.editors.live.stepRun.notRun': 'Noch nicht Teil eines erfolgreichen Laufs',
  'workbench.editors.live.maskEmpty': '(leer)',

  // ── Shared live form chrome (live/layout) ───────────────────────────
  'workbench.editors.live.form.namePlaceholder': 'Name',
  'workbench.editors.live.form.descriptionPlaceholder': 'Beschreibung (optional)',

  // ── Live-variable editor: edit mode ─────────────────────────────────
  'workbench.editors.live.variable.sourceNotFound': 'Quelle nicht gefunden.',
  'workbench.editors.live.variable.liveTag': 'Live',
  'workbench.editors.live.variable.disabledTag': 'Deaktiviert',
  'workbench.editors.live.variable.overrideTag': 'Überschreibung',
  'workbench.editors.live.variable.refresh': 'Aktualisieren',
  'workbench.editors.live.variable.valueLabel': 'Wert',
  'workbench.editors.live.variable.neverRefreshed': '(nie aktualisiert)',
  'workbench.editors.live.variable.nameLabel': 'Name',
  'workbench.editors.live.variable.nameHint': 'Referenziere sie als {{live.NAME}}',
  'workbench.editors.live.variable.descriptionLabel': 'Beschreibung',
  'workbench.editors.live.variable.bindingSection': 'Bindung',
  'workbench.editors.live.variable.workflowLabel': 'Workflow',
  'workbench.editors.live.variable.stepLabel': 'Schritt',
  'workbench.editors.live.variable.captureLabel': 'Erfassung',
  'workbench.editors.live.variable.selectWorkflow': 'Wähle einen Workflow',
  'workbench.editors.live.variable.selectStep': 'Wähle einen Schritt',
  'workbench.editors.live.variable.selectCapture': 'Wähle eine Erfassung',
  'workbench.editors.live.variable.stepOption': '{id} ({count} Erfassungen)',
  'workbench.editors.live.variable.openFlow': 'Workflow öffnen',
  'workbench.editors.live.variable.overrideSection': 'Manuelle Überschreibung',
  'workbench.editors.live.variable.overrideValuePlaceholder': 'Fester Überschreibungswert',
  'workbench.editors.live.variable.overrideExpiresLabel': 'Läuft ab (ms)',
  'workbench.editors.live.variable.overrideExpiresHint':
    'Epoch in ms (Echtzeit) — leer lassen für eine dauerhafte Überschreibung',
  'workbench.editors.live.variable.applyOverride': 'Überschreibung anwenden',
  'workbench.editors.live.variable.clearOverride': 'Leeren',
  'workbench.editors.live.variable.setOverride': 'Manuelle Überschreibung setzen',
  'workbench.editors.live.variable.overrideNote':
    'Der Resolver liefert den angehefteten Wert; der Planer aktualisiert den zugrunde liegenden Workflow weiter.',
  'workbench.editors.live.variable.deletedElsewhere': 'Die Quelle wurde in einem anderen Tab gelöscht',
  'workbench.editors.live.variable.saveFailed': 'Live-Variable konnte nicht gespeichert werden',
  'workbench.editors.live.variable.refreshFailed': 'Aktualisierung fehlgeschlagen: {error}',
  'workbench.editors.live.variable.refreshed': 'Aktualisiert',
  'workbench.editors.live.variable.overrideSaveFailed': 'Überschreibung konnte nicht gespeichert werden.',
  'workbench.editors.live.variable.overrideApplied': 'Überschreibung angewendet',
  'workbench.editors.live.variable.overrideCleared': 'Überschreibung geleert',

  // ── Live-variable editor: create mode ───────────────────────────────
  'workbench.editors.live.create.title': 'Neue Live-Variable',
  'workbench.editors.live.create.namePlaceholder': 'Name (z. B. accessToken)',
  'workbench.editors.live.create.referenceAs': 'Referenziere sie als {{live.{name}}}',
  'workbench.editors.live.create.createWorkflow': 'Einen Workflow erstellen',
  'workbench.editors.live.create.noWorkflows': 'Noch keine Workflows.',
  'workbench.editors.live.create.nameRequired': 'Ein Name ist erforderlich',
  'workbench.editors.live.create.bindingRequired': 'Wähle einen Workflow, einen Schritt und eine Erfassung',
  'workbench.editors.live.create.createFailed': 'Live-Variable konnte nicht erstellt werden',

  // ── Toggles row (Enabled / Wait for fresh value) ────────────────────
  'workbench.editors.live.toggles.enabled': 'Aktiv',
  'workbench.editors.live.toggles.enabledTooltip':
    'Wenn aus, lösen sich Referenzen auf {{live.NAME}} in Regeln und Anfragen nicht mehr auf.',
  'workbench.editors.live.toggles.waitForFresh': 'Auf frischen Wert warten',
  'workbench.editors.live.toggles.waitForFreshTooltip':
    'Vor dem Anwenden der Regeln warten, bis der dahinterliegende Workflow eine Aktualisierung abgeschlossen ' +
    'hat (bis zu ~5s). Aus: Regeln verwenden den letzten Wert aus dem Cache, und die Aktualisierung läuft im ' +
    'Hintergrund — schneller, aber nach dem Aufwachen der Erweiterung kann der Wert kurz veraltet sein.',

  // ── Refresh-policy picker ───────────────────────────────────────────
  'workbench.editors.live.refreshPolicy.manual': 'Nur manuell',
  'workbench.editors.live.refreshPolicy.interval': 'Festes Intervall',
  'workbench.editors.live.refreshPolicy.expiresIn': 'Läuft in N Sekunden ab (relativ)',
  'workbench.editors.live.refreshPolicy.expiresAt': 'Läuft bei Epoch ms ab (absolut)',
  'workbench.editors.live.refreshPolicy.secondsUnit': 'Sekunden',
  'workbench.editors.live.refreshPolicy.leadUnit': 'Vorlauf s',
  'workbench.editors.live.refreshPolicy.selectCapture': 'Erfassung wählen',
  'workbench.editors.live.refreshPolicy.noCaptures': 'Noch keine Erfassungen definiert.',
  'workbench.editors.live.refreshPolicy.subMinuteWarning':
    'Intervalle unter einer Minute stoßen an die Alarm-Untergrenze von MV3 und verbrennen das Kontingent ' +
    'schnell. Nur wenn nötig verwenden.',
  'workbench.editors.live.refreshPolicy.expiresInHelpPrefix': 'Erfasster Wert = Sekunden bis zum Ablauf (z. B. OAuth',
  'workbench.editors.live.refreshPolicy.expiresInHelpMid': '). Die Aktualisierung feuert `lead` Sekunden vorher',
  'workbench.editors.live.refreshPolicy.expiresInHelpSuffix': '.',
  'workbench.editors.live.refreshPolicy.expiresAtHelpPrefix': 'Erfasster Wert = absolute Unix-Epoch in',
  'workbench.editors.live.refreshPolicy.expiresAtHelpMilliseconds': 'Millisekunden',
  'workbench.editors.live.refreshPolicy.expiresAtHelpMid': '(e.g.',
  'workbench.editors.live.refreshPolicy.expiresAtHelpSuffix':
    '). Die Aktualisierung feuert `lead` Sekunden vor diesem Zeitpunkt.',
  'workbench.editors.live.refreshPolicy.noCapturesWarning':
    'Füge dem Workflow zuerst eine Erfassung hinzu, damit die Ablaufrechnung eine Quelle hat.',

  // ── Workflow editor shell (LiveWorkflowEditor) ──────────────────────
  'workbench.editors.live.workflow.viewEditor': 'Editor',
  'workbench.editors.live.workflow.viewPreview': 'Vorschau',
  'workbench.editors.live.workflow.refresh': 'Aktualisieren',
  'workbench.editors.live.workflow.disabledTag': 'Deaktiviert',
  'workbench.editors.live.workflow.notFound': 'Workflow nicht gefunden.',
  'workbench.editors.live.workflow.deletedElsewhere': 'Der Workflow wurde in einem anderen Tab gelöscht',
  'workbench.editors.live.workflow.saveFailed': 'Workflow konnte nicht gespeichert werden',
  'workbench.editors.live.workflow.createFailed': 'Workflow konnte nicht erstellt werden',
  'workbench.editors.live.workflow.refreshed': 'Aktualisiert',
  'workbench.editors.live.workflow.refreshFailed': 'Aktualisierung fehlgeschlagen: {error}',
  'workbench.editors.live.workflow.defaultName': 'Workflow',
  'workbench.editors.live.workflow.newDraftName': 'Neuer Workflow',

  // ── Workflow form body ──────────────────────────────────────────────
  'workbench.editors.live.form.structuralIssues': 'Der Workflow hat strukturelle Probleme',
  'workbench.editors.live.form.stepsTitle': 'Schritte ({count})',
  'workbench.editors.live.form.addStepButton': 'Schritt',
  'workbench.editors.live.form.noSteps':
    'Noch keine Schritte — füge einen hinzu, um eine Anfrage + Extraktion in diesen Workflow einzubinden.',
  'workbench.editors.live.form.enabledAria': 'Workflow aktiv',
  'workbench.editors.live.form.enabled': 'Aktiv',
  'workbench.editors.live.form.disabled': 'Deaktiviert',
  'workbench.editors.live.form.parallelLabel': 'Unabhängige Schritte parallel ausführen',
  'workbench.editors.live.form.parallelTooltip':
    'In v1 nur sequenziell. Parallele Ausführung kommt in einer künftigen Version.',
  'workbench.editors.live.form.refreshPolicySection': 'Aktualisierungsrichtlinie',

  // ── Workflow step editor ────────────────────────────────────────────
  'workbench.editors.live.step.title': 'Schritt {number}',
  'workbench.editors.live.step.idPrefix': 'id',
  'workbench.editors.live.step.namePrefix': 'Name',
  'workbench.editors.live.step.typeTooltip': 'Schritt-Typ — Foreach und Composite kommen in einer künftigen Version.',
  'workbench.editors.live.step.typeRequest': 'Anfrage',
  'workbench.editors.live.step.typeForeach': 'Foreach',
  'workbench.editors.live.step.typeComposite': 'Composite',
  'workbench.editors.live.step.runsIfTag': ({ count }, locale) =>
    plural(locale, Number(count), {
      one: 'läuft bei {count} Bedingung',
      other: 'läuft bei {count} Bedingungen',
    }),
  'workbench.editors.live.step.priorityTag': 'Priorität: {ref}',
  'workbench.editors.live.step.scriptsTag': 'Scripts',
  'workbench.editors.live.step.selectRequest': 'Wähle eine Anfrage',
  'workbench.editors.live.step.descriptionPlaceholder': 'Optionale Schrittbeschreibung',
  'workbench.editors.live.step.capturesHeader': 'ERFASSUNGEN ({count})',
  'workbench.editors.live.step.addCapture': '+ Erfassung',
  'workbench.editors.live.step.captureRequired':
    'Mindestens eine Erfassung ist nötig, bevor sich eine LV an diesen Schritt binden kann.',
  'workbench.editors.live.step.removeCaptureAria': 'Erfassung {name} entfernen',
  'workbench.editors.live.step.exposeAria': 'Erfassung {name} als Live-Variable freigeben',
  'workbench.editors.live.step.exposeAs': 'Freigeben als',
  'workbench.editors.live.step.exposeTooltip':
    'Wenn an, erstellt das Speichern des Workflows eine Live-Variable, die `{{live.<name>}}` aus dieser ' +
    'Erfassung auflöst. Schalte es aus, um die Erfassung nur innerhalb dieses Workflows zu verwenden ' +
    '(z. B. über {{step.<stepId>.<captureName>}}).',
  'workbench.editors.live.step.afterChip': '↳ nach {parents}',
  'workbench.editors.live.step.implicitMark': '(implizit)',
  'workbench.editors.live.step.implicitTooltip':
    'Implizite Abhängigkeit vom vorherigen Schritt (kein explizites dependsOn deklariert). Setze ein ' +
    'explizites dependsOn, um die Beziehung festzuschreiben.',

  // ── Step collapse sections (depends on / run condition / priority / retry / timeout / scripts) ──
  'workbench.editors.live.sections.dependsOn': 'Hängt ab von',
  'workbench.editors.live.sections.dependsOnImplicit': '(implizit — vorheriger Schritt)',
  'workbench.editors.live.sections.dependsOnRoot': '(Wurzel)',
  'workbench.editors.live.sections.dependsOnPlaceholder': 'Wähle Vorgänger-Schritte — leer = Wurzelschritt',
  'workbench.editors.live.sections.dependsOnImplicitHint':
    'Kein explizites dependsOn — hängt implizit vom vorherigen Schritt in deklarierter Reihenfolge ab.',
  'workbench.editors.live.sections.dependsOnRootHint': 'Explizite Wurzel — läuft, sobald der Workflow startet.',
  'workbench.editors.live.sections.useImplicit': 'Implizit verwenden',
  'workbench.editors.live.sections.waitsFor': ({ count }, locale) =>
    plural(locale, Number(count), {
      one: 'Der Schritt wartet, bis {count} Vorgänger abschließt oder übersprungen wird.',
      other: 'Der Schritt wartet, bis {count} Vorgänger abschließen oder übersprungen werden.',
    }),
  'workbench.editors.live.sections.reset': 'Zurücksetzen',
  'workbench.editors.live.sections.runCondition': 'Laufbedingung',
  'workbench.editors.live.sections.none': '(keine)',
  'workbench.editors.live.sections.priority': 'Priorität',
  'workbench.editors.live.sections.priorityStepPlaceholder': 'Vorgänger-Schritt',
  'workbench.editors.live.sections.priorityCapturePlaceholder': 'Name der Erfassung',
  'workbench.editors.live.sections.sortNumeric': 'Numerisch',
  'workbench.editors.live.sections.sortLexicographic': 'Lexikografisch',
  'workbench.editors.live.sections.priorityTooltip':
    'Wenn mehrere Schritte als Nächstes laufen können, läuft der mit dem niedrigsten Prioritätswert zuerst. ' +
    'Fehlende Werte sortieren ans Ende.',
  'workbench.editors.live.sections.clear': 'Leeren',
  'workbench.editors.live.sections.retryPolicy': 'Wiederholungsrichtlinie',
  'workbench.editors.live.sections.retrySummary': '({count} Versuche)',
  'workbench.editors.live.sections.retrySummaryExponential': '({count} Versuche, exponentiell)',
  'workbench.editors.live.sections.attemptsPlaceholder': 'Versuche',
  'workbench.editors.live.sections.attemptsPrefix': 'Versuche',
  'workbench.editors.live.sections.delayPrefix': 'Verzögerung ms',
  'workbench.editors.live.sections.backoffFixed': 'Fest',
  'workbench.editors.live.sections.backoffExponential': 'Exponentiell',
  'workbench.editors.live.sections.retryOnNetwork': 'Nur Netzwerkfehler',
  'workbench.editors.live.sections.retryOn5xx': 'Netzwerk + 5xx',
  'workbench.editors.live.sections.retryOn429': 'Netzwerk + 429',
  'workbench.editors.live.sections.retryOn4xx': 'Netzwerk + 4xx',
  'workbench.editors.live.sections.retryOnCustom': 'Benutzerdefiniert (als Daten bearbeitet)',
  'workbench.editors.live.sections.retryTooltip':
    'Netzwerkfehler (DNS, Verbindung, Zeitüberschreitung) werden immer wiederholt, solange Versuche übrig ' +
    'sind. Mit einem Status-Abgleich werden auch passende Antworten wiederholt; Extraktionsfehler werden nie ' +
    'wiederholt. Leere das Versuche-Feld, um Wiederholungen zu deaktivieren.',
  'workbench.editors.live.sections.timeout': 'Zeitlimit',
  'workbench.editors.live.sections.noTimeoutPlaceholder': 'Kein Zeitlimit',
  'workbench.editors.live.sections.timeoutTooltip':
    'Pro Versuch — die Anfrage (einschließlich des Body-Lesens) bricht ab, wenn diese Obergrenze ' +
    'überschritten wird. Ein wiederholender Schritt bekommt bei jedem Versuch das volle Zeitlimit. Leere das ' +
    'Feld für keine Obergrenze.',
  'workbench.editors.live.sections.scripts': 'Scripts',
  'workbench.editors.live.sections.scriptsOn': '(an)',
  'workbench.editors.live.sections.scriptsOff': '(aus)',
  'workbench.editors.live.sections.runScriptsAria': 'Die Scripts der Anfrage in diesem Schritt ausführen',
  'workbench.editors.live.sections.runScriptsLabel': 'Die Pre-Request-/Post-Response-Scripts der Anfrage ausführen',
  'workbench.editors.live.sections.scriptsTooltip':
    'Läuft bei jedem Versuch der Kette. Schritt-Scripts erhalten eine schreibgeschützte oh.*-Oberfläche ' +
    '(oh.sendRequest und oh.variables.set werden abgelehnt). Ein Script-Fehler oder eine fehlgeschlagene ' +
    'oh.test-Assertion lässt den Schritt fehlschlagen, sodass die letzten guten Werte erhalten bleiben — ' +
    'Assertions steuern, was dieser Workflow veröffentlicht. Braucht eine Script-fähige Laufzeitumgebung; auf ' +
    'Hosts ohne eine läuft der Schritt ohne Scripts.',

  // ── Step gate editor (run-condition clauses) ────────────────────────
  'workbench.editors.live.gate.kindStatus': 'Status',
  'workbench.editors.live.gate.kindCaptureExists': 'Erfassung existiert',
  'workbench.editors.live.gate.kindCaptureEquals': 'Erfassung ist gleich',
  'workbench.editors.live.gate.kindCaptureMatches': 'Erfassung passt auf',
  'workbench.editors.live.gate.kindNumericCompare': 'Numerischer Vergleich der Erfassung',
  'workbench.editors.live.gate.kindInList': 'Erfassung in Liste',
  'workbench.editors.live.gate.kindHeaderContains': 'Header enthält',
  'workbench.editors.live.gate.futureNumericCompare': 'Numerischer Vergleich — kommt in einer künftigen Version.',
  'workbench.editors.live.gate.futureInList': 'Listen-Abgleich — kommt in einer künftigen Version.',
  'workbench.editors.live.gate.futureHeaderContains': '„Header enthält“ — kommt in einer künftigen Version.',
  'workbench.editors.live.gate.status2xx': '2xx (jeder Erfolg)',
  'workbench.editors.live.gate.status3xx': '3xx (Umleitung)',
  'workbench.editors.live.gate.status4xx': '4xx (Client-Fehler)',
  'workbench.editors.live.gate.status5xx': '5xx (Server-Fehler)',
  'workbench.editors.live.gate.statusEquals': 'gleich…',
  'workbench.editors.live.gate.statusNotEquals': 'ungleich…',
  'workbench.editors.live.gate.statusOneOf': 'einer von…',
  'workbench.editors.live.gate.allAnd': 'Alle (AND)',
  'workbench.editors.live.gate.anyOr': 'Beliebige (OR)',
  'workbench.editors.live.gate.orTooltip':
    'OR-Logik kommt in einer künftigen Version. Verwende vorerst mehrere Schritte mit sich gegenseitig ' +
    'ausschließenden Bedingungen.',
  'workbench.editors.live.gate.matchModesAria': 'Über die Abgleichmodi',
  'workbench.editors.live.gate.noConditions':
    'Keine Bedingungen — der Schritt läuft, sobald seine Abhängigkeiten abgeschlossen sind.',
  'workbench.editors.live.gate.conditionCount': '{count} Bedingung(en)',
  'workbench.editors.live.gate.addCondition': 'Bedingung hinzufügen',
  'workbench.editors.live.gate.andTag': 'AND',
  'workbench.editors.live.gate.stepPlaceholder': 'Schritt',
  'workbench.editors.live.gate.capturePlaceholder': 'Name der Erfassung',
  'workbench.editors.live.gate.equalsPlaceholder': 'Vergleichswert',
  'workbench.editors.live.gate.removeClauseAria': 'Klausel {number} entfernen',
  'workbench.editors.live.gate.statusClassTooltip': 'Passt auf jeden Status der Klasse (z. B. 2xx = 200-299).',

  // ── Workflow graph view ─────────────────────────────────────────────
  'workbench.editors.live.graph.clauseStatusIs': 'Status von {stepId} ist {value}',
  'workbench.editors.live.graph.clauseStatusIsNot': 'Status von {stepId} ist nicht {value}',
  'workbench.editors.live.graph.clauseStatusIn': 'Status von {stepId} in [{list}]',
  'workbench.editors.live.graph.clauseCaptureExists': '{ref} existiert',
  'workbench.editors.live.graph.clauseCaptureMatches': '{ref} passt auf /{pattern}/',
  'workbench.editors.live.graph.menuAddStep': 'Schritt hinzufügen',
  'workbench.editors.live.graph.menuEditStep': 'Schritt bearbeiten',
  'workbench.editors.live.graph.menuDeleteStep': 'Schritt löschen',
  'workbench.editors.live.graph.connectTitle': 'Ziehe auf einen anderen Schritt, um eine Abhängigkeit hinzuzufügen',
  'workbench.editors.live.graph.removeDependency': 'Abhängigkeit entfernen',
  'workbench.editors.live.graph.zoomIn': 'Hineinzoomen',
  'workbench.editors.live.graph.zoomOut': 'Herauszoomen',
  'workbench.editors.live.graph.recenter': 'Neu zentrieren',
  'workbench.editors.live.graph.legendClick': 'Klick',
  'workbench.editors.live.graph.legendSelect': 'auswählen',
  'workbench.editors.live.graph.legendEditKeys': '2×Klick / ⏎',
  'workbench.editors.live.graph.legendEdit': 'bearbeiten',
  'workbench.editors.live.graph.legendDelete': 'löschen',
  'workbench.editors.live.graph.legendConnectKeys': 'ziehen ○',
  'workbench.editors.live.graph.legendConnect': 'verbinden',
  'workbench.editors.live.graph.legendRightClick': 'Rechtsklick',
  'workbench.editors.live.graph.legendMenu': 'Menü',
  'workbench.editors.live.graph.legendDragNode': 'Knoten ziehen',
  'workbench.editors.live.graph.legendMove': 'bewegen',
  'workbench.editors.live.graph.legendDragBg': 'Hintergrund ziehen',
  'workbench.editors.live.graph.legendPan': 'schwenken',
  'workbench.editors.live.graph.legendScroll': 'scrollen',
  'workbench.editors.live.graph.legendZoom': 'zoomen',
  'workbench.editors.live.graph.editStepInForm': 'Schritt im Formular bearbeiten',
  'workbench.editors.live.graph.requestNotFound': 'Anfrage nicht gefunden',
  'workbench.editors.live.graph.noRequestSelected': 'Keine Anfrage ausgewählt',
  'workbench.editors.live.graph.noCaptures': 'Keine Erfassungen',
  'workbench.editors.live.graph.orderedBy': 'Geordnet nach {ref}',
  'workbench.editors.live.graph.exposedAs': 'Freigegeben als {{live.{name}}}',
  'workbench.editors.live.graph.exposedAsPending': 'Freigegeben als {{live.{name}}} — wartet auf den ersten Lauf',

  // ── Workflow status panel + run status strip ────────────────────────
  'workbench.editors.live.status.title': 'Workflow-Status',
  'workbench.editors.live.status.noEnvironment': 'Keine Umgebung',
  'workbench.editors.live.status.unknownEnv': 'Unbekannte Umgebung',
  'workbench.editors.live.status.activeSuffix': '(aktiv)',
  'workbench.editors.live.status.pillPaused': 'PAUSIERT',
  'workbench.editors.live.status.pillProbing': 'SONDIERT',
  'workbench.editors.live.status.pillRetrying': 'WIEDERHOLT',
  'workbench.editors.live.status.pillHealthy': 'GESUND',
  'workbench.editors.live.status.summaryHealthy': '{count} gesund',
  'workbench.editors.live.status.summaryRetrying': '{count} in Wiederholung',
  'workbench.editors.live.status.summaryProbing': '{count} in Sondierung',
  'workbench.editors.live.status.summaryPaused': '{count} pausiert',
  'workbench.editors.live.status.loading': 'Lädt…',
  'workbench.editors.live.status.empty':
    'Noch keine Workflow-Läufe. Erstelle einen Workflow und klicke auf Aktualisieren, um zu füllen.',
  'workbench.editors.live.status.failuresCount': 'Fehlschläge: {count}',
  'workbench.editors.live.status.failuresTooltip':
    'Aufeinanderfolgende Fehlschläge seit der letzten erfolgreichen Aktualisierung.',
  'workbench.editors.live.status.openingsCount': 'Öffnungen: {count}',
  'workbench.editors.live.status.openingsTooltip':
    'Wie oft der Schaltkreis im aktuellen Zyklus auf OPEN gewechselt ist. Halbiert sich nach einer gut ' +
    'abgelagerten Erholung, sinkt um eins nach einer frischen Erholung.',
  'workbench.editors.live.status.nextAttempt': 'nächster Versuch {countdown}',
  'workbench.editors.live.status.nextAttemptTooltip':
    'Uhrzeit, zu der die nächste automatische Sondierung läuft. Klicke auf Wiederholen, um sie zu umgehen.',
  'workbench.editors.live.status.refreshNow': 'Wiederholen',
  'workbench.editors.live.status.resetCircuit': 'Schaltkreis zurücksetzen',
  'workbench.editors.live.status.resetCircuitTooltip':
    'Leert Fehlschlag-Zähler + ausstehenden Backoff. Führt keine Sondierung aus.',
  'workbench.editors.live.status.circuitReset': 'Schaltkreis zurückgesetzt',
  'workbench.editors.live.status.resetFailed': 'Zurücksetzen fehlgeschlagen: {error}',
  'workbench.editors.live.status.dragToResize': 'Zum Anpassen der Größe ziehen',
  'workbench.editors.live.status.boundCount': ({ count }, locale) =>
    plural(locale, Number(count), {
      one: 'gebunden: {count} Variable',
      other: 'gebunden: {count} Variablen',
    }),
  'workbench.editors.live.status.needsReRun': 'erneuter Lauf nötig',
  'workbench.editors.live.status.needsReRunTooltip':
    'Der Workflow oder eine Eingabe, die er auflöst, hat sich geändert, seit dieser Wert extrahiert wurde — ' +
    'starte Aktualisieren, um neu zu extrahieren.',
  'workbench.editors.live.status.neverRunForEnv':
    'für diese Umgebung nie gelaufen — klicke auf Aktualisieren, um zu füllen',

  // ── Graph run overlay ───────────────────────────────────────────────
  'workbench.editors.live.runOverlay.valuesPreserved': 'Werte aus einem früheren Lauf erhalten',
  'workbench.editors.live.runOverlay.responseBytes': 'Antwort {bytes} Bytes',

  // ── Create Workflow from requests modal ─────────────────────────────
  'workbench.editors.live.fromRequests.title': 'Workflow aus „{name}“ erstellen',
  'workbench.editors.live.fromRequests.createButton': ({ count }, locale) =>
    plural(locale, Number(count), {
      one: 'Workflow erstellen ({count} Schritt)',
      other: 'Workflow erstellen ({count} Schritte)',
    }),
  'workbench.editors.live.fromRequests.empty':
    'Dieser Container hat keine Anfragen, aus denen sich ein Workflow bauen ließe.',
  'workbench.editors.live.fromRequests.hint':
    'Jede ausgewählte Anfrage wird ein Workflow-Schritt, in der gezeigten Reihenfolge.',

  // ── Extractor picker (capture extraction kinds) ─────────────────────
  'workbench.editors.live.extractor.groupPlaceholder': 'Gruppe',
  'workbench.editors.live.extractor.groupBody': 'Antwort-Body',
  'workbench.editors.live.extractor.groupResponse': 'Antwort',
  'workbench.editors.live.extractor.wholeBody': 'Ganzer Body',
  'workbench.editors.live.extractor.jsonPath': 'JSON-Pfad',
  'workbench.editors.live.extractor.regex': 'Regex',
  'workbench.editors.live.extractor.header': 'Header',
  'workbench.editors.live.extractor.statusCode': 'Statuscode',
} as const satisfies Catalog;
