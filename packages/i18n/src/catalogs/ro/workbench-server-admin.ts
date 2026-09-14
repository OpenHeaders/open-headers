/**
 * Daemon-admin family — Romanian. Mirrors
 * `catalogs/en/workbench-server-admin.ts` key for key. Raw by design
 * inside keyed sentences: capability ids (`daemon.admin`), admission
 * status enum values and audit `reason` strings ({status} / {reason}
 * holes carry server data), license ids ({id}), the `oh-license.` key
 * prefix, `IdP` / `SSO` / `JSONL` / `Git` vocabulary with head nouns
 * (Sesiuni SSO, autentificare SSO, Export JSONL, e-mail Git), and the
 * ` · ` separator glyphs. Quotes the shipped ro mints: Administrare
 * server / pista de audit = the audit trail (workbench-chrome's tool
 * window info), Administrator / Operator de server / Membru /
 * proprietar al spațiului de lucru / acordare de acces = grant /
 * furnizorul de identitate / cont de serviciu (the members placeholder
 * — workbench-chrome-workspace), loc = seat / nivel = tier / nivelul
 * gratuit / revocare = revoke / emitere = mint / Dispozitive asociate /
 * Sesiuni SSO (settings panes), note de lansare, Conectare = sign in,
 * Reîmprospătare. MINTS: admitere = admission (a device / user is
 * admitted — admis); loc individual = individual seat; rezervă de
 * locuri = the seat pool (pull stays the git verb, raw); absorbire =
 * absorb; Observator / Editor / Proprietar = the grant roles;
 * utilizator din director = directory user; Actor = actor (the audit
 * column — inițiator stays the request referent); Permis / Refuzat =
 * allow / deny (the audit events and the decision filter); doar
 * operatorul = operator only; planul de administrare = admin plane;
 * poarta web = the web gate (web quotes it); dezactivare = deactivate;
 * capacitate = capability; nivelul individual / de echipă = the solo /
 * team tier; build raw (build-ul). `{name}` holes ride the en aside
 * dash (`Setare parolă — {name}`); `{id}` takes a parenthesis;
 * `{limit}` / `{date}` / `{status}` take head nouns or a colon frame
 * (conturi de serviciu: {limit}; Dezactivat la {date}; are starea:
 * {status}).
 */

import type { Catalog } from '../../types';

