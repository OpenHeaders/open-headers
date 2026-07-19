/**
 * Workbench Docs panel — the Variables section body — German. Mirrors
 * `catalogs/en/workbench-docs-variables.ts` key for key. `{{ns.NAME}}`
 * reference tokens ride raw as code chips composed by the section
 * body; `Vault` / `Live` / `Live Workflow` stay raw as product and
 * scope names (case follows the en key); the `string` / `TOTP` vault
 * kinds ride raw. Mints: bare reference = einfache Referenz (the
 * chrome info-popover wording, reused); ladder = die Leiter; walk =
 * der Durchlauf; shadowing = die Verschattung / verschattet; step =
 * der Schritt; die Leitung = wire (S71 mint reused). Sidebar entry
 * names quoted in prose copy the shipped
 * `de/workbench-chrome-sidebar.ts` strings verbatim
 * (Arbeitsbereich-Variablen, Live-Variablen, Umgebungen, Variablen).
 */

import type { Catalog } from '../../types';

export const workbenchDocsVariables = {
  // ── Concepts: Variables ─────────────────────────────────────────────
  'workbench.docs.body.variables.intro1Prefix':
    'Jedes Feld, das Vorlagen akzeptiert — ein Header-Wert, eine Umleitungs-URL, ein Anfrage-Body, ein ' +
    'Workflow-Schritt — kann eine Variable referenzieren mit',
  'workbench.docs.body.variables.intro1Suffix':
    '. Der Wert wird beim Verwenden eingesetzt — eine einzige Definition treibt also jede Regel, Anfrage und ' +
    'jeden Workflow an, die sie erwähnen. Variablen leben in fünf Geltungsbereichen, jeder mit seinem ' +
    'eigenen Ort in der App und seinem eigenen Rang, wenn derselbe Name in mehreren existiert.',
  'workbench.docs.body.variables.ladderCaptionPrefix': 'Eine einfache',
  'workbench.docs.body.variables.ladderCaptionSuffix':
    'durchläuft vier Geltungsbereiche von oben nach unten und stoppt beim ersten Treffer. Live und die ' +
    'anderen Geltungsbereiche mit Namensraum stehen außerhalb des Durchlaufs.',
  'workbench.docs.body.variables.scopesHeading': 'Die fünf Geltungsbereiche',
  'workbench.docs.body.variables.vaultHeading': 'Vault — Secrets, nur auf diesem Gerät',
  'workbench.docs.body.variables.vault1Prefix':
    'Der vault enthält Secrets pro Gerät: API-Schlüssel, Passwörter, TOTP-Seeds. Einträge im vault ' +
    'synchronisieren sich nie und verlassen das Gerät nie — sie bleiben außerhalb von ' +
    'Arbeitsbereich-Exporten und der Git-Historie. Es gibt zwei Arten: Einträge vom Typ',
  'workbench.docs.body.variables.vaultKindString': 'string',
  'workbench.docs.body.variables.vault1Middle': 'werden wörtlich aufgelöst, und Einträge vom Typ',
  'workbench.docs.body.variables.vaultKindTotp': 'TOTP',
  'workbench.docs.body.variables.vault1Suffix':
    'werden zum aktuellen 6–8-stelligen Code aufgelöst, der aus dem gespeicherten Seed berechnet wird — der ' +
    'Seed selbst wird nie über eine Vorlage offengelegt. Der Vault hat den höchsten Rang, ein Secret aus ' +
    'dem vault gewinnt also immer die einfache Referenz.',
  'workbench.docs.body.variables.vaultCaptionPrefix': 'Referenziere das Secret mit',
  'workbench.docs.body.variables.vaultCaptionSuffix': 'aus synchronisierten Entitäten — füge nie den rohen Wert ein.',
  'workbench.docs.body.variables.environmentHeading': 'Umgebung — umschaltbare Wertesätze',
  'workbench.docs.body.variables.environment1Prefix':
    'Umgebungen sind benannte Variablensätze, die du als Einheit wechselst —',
  'workbench.docs.body.variables.environment1Suffix':
    ', das lokale Setup eines Teamkollegen. Die aktive Umgebung wählst du im Auswahlfeld der Kopfzeile; ein ' +
    'Name, den die aktive Umgebung nicht definiert, fällt auf die Standard-Umgebung zurück, bevor der ' +
    'Durchlauf weiter nach unten geht. Ohne ausgewählte Umgebung zu arbeiten ist ein gültiger Zustand — die ' +
    'Auflösung überspringt den Geltungsbereich einfach. Zeilen lassen sich als geheim markieren, damit ihre ' +
    'Werte im Editor maskiert erscheinen.',
  'workbench.docs.body.variables.environmentCaption':
    'Ein Name, ein Wert pro Stufe — wechsle die Umgebung, statt Regeln zu duplizieren.',
  'workbench.docs.body.variables.collectionHeading': 'Sammlung — begrenzt auf eine Sammlung',
  'workbench.docs.body.variables.collection1':
    'Sammlungsvariablen werden auf einer Sammlung definiert und lösen sich nur für die Regeln und Anfragen ' +
    'auf, die zu ihr gehören. Sie sind der richtige Ort für Werte, die für eine API gelten, aber nicht für ' +
    'den ganzen Arbeitsbereich — eine Basis-URL, eine Tenant-ID, ein Versionspräfix.',
  'workbench.docs.body.variables.collectionCaption':
    'Sammlungsvariablen lösen sich nur innerhalb ihrer eigenen Sammlung auf — anderswo geht der Durchlauf ' +
    'an ihnen vorbei.',
  'workbench.docs.body.variables.workspaceHeading': 'Arbeitsbereich — mit allen geteilt',
  'workbench.docs.body.variables.workspace1':
    'Arbeitsbereich-Variablen sind die Globalen des ganzen Arbeitsbereichs — sichtbar für jede Regel, ' +
    'Anfrage und jeden Workflow und mit dem Arbeitsbereich synchronisiert. Sie haben den niedrigsten Rang ' +
    'und sind damit die natürliche Basisschicht: Lege den gemeinsamen Wert hier ab und lass eine Umgebung ' +
    'oder Sammlung ihn dort überschreiben, wo es nötig ist.',
  'workbench.docs.body.variables.workspaceCaption':
    'Die Basisschicht — für Werte, die überall gelten. Nicht für Secrets, nicht für Werte pro Stufe.',
  'workbench.docs.body.variables.liveHeading': 'Live — veröffentlicht von einem Workflow-Lauf',
  'workbench.docs.body.variables.live1Prefix':
    'Eine Live-Variable wird von einem Live Workflow getragen — einer Kette von Anfragen, die sich ' +
    'anmeldet, einen Token holt und einen erfassten Wert offenlegt. Das Speichern des Workflows aktiviert ' +
    'ihn; ein erfolgreicher Lauf (manuell oder geplant) veröffentlicht den offengelegten Wert, und die ' +
    'automatische Aktualisierung führt den Workflow erneut aus, um ihn frisch zu halten. Live-Werte sind ' +
    'nur erreichbar als',
  'workbench.docs.body.variables.live1Suffix':
    '— nie über eine einfache Referenz — damit eine Regelvorlage nicht stillschweigend einen Wert mitten in ' +
    'einer Aktualisierung aufgreift, wenn eine Arbeitsbereich- oder Umgebungsvariable denselben Namen ' +
    'trägt. Das Bearbeiten des Rezepts im Workflow markiert den veröffentlichten Wert bis zum nächsten Lauf ' +
    'als veraltet.',
  'workbench.docs.body.variables.liveRefCaptionPrefix': 'Immer mit Präfix —',
  'workbench.docs.body.variables.liveRefCaptionSuffix':
    '— und immer von einem Workflow getragen, nie ein eingefügter Token.',
  'workbench.docs.body.variables.liveLifecycleCaptionPrefix':
    'Lauf gelingt → die offengelegte Erfassung wird veröffentlicht als',
  'workbench.docs.body.variables.liveLifecycleCaptionSuffix':
    '→ Regeln und Anfragen konsumieren sie. Der Zeitplan führt den Workflow erneut aus.',
  'workbench.docs.body.variables.priorityHeading': 'Priorität und Verschattung',
  'workbench.docs.body.variables.priority1Prefix': 'Eine einfache',
  'workbench.docs.body.variables.priority1Suffix':
    'löst sich in strikter Reihenfolge durch die vier echten Geltungsbereiche auf — vault, dann die aktive ' +
    'Umgebung (mit Rückfall auf die Standard-Umgebung), dann die Sammlung, dann der Arbeitsbereich — und ' +
    'stoppt beim ersten Geltungsbereich, der den Namen definiert. Tiefere Definitionen existieren weiter; ' +
    'sie sind nur verschattet.',
  'workbench.docs.body.variables.shadowingCaptionPrefix':
    'Die Umgebung schlägt den Arbeitsbereich bei der einfachen Referenz;',
  'workbench.docs.body.variables.shadowingCaptionSuffix': 'liest weiterhin den verschatteten Wert.',
  'workbench.docs.body.variables.namespacePin1Prefix':
    'Jeder Geltungsbereich hat außerdem einen Namensraum, der die Auflösung an ihn bindet und die Leiter ' +
    'komplett überspringt:',
  'workbench.docs.body.variables.namespacePin1Suffix':
    '. Verwende die einfache Form für den Normalfall und die Form mit Namensraum, wenn du einen bestimmten ' +
    'Geltungsbereich meinst — unabhängig davon, was darüber definiert ist.',
  'workbench.docs.body.variables.tipTitle': 'Bewahre Secrets im vault auf',
  'workbench.docs.body.variables.tip1Prefix':
    'Regeln, Anfragen und Workflows synchronisieren sich mit dem Arbeitsbereich — der vault nicht. ' + 'Referenziere',
  'workbench.docs.body.variables.tip1Suffix':
    'aus einer synchronisierten Entität, und jedes Teammitglied liefert seinen eigenen Wert lokal; nichts ' +
    'Sensibles landet je in den geteilten Daten.',
  'workbench.docs.body.variables.rulesHeading': 'Variablen in Regeln',
  'workbench.docs.body.variables.rules1':
    'Fast jede Zeichenkette einer Regel akzeptiert Vorlagen: Bedingungswerte (Domains, URL-Muster, ' +
    'Header-Namen), Header-Werte, Umleitungs-URLs, Namen und Werte von Query-Parametern, statische ' +
    'Anfrage- und Antwort-Bodys, injizierter Code, Payloads für WS / SSE und Zugangsdaten für Basic-auth. ' +
    'Der Regel-Editor hebt jede Referenz hervor, zeigt beim Überfahren den aufgelösten Wert und meldet jede ' +
    'Referenz, die sich nicht auflöst — eine unaufgelöste Regel kann erst wirken, wenn jede Referenz einen ' +
    'Wert hat.',
  'workbench.docs.body.variables.consumersCaption':
    'Ein einziger Vorlagenwert speist alle drei Konsumentenoberflächen — eingesetzt dort, wo er jeweils gilt.',
  'workbench.docs.body.variables.dynamicNoteTitle': 'Dynamische (JS) Bodys verwenden keine Vorlagen',
  'workbench.docs.body.variables.dynamicNote1Prefix': 'Anfrage-Body- und Antwort-Regeln im Modus',
  'workbench.docs.body.variables.dynamicWord': 'dynamisch',
  'workbench.docs.body.variables.dynamicNote1Middle':
    'führen dein JavaScript aus, statt Vorlagen zu ersetzen — der Code berechnet seine Werte selbst. Nur ' +
    'Bodys im Modus',
  'workbench.docs.body.variables.staticWord': 'statisch',
  'workbench.docs.body.variables.dynamicNote1Middle2': 'nehmen an der Ersetzung mit',
  'workbench.docs.body.variables.dynamicNote1Suffix': 'teil.',
  'workbench.docs.body.variables.requestsHeading': 'Variablen in Anfragen',
  'workbench.docs.body.variables.requests1Prefix':
    'Im API-Client lösen sich URL, Query-Parameter, Header, Auth-Felder und Body beim Senden auf — ' +
    'einschließlich der Sammlungsvariablen der Sammlung, in der die Anfrage lebt. Eine Referenz, die sich ' +
    'nicht auflösen lässt, blockiert das Senden mit einem Fehler, der die fehlende Variable benennt, statt ' +
    'ein wörtliches',
  'workbench.docs.body.variables.requests1Suffix': 'auf die Leitung zu legen.',
  'workbench.docs.body.variables.workflowsHeading': 'Variablen in Workflows',
  'workbench.docs.body.variables.workflows1Prefix':
    'Jeder Schritt in einem Live Workflow löst sich wie eine Anfrage auf — plus ein zusätzlicher ' + 'Geltungsbereich:',
  'workbench.docs.body.variables.workflows1Suffix':
    'referenziert einen Wert, den ein früherer Schritt im selben Lauf erfasst hat — melde dich in Schritt 1 ' +
    'an, verwende den Sitzungstoken in Schritt 2. Schrittreferenzen existieren nur, während die Kette ' +
    'läuft; als offengelegt markierte Erfassungen sind das, was bei einem erfolgreichen Lauf als ' +
    'Live-Variablen veröffentlicht wird.',
  'workbench.docs.body.variables.namespacesHeading': 'Helfer nur mit Namensraum',
  'workbench.docs.body.variables.helpers1':
    'Drei weitere Namensräume lösen Werte auf, die gar keine gespeicherten Variablen sind.',
  'workbench.docs.body.variables.helpersDynamicMiddle': 'führt einen eingebauten Generator aus —',
  'workbench.docs.body.variables.helpersFriends':
    ', und Verwandte — und erzeugt bei jeder Auflösung einen frischen Wert: pro Senden im API-Client, pro ' +
    'Kompilierung bei statischen Regeln (der Wert ist bis zur nächsten Neukompilierung eingebacken).',
  'workbench.docs.body.variables.helpersFileMiddle': 'referenziert eine gespeicherte Datei über ihren Namen. Und',
  'workbench.docs.body.variables.helpersStepSuffix':
    ', siehe oben, hat nur innerhalb einer laufenden Workflow-Kette Bedeutung. Keiner davon nimmt am ' +
    'einfachen Durchlauf teil — sie sind nur über ihr Präfix erreichbar.',
  'workbench.docs.body.variables.inspectingHeading': 'Erstellen und inspizieren',
  'workbench.docs.body.variables.create1Prefix': 'Jeder Geltungsbereich wird aus der Seitenleiste erstellt:',
  'workbench.docs.body.variables.sidebarVault': 'Vault',
  'workbench.docs.body.variables.sidebarWorkspaceVars': 'Arbeitsbereich-Variablen',
  'workbench.docs.body.variables.createAnd': ' und',
  'workbench.docs.body.variables.sidebarLiveVars': 'Live-Variablen',
  'workbench.docs.body.variables.create1Middle':
    'sind Einträge auf oberster Ebene; Umgebungen werden hinzugefügt unter',
  'workbench.docs.body.variables.sidebarEnvironments': 'Umgebungen',
  'workbench.docs.body.variables.create1Middle2': '; und jede Sammlung trägt',
  'workbench.docs.body.variables.sidebarVariables': 'Variablen',
  'workbench.docs.body.variables.create1Suffix': 'als eigene Seite.',
  'workbench.docs.body.variables.creationMapCaption':
    'Jeder Variablen-Ort in der Seitenleiste, annotiert mit dem Namensraum, den er speist.',
  'workbench.docs.body.variables.inspect1Prefix': 'Das Werkzeugfenster',
  'workbench.docs.body.variables.inspect1Middle': 'ist die Inspektionsoberfläche.',
  'workbench.docs.body.variables.inScopeLabel': 'Im Geltungsbereich',
  'workbench.docs.body.variables.inspect1Middle2':
    'listet die Variablen, die die fokussierte Regel, Anfrage oder Vorlage tatsächlich referenziert — jede ' +
    'über die volle Leiter aufgelöst, sodass du genau den Wert siehst, der gelten wird.',
  'workbench.docs.body.variables.allScopesLabel': 'Alle Geltungsbereiche',
  'workbench.docs.body.variables.inspect1Middle3':
    'listet alles, was irgendwo definiert ist, gruppiert nach Priorität. In jedem Feld, das Vorlagen ' +
    'akzeptiert, öffnet das Tippen von',
  'workbench.docs.body.variables.inspect1Suffix':
    'die Vorschlagsliste mit jedem auflösbaren Namen, und das Überfahren einer Referenz zeigt ihren ' +
    'aufgelösten Wert und den gewinnenden Geltungsbereich.',
} as const satisfies Catalog;