export const workbenchServerAdmin = {
  // ── Console shell ──────────────────────────────────────────────────
  'workbench.serverAdmin.title': 'Administrare server',
  'workbench.serverAdmin.intro':
    'Utilizatorii din director se conectează cu un token legat sau prin SSO și văd exact spațiile de lucru acordate aici. Dezactivarea revocă tokenurile utilizatorului și îl deconectează imediat.',
  'workbench.serverAdmin.deniedDescription': 'Administrarea acestui server necesită capacitatea daemon.admin.',
  'workbench.serverAdmin.cancel': 'Anulare',

  // ── Server admin panel (the administration nav — one row per
  //    domain, each opening its own slim tab) ─────────────────────────
  'workbench.serverAdmin.panel.users': 'Utilizatori',
  'workbench.serverAdmin.panel.usersHint': 'Director, roluri și acces la spațiile de lucru',
  'workbench.serverAdmin.panel.devices': 'Dispozitive asociate',
  'workbench.serverAdmin.panel.devicesHint': 'Tokenuri, asociere și sesiuni conectate',
  'workbench.serverAdmin.panel.git': 'Git',
  'workbench.serverAdmin.panel.gitHint': 'Legarea spațiilor de lucru de pe server de depozite',
  'workbench.serverAdmin.panel.audit': 'Audit',
  'workbench.serverAdmin.panel.auditHint': 'Interogarea pistei de audit a serverului',
  'workbench.serverAdmin.panel.server': 'Server',
  'workbench.serverAdmin.panel.serverHint': 'Build, versiune și note de lansare',

  // ── Release-notes card ─────────────────────────────────────────────
  'workbench.serverAdmin.notes.sectionTitle': 'Note de lansare',
  'workbench.serverAdmin.notes.sectionHint':
    'Ce a fost livrat în build-ul de server pe care îl administrează această consolă.',
  'workbench.serverAdmin.notes.versionLine': 'Server {version}',

  // ── Users section ──────────────────────────────────────────────────
  'workbench.serverAdmin.users.sectionTitle': 'Utilizatori',
  'workbench.serverAdmin.users.sectionHint':
    'Admiteți un utilizator, apoi acordați roluri per spațiu de lucru mai jos. Adresa de e-mail leagă autentificările SSO de înregistrare.',
  'workbench.serverAdmin.users.nameRequired': 'Numele este obligatoriu',
  'workbench.serverAdmin.users.workspaceRequired': 'Acordați cel puțin un spațiu de lucru',
  'workbench.serverAdmin.users.displayNamePlaceholder': 'Nume afișat',
  'workbench.serverAdmin.users.emailPlaceholder': 'E-mail (opțional — necesar pentru SSO)',
  'workbench.serverAdmin.users.seatKeyPlaceholder': 'Cheie de loc individual (oh-license.…)',
  'workbench.serverAdmin.users.addUser': 'Adăugare utilizator',
  'workbench.serverAdmin.users.kindUser': 'Utilizator',
  'workbench.serverAdmin.users.kindService': 'Cont de serviciu',
  'workbench.serverAdmin.users.serviceExplainer':
    'Un cont de serviciu deține acordări de acces la spații de lucru și tokenuri legate pentru automatizare — nu se poate conecta niciodată și nu ocupă niciun loc. Emiteți-i tokenul în secțiunea de dispozitive de mai jos.',
  'workbench.serverAdmin.users.serviceNamePlaceholder': 'Nume cont de serviciu (de ex. CI deploy)',
  'workbench.serverAdmin.users.addService': 'Adăugare cont de serviciu',
  'workbench.serverAdmin.users.serviceTag': 'Serviciu',
  'workbench.serverAdmin.users.serviceLimit':
    'Planul gratuit permite un număr limitat de conturi de serviciu: {limit}; orice licență plătită elimină limita.',
  'workbench.serverAdmin.users.licensesSoldAt': 'Licențele se vând la',
  'workbench.serverAdmin.users.neverSeenService': 'nefolosit niciodată',
  'workbench.serverAdmin.users.seatLimit':
    'Acest server a atins limita de locuri. Adăugați locuri la licența de echipă sau lipiți mai sus cheia de loc individual a utilizatorului care se alătură — îl admite fără a folosi un loc din rezervă.',
  'workbench.serverAdmin.users.seatsSoldAt': 'Locurile individuale se vând la',
  'workbench.serverAdmin.users.emptyDirectory':
    'Niciun utilizator în director încă — serverul rulează la nivelul individual. Adăugați un utilizator pentru a deschide nivelul de echipă.',
  'workbench.serverAdmin.users.deactivatedOn': 'Dezactivat la {date}',
  'workbench.serverAdmin.users.addedOn': 'adăugat la {date}',
  'workbench.serverAdmin.users.lastSeenOn': 'văzut ultima dată la {date}',
  'workbench.serverAdmin.users.neverSeen': 'neconectat niciodată',
  'workbench.serverAdmin.users.sortByCreated': 'Cele mai noi',
  'workbench.serverAdmin.users.sortByLastSeen': 'Ultima vizită',
  'workbench.serverAdmin.users.loadFailed': 'Încărcarea directorului de utilizatori a eșuat: {message}',
  'workbench.serverAdmin.users.addFailed': 'Adăugarea utilizatorului a eșuat: {message}',

  // ── Personal-seat admission tag ────────────────────────────────────
  'workbench.serverAdmin.seat.tag': 'Loc individual',
  'workbench.serverAdmin.seat.healthyTooltip':
    'Admis prin propriul loc individual ({id}) — nu se contorizează în rezerva acestui server.',
  'workbench.serverAdmin.seat.lapsedTooltip':
    'Locul individual ({id}) are starea: {status}. Rămâne conectat — o expirare nu evacuează niciodată — dar locul nu se mai reînnoiește.',
  'workbench.serverAdmin.seat.absorbTitle': 'Absorbiți acest loc în rezervă?',
  'workbench.serverAdmin.seat.absorbDescription':
    'Utilizatorul devine un loc obișnuit din rezervă, iar licența sa individuală nu se mai reînnoiește aici. Această acțiune nu poate fi anulată.',
  'workbench.serverAdmin.seat.absorbOk': 'Absorbire',
  'workbench.serverAdmin.seat.absorbCta': 'Absorbire în rezervă',
  'workbench.serverAdmin.seat.absorbed': 'Loc absorbit în rezervă.',
  'workbench.serverAdmin.seat.absorbFailed': 'Absorbirea locului a eșuat: {message}',

  // ── Deactivation ───────────────────────────────────────────────────
  'workbench.serverAdmin.deactivate.title': 'Dezactivați acest utilizator?',
  'workbench.serverAdmin.deactivate.description':
    'Tokenurile sale sunt revocate, iar conexiunile active sunt închise. Readmiteți-l mai târziu adăugând din nou aceeași adresă de e-mail.',
  'workbench.serverAdmin.deactivate.cta': 'Dezactivare',
  'workbench.serverAdmin.deactivate.done':
    'Utilizator dezactivat. Tokenurile sale au fost revocate, iar conexiunile active închise.',
  'workbench.serverAdmin.deactivate.failed': 'Dezactivarea a eșuat: {message}',

  // ── Grants editor ──────────────────────────────────────────────────
  'workbench.serverAdmin.grants.roleViewer': 'Observator',
  'workbench.serverAdmin.grants.roleEditor': 'Editor',
  'workbench.serverAdmin.grants.roleOwner': 'Proprietar',
  'workbench.serverAdmin.grants.none': 'Niciun acces la spații de lucru încă.',
  'workbench.serverAdmin.grants.idpTooltip':
    'Acordat prin maparea furnizorului de identitate. Revocarea ține doar până când următoarea autentificare SSO o reaplică.',
  'workbench.serverAdmin.grants.workspacePlaceholder': 'Spațiu de lucru',
  'workbench.serverAdmin.grants.grantCta': 'Acordare',
  'workbench.serverAdmin.grants.everyWorkspace': 'Acordat pe fiecare spațiu de lucru.',
  'workbench.serverAdmin.grants.grantFailed': 'Acordarea a eșuat: {message}',
  'workbench.serverAdmin.grants.revokeFailed': 'Revocarea acordării a eșuat: {message}',

  // ── Password modal ─────────────────────────────────────────────────
  'workbench.serverAdmin.password.setTitle': 'Setare parolă — {name}',
  'workbench.serverAdmin.password.resetTitle': 'Resetare parolă — {name}',
  'workbench.serverAdmin.password.explainer':
    'Utilizatorul se conectează cu adresa de e-mail și această parolă la poarta web a serverului. Transmiteți-i-o direct — este stocată ca hash pe server și nu poate fi citită înapoi.',
  'workbench.serverAdmin.password.placeholder': 'Parolă nouă (minimum 8 caractere)',
  'workbench.serverAdmin.password.setCta': 'Setare parolă',
  'workbench.serverAdmin.password.resetCta': 'Resetare parolă',
  'workbench.serverAdmin.password.removeCta': 'Eliminare parolă',
  'workbench.serverAdmin.password.setDone': 'Parolă setată.',
  'workbench.serverAdmin.password.removedDone': 'Parolă eliminată.',
  'workbench.serverAdmin.password.updateFailed': 'Actualizarea parolei a eșuat: {message}',

  // ── Git email modal ────────────────────────────────────────────────
  'workbench.serverAdmin.gitEmail.setTitle': 'Setare e-mail Git — {name}',
  'workbench.serverAdmin.gitEmail.changeTitle': 'Schimbare e-mail Git — {name}',
  'workbench.serverAdmin.gitEmail.explainer':
    'Commit-urile care poartă munca acestui utilizator sunt semnate cu această adresă, ca să se lege de profilul său de pe gazda Git. Fără una, se folosește adresa din director, apoi o adresă noreply.',
  'workbench.serverAdmin.gitEmail.placeholder': 'e-mail autor commit',
  'workbench.serverAdmin.gitEmail.setCta': 'Setare e-mail Git',
  'workbench.serverAdmin.gitEmail.changeCta': 'Schimbare e-mail Git',
  'workbench.serverAdmin.gitEmail.removeCta': 'Eliminare suprascriere',
  'workbench.serverAdmin.gitEmail.setDone': 'E-mail Git setat.',
  'workbench.serverAdmin.gitEmail.removedDone': 'Suprascrierea e-mailului Git a fost eliminată.',
  'workbench.serverAdmin.gitEmail.updateFailed': 'Actualizarea e-mailului Git a eșuat: {message}',

  // ── Functional roles ───────────────────────────────────────────────
  'workbench.serverAdmin.roles.daemonAdmin': 'Administrator de server',
  'workbench.serverAdmin.roles.daemonAdminTooltip':
    'Administrează acest server: utilizatori, roluri, acordări, dispozitive și rapoarte. Nu oferă de la sine niciun acces la spații de lucru — acest utilizator vede în continuare doar spațiile de lucru acordate mai jos.',
  'workbench.serverAdmin.roles.createWorkspaces': 'Creare spații de lucru',
  'workbench.serverAdmin.roles.createWorkspacesTooltip':
    'Îi permite acestui utilizator să creeze spații de lucru noi pe server. Deține ce creează; spațiile de lucru existente au nevoie în continuare de o acordare.',
  'workbench.serverAdmin.roles.daemonAdminGranted': 'Acum este administrator de server.',
  'workbench.serverAdmin.roles.daemonAdminRevoked': 'Rolul de administrator de server a fost revocat.',
  'workbench.serverAdmin.roles.createWorkspacesGranted': 'Acum poate crea spații de lucru.',
  'workbench.serverAdmin.roles.createWorkspacesRevoked': 'Nu mai poate crea spații de lucru.',
  'workbench.serverAdmin.roles.lastAdmin':
    'acesta este singurul administrator de server — faceți mai întâi pe altcineva administrator',
  'workbench.serverAdmin.roles.updateFailed': 'Schimbarea rolului a eșuat: {message}',

  // ── Git section ────────────────────────────────────────────────────
  'workbench.serverAdmin.git.sectionTitle': 'Git',
  'workbench.serverAdmin.git.sectionHint':
    'Legați un spațiu de lucru de pe server de un depozit și conduceți de la distanță commit, pull, push și ramurile. Căile sunt pe sistemul de fișiere al serverului.',
  'workbench.serverAdmin.git.workspaceLabel': 'Spațiu de lucru',

  // ── Audit reports ──────────────────────────────────────────────────
  'workbench.serverAdmin.audit.sectionTitle': 'Rapoarte',
  'workbench.serverAdmin.audit.sectionHint':
    'Fiecare decizie de permisiune pe care o ia acest server și fiecare admitere de dispozitiv, ca pistă de audit filtrabilă. Exportul respectă filtrele active.',
  'workbench.serverAdmin.audit.capAdmission': 'Admitere (conectare)',
  'workbench.serverAdmin.audit.capAdminPlane': 'Planul de administrare',
  'workbench.serverAdmin.audit.capOperatorPlane': 'Doar operatorul',
  'workbench.serverAdmin.audit.capSsoGrant': 'Acordare SSO (mapare)',
  'workbench.serverAdmin.audit.capSsoRevoke': 'Revocare SSO (mapare)',
  'workbench.serverAdmin.audit.capSsoAdmin': 'Administrator SSO (declarat)',
  'workbench.serverAdmin.audit.capWorkspaceRead': 'Citire spațiu de lucru',
  'workbench.serverAdmin.audit.capWorkspaceWrite': 'Scriere spațiu de lucru',
  'workbench.serverAdmin.audit.capWorkspaceList': 'Listare spații de lucru',
  'workbench.serverAdmin.audit.rangeLastHour': 'Ultima oră',
  'workbench.serverAdmin.audit.rangeLast24Hours': 'Ultimele 24 de ore',
  'workbench.serverAdmin.audit.rangeLast7Days': 'Ultimele 7 zile',
  'workbench.serverAdmin.audit.rangeLast30Days': 'Ultimele 30 de zile',
  'workbench.serverAdmin.audit.colTime': 'Timp',
  'workbench.serverAdmin.audit.colEvent': 'Eveniment',
  'workbench.serverAdmin.audit.colCapability': 'Capacitate',
  'workbench.serverAdmin.audit.colWorkspace': 'Spațiu de lucru',
  'workbench.serverAdmin.audit.colActor': 'Actor',
  'workbench.serverAdmin.audit.eventAdmission': 'Admitere',
  'workbench.serverAdmin.audit.eventAdmissionRefused': 'Admitere refuzată',
  'workbench.serverAdmin.audit.eventSsoGrant': 'Acordare SSO',
  'workbench.serverAdmin.audit.eventSsoRevoke': 'Revocare SSO',
  'workbench.serverAdmin.audit.eventSsoAdmin': 'Administrator SSO',
  'workbench.serverAdmin.audit.eventAllow': 'Permis',
  'workbench.serverAdmin.audit.eventDeny': 'Refuzat',
  'workbench.serverAdmin.audit.filterActor': 'Actor',
  'workbench.serverAdmin.audit.filterCapability': 'Capacitate',
  'workbench.serverAdmin.audit.filterDecision': 'Decizie',
  'workbench.serverAdmin.audit.filterWorkspace': 'Spațiu de lucru',
  'workbench.serverAdmin.audit.filterAnyTime': 'Oricând',
  'workbench.serverAdmin.audit.decisionAllow': 'Permis',
  'workbench.serverAdmin.audit.decisionDeny': 'Refuzat',
  'workbench.serverAdmin.audit.refresh': 'Reîmprospătare',
  'workbench.serverAdmin.audit.exportJsonl': 'Export JSONL',
  'workbench.serverAdmin.audit.emptyText': 'Niciun rând de audit nu se potrivește.',
  'workbench.serverAdmin.audit.loadMore': 'Încărcare mai multe',
} as const satisfies Catalog;
