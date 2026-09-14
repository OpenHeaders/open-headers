/**
 * Workbench settings — the setting-definition corpus — Romanian.
 * Mirrors `catalogs/en/workbench-settings-defs.ts` key for key; see
 * that file for the corpus rules. Raw by design: the brand / platform
 * vocabulary (Chrome / Firefox / Edge, macOS / Windows / Linux, the
 * font names, Press Start 2P, SF Pro / SF Mono / Segoe UI / Roboto /
 * Consolas / Liberation Mono, San Francisco), the `{{env.X}}` /
 * `{{file.X}}` reference shapes, `declarativeNetRequest`, `Cache-Control:
 * no-cache`, sha256, IndexedDB, WCAG AA, proto3 / INVALID_ARGUMENT /
 * oneof / rpc, engine.io / Socket.IO, the theme variant names (Warm /
 * Cool / Rose / Sepia / Dim / Midnight / Forest / Arctic — proper
 * palette names), `Local` (the default tab name literal), Meta /
 * Option+B, U3.2. Quoted OH labels copy the shipped ro files VERBATIM:
 * the three peer-execute / desktop-watch labels copy the popup /
 * shared-components quotes („Permiteți aplicației desktop să vadă acest
 * browser”, „Permiteți browserelor acestui dispozitiv să trimită
 * cereri”, „Permiteți altor dispozitive conectate să trimită cereri”);
 * the cdpScope option labels copy `shared-chrome.ts` (Unde este deschisă
 * fereastra DevTools / Fila focalizată / Ambele); the workspaceLayout
 * options copy the `panel.ts` / chrome layout menu (Centrat (imbricat) /
 * Stânga / Dreapta / Justificat / Alăturat / Suprapus / Afișare nume
 * ferestre de instrumente / Proporțional / Compact / Suprapus /
 * Dinamic); „Această pagină” quotes the popup tab; „Dezactivare cache”
 * quotes the panel toolbar; Flux de activitate carried from the
 * chrome; „Trafic” = the desktop panel. MINTS: agent = agent; interfața
 * = the UI chrome (scalarea interfeței); memoria de derulare =
 * scrollback; alăturat / unificat = side-by-side / unified (the diff
 * layout pair); ligaturi; culoare de accent; debounce raw (Debounce
 * actualizări); Ca în sistem = Follow system; Aerisit / Compact = the
 * density pair; avertismente de umbrire = shadow warnings (umbrită
 * stays the evidence chip); nemascat = unredacted (Permiteți citiri de
 * sesiune nemascate); MERGE STRATEGIES minted here — „Adăugare ca noi”
 * / „Înlocuire” / „Omitere” — `workbench-import-export.ts` MUST reuse;
 * Încadrare text = Word Wrap with „Delimitat” = Bounded (Coloană
 * delimitată); Strategie URL pentru ciorne = Draft URL Strategy with
 * Adresă URL exactă / Substituție în cale / Doar gazda / Adresă URL
 * originală; Modul Reguli Live = Live Rules Mode; Ocolire cache HTTP =
 * Bypass HTTP Cache; jurnalul de diagnostic = the Observability log;
 * manifestul fișierelor = the files manifest; blob raw (blob-uri);
 * bucla de keep-alive = keep-alive (raw apposition — interval
 * keep-alive); soluție de rezervă offline carried; asociere = pairing
 * carried (Asociere automată, asociere verificată); gest = gesture;
 * arhiva de sesiuni = the session archive; sigilat = sealed; latura
 * surselor = Sources side; Cea mai specifică potrivire = Closest
 * match; Prima potrivire / Toate potrivirile; Valorile implicite ale
 * colecției; the update-channel rows Stabil / Beta; Doar remedieri de
 * securitate; Pachete incluse = Bundled packages.
 */

import type { Catalog } from '../../types';

export const workbenchSettingsDefs = {
  // ── Backend category defs ──────────────────────────────────────────
  'workbench.settings.def.backend.nmAutoJoin.label': 'Asociere automată',
  'workbench.settings.def.backend.nmAutoJoin.description':
    'Când aplicația desktop Open Headers rulează pe acest computer, conectarea la ea se face fără cod de asociere — aplicația desktop verifică acest browser prin sistemul de operare înainte de a acorda accesul. Dezactivați pentru a asocia doar printr-un gest explicit.',
  'workbench.settings.def.backend.nmAutoJoinProbe.label': 'Verificare în fundal',
  'workbench.settings.def.backend.nmAutoJoinProbe.description':
    'Fără nicio aplicație desktop conectată, verifică la fiecare câteva minute dacă a fost instalată una, astfel încât o instalare nouă să se conecteze singură. Dezactivați pentru a verifica doar la pornirea extensiei.',
  'workbench.settings.def.backend.requireNmIdentity.label': 'Necesită asociere verificată',
  'workbench.settings.def.backend.requireNmIdentity.description':
    'Refuză codurile de asociere și tokenurile lipite pentru aplicația desktop de pe acest computer — doar predarea verificată de sistemul de operare îi poate acorda accesul. Backend-urile la distanță nu sunt afectate. De obicei setată printr-o politică a organizației.',
  'workbench.settings.def.backend.allowDesktopWatch.label': 'Permiteți aplicației desktop să vadă acest browser',
  'workbench.settings.def.backend.allowDesktopWatch.description':
    'Permite unei aplicații desktop asociate de pe acest computer să urmărească traficul de rețea, stocarea și consola acestui browser în panoul său „Trafic”. Dezactivați pentru a păstra regulile și sincronizarea funcționale în timp ce vizualizările live ale aplicației desktop sunt refuzate politicos.',
  'workbench.settings.def.backend.bindAddress.label': 'Sincronizare cu dispozitivele din rețea',
  'workbench.settings.def.backend.bindAddress.description':
    'Permite altor computere și browsere din aceeași rețea să se conecteze la această aplicație și să îi partajeze spațiile de lucru. Dezactivată implicit — doar acest computer o poate accesa.',
  'workbench.settings.def.backend.bindAddress.option.loopback.label': 'Doar loopback (127.0.0.1)',
  'workbench.settings.def.backend.bindAddress.option.loopback.description':
    'Doar acest computer se poate conecta. Implicit.',
  'workbench.settings.def.backend.bindAddress.option.all-interfaces.label': 'Toate interfețele (LAN)',
  'workbench.settings.def.backend.bindAddress.option.all-interfaces.description':
    'Alte dispozitive din rețeaua locală se pot conecta. Necesită tokenul de autentificare din U3.2.',
  'workbench.settings.def.backend.bindPort.label': 'Port',
  'workbench.settings.def.backend.bindPort.description':
    'Portul pe care această aplicație îl deschide pentru conectarea browserelor și a altor dispozitive. Schimbați-l doar dacă altceva folosește deja portul implicit. Clienții trebuie să indice același port.',
  'workbench.settings.def.backend.serveWebApp.label': 'Servire aplicație web',
  'workbench.settings.def.backend.serveWebApp.description':
    'Servește fereastra Workbench ca pagină web pe portul backend-ului, astfel încât o filă de browser să o poată deschide direct din această aplicație — fără extensie. Oricine poate accesa portul vede poarta de conectare; pentru accesul la date este necesar în continuare un token asociat.',
  'workbench.settings.def.backend.allowLocalPeerExecute.label':
    'Permiteți browserelor acestui dispozitiv să trimită cereri',
  'workbench.settings.def.backend.allowLocalPeerExecute.description':
    'Permite browserelor asociate de pe ACEST computer să trimită cereri API prin această aplicație — extensia o folosește ca motor de cereri, așa că butonul lor Trimitere din Workbench rulează aici. Activată implicit: asocierea este consimțământul. Fiecare trimitere necesită în continuare acces de scriere la spațiul de lucru.',
  'workbench.settings.def.backend.allowRemotePeerExecute.label':
    'Permiteți altor dispozitive conectate să trimită cereri',
  'workbench.settings.def.backend.allowRemotePeerExecute.description':
    'Permite dispozitivelor asociate de pe ALTE computere să trimită cereri API prin această aplicație — butonul lor Trimitere din Workbench rulează pe acest computer, cu accesul la rețea și adresa lui. Dezactivată implicit: o decizie a operatorului, niciodată subînțeleasă prin asociere. Fiecare trimitere necesită în continuare acces de scriere la spațiul de lucru.',
  'workbench.settings.def.backend.reconnectDelayMs.label': 'Întârziere inițială',
  'workbench.settings.def.backend.reconnectDelayMs.description':
    'Cât se așteaptă (ms) înainte de prima încercare de reconectare după o deconectare.',
  'workbench.settings.def.backend.maxReconnectDelayMs.label': 'Întârziere maximă',
  'workbench.settings.def.backend.maxReconnectDelayMs.description':
    'Limita superioară (ms) a backoff-ului exponențial dintre încercările de reconectare.',
  'workbench.settings.def.backend.pingIntervalMs.label': 'Interval keep-alive',
  'workbench.settings.def.backend.pingIntervalMs.description':
    'Cât de des (ms) se trimite un ping pentru ca conexiunea WebSocket să rămână deschisă în spatele proxy-urilor stricte.',
  'workbench.settings.def.backend.showBadgeWhenDisconnected.label': 'Insignă când este deconectat',
  'workbench.settings.def.backend.showBadgeWhenDisconnected.description':
    'Afișează o insignă roșie pe pictograma din bara de instrumente când legătura cu backend-ul este căzută.',
  'workbench.settings.def.backend.offlineFallbackOrder.label': 'Ordinea gazdelor',
  'workbench.settings.def.backend.offlineFallbackOrder.description':
    'Dacă backend-ul intră offline, prima gazdă accesibilă din această listă își reîmprospătează singură acreditarea unui flux de lucru exclusiv. Gazdele se înscriu automat; trageți pentru a reordona.',

  // ── MCP category defs ──────────────────────────────────────────────
  'workbench.settings.def.mcp.enabled.label': 'Activare',
  'workbench.settings.def.mcp.enabled.description':
    'Răspunde clienților MCP pe portul backend-ului acestei aplicații. Cât timp este dezactivat, punctul final nu există. Activat, agenții cu un token de acces vă pot citi spațiile de lucru.',
  'workbench.settings.def.mcp.allowObserve.label': 'Observarea traficului',
  'workbench.settings.def.mcp.allowObserve.description':
    'Agenții pot citi traficul live din sursele pe care le capturați în panoul „Trafic”. Sursele necapturate rămân invizibile; antetele de autentificare, cookie-urile și valorile în formă de token sunt înlocuite cu marcaje stabile.',
  'workbench.settings.def.mcp.allowWrite.label': 'Instrumente de scriere',
  'workbench.settings.def.mcp.allowWrite.description':
    'Agenții pot crea, edita și șterge reguli, cereri, medii, variabile și fluxuri de lucru. Fiecare modificare ajunge în Fluxul de activitate și poate fi anulată.',
  'workbench.settings.def.mcp.allowExecute.label': 'Instrumente de execuție',
  'workbench.settings.def.mcp.allowExecute.description':
    'Agenții pot trimite cereri salvate și pot rula fluxuri de lucru — trafic de rețea real părăsește acest computer în numele lor.',
  'workbench.settings.def.mcp.allowSecrets.label': 'Dezvăluirea secretelor',
  'workbench.settings.def.mcp.allowSecrets.description':
    'Agenții pot citi valorile secretelor din vault în text clar. Cât timp este dezactivat, fiecare secret rămâne mascat.',

  // ── General category defs ──────────────────────────────────────────
  'workbench.settings.def.general.language.label': 'Limbă',
  'workbench.settings.def.general.language.description':
    'Limba de afișare a interfeței. Se aplică imediat pe fiecare suprafață deschisă — fără reîncărcare. Vocabularul tehnic (numele antetelor, metodele HTTP, termenii de protocol) rămâne în engleză în fiecare limbă.',
  'workbench.settings.def.general.language.option.auto.label': 'Ca în sistem',
  'workbench.settings.def.general.language.option.auto.description':
    'Urmează limba browserului sau a sistemului de operare',
  'workbench.settings.def.general.language.option.pseudo.description':
    'Engleză accentuată și extinsă pentru depistarea textului netradus sau trunchiat',
  'workbench.settings.def.general.confirmOnDelete.label': 'Confirmare înainte de ștergere',
  'workbench.settings.def.general.confirmOnDelete.description':
    'Afișează un dialog de confirmare înainte de ștergerea regulilor, folderelor sau colecțiilor.',
  'workbench.settings.def.general.showEmptyStateHints.label': 'Afișare sugestii pentru stările goale',
  'workbench.settings.def.general.showEmptyStateHints.description':
    'Afișează îndrumări și sfaturi în panourile goale și în zonele de familiarizare.',
  'workbench.settings.def.terminal.profiles.label': 'Profiluri',
  'workbench.settings.def.terminal.profiles.description':
    'Shell-urile cu care terminalul poate deschide o filă. Filele noi obișnuite folosesc profilul implicit; săgeata de lângă + din rândul de file alege un anumit profil.',
  'workbench.settings.def.terminal.confirmCloseRunningProcess.label':
    'Confirmare la închiderea unui proces în execuție',
  'workbench.settings.def.terminal.confirmCloseRunningProcess.description':
    'Întreabă înainte de închiderea unei file de terminal al cărei shell are încă un proces în execuție. Shell-urile inactive se închid întotdeauna fără confirmare.',
  'workbench.settings.def.terminal.startDirectory.label': 'Director de pornire',
  'workbench.settings.def.terminal.startDirectory.description':
    'Directorul în care pornesc filele noi de terminal. Un profil cu director propriu îl suprascrie; gol înseamnă directorul personal. Se aplică următoarei file pe care o deschideți.',
  'workbench.settings.def.terminal.defaultTabName.label': 'Nume implicit al filei',
  'workbench.settings.def.terminal.defaultTabName.description':
    'Numele filelor de terminal care nu au fost deschise cu un profil sau redenumite. Gol folosește „Local”. Mai multe file cu același nume rămân numerotate.',
  'workbench.settings.def.terminal.fontFamilyPreset.label': 'Font',
  'workbench.settings.def.terminal.fontFamilyPreset.description':
    'Fontul textului din terminal. Presetările fie sunt livrate cu aplicația, fie se bazează pe fonturi oferite de orice sistem de operare.',
  'workbench.settings.def.terminal.fontSize.label': 'Dimensiunea fontului',
  'workbench.settings.def.terminal.fontSize.description': 'Dimensiunea textului din terminal, în pixeli.',
  'workbench.settings.def.terminal.lineHeight.label': 'Înălțimea liniei',
  'workbench.settings.def.terminal.lineHeight.description':
    'Spațierea liniilor ca multiplu al dimensiunii fontului. 1 este spațierea naturală a fontului.',
  'workbench.settings.def.terminal.cursorStyle.label': 'Forma cursorului',
  'workbench.settings.def.terminal.cursorStyle.description': 'Cum se desenează cursorul terminalului.',
  'workbench.settings.def.terminal.cursorStyle.option.block.label': 'Bloc',
  'workbench.settings.def.terminal.cursorStyle.option.underline.label': 'Subliniere',
  'workbench.settings.def.terminal.cursorStyle.option.bar.label': 'Bară verticală',
  'workbench.settings.def.terminal.cursorBlink.label': 'Cursor clipitor',
  'workbench.settings.def.terminal.cursorBlink.description': 'Face cursorul terminalului să clipească.',
  'workbench.settings.def.terminal.minimumContrastRatio.label': 'Raport minim de contrast',
  'workbench.settings.def.terminal.minimumContrastRatio.description':
    'Ajustează culorile textului până ating acest contrast față de fundal. 1 lasă culorile neatinse; 4,5 respectă WCAG AA; 21 forțează contrastul maxim.',
  'workbench.settings.def.terminal.scrollback.label': 'Memoria de derulare',
  'workbench.settings.def.terminal.scrollback.description':
    'Câte linii păstrează terminalul deasupra ecranului vizibil. Valorile mai mari folosesc mai multă memorie per filă.',
  'workbench.settings.def.terminal.macOptionIsMeta.label': 'Folosire Option ca tastă Meta',
  'workbench.settings.def.terminal.macOptionIsMeta.description':
    'Pe macOS, tratează tasta Option ca Meta, astfel încât scurtături precum Option+B să ajungă la editarea liniei din shell în loc să tasteze caractere speciale.',
  'workbench.settings.def.terminal.copyOnSelect.label': 'Copiere la selectare',
  'workbench.settings.def.terminal.copyOnSelect.description':
    'Copiază textul selectat din terminal în clipboard imediat ce îl selectați.',
  'workbench.settings.def.terminal.hyperlinks.label': 'Evidențiere linkuri',
  'workbench.settings.def.terminal.hyperlinks.description':
    'Detectează adresele URL din ieșirea terminalului și le deschide în browser la clic.',
  'workbench.settings.def.terminal.audibleBell.label': 'Semnal sonor',
  'workbench.settings.def.terminal.audibleBell.description':
    'Redă un bip scurt când un program declanșează semnalul sonor al terminalului.',
  'workbench.settings.def.terminal.closeTabOnExit.label': 'Închidere filă la ieșirea din shell',
  'workbench.settings.def.terminal.closeTabOnExit.description':
    'Închide o filă de terminal imediat ce shell-ul ei se încheie. Dezactivată, fila rămâne deschisă cu un buton Repornire.',
  'workbench.settings.def.general.restoreTabsOnStartup.label': 'Restaurare file la pornire',
  'workbench.settings.def.general.restoreTabsOnStartup.description':
    'Redeschide filele de editor care erau deschise la sfârșitul sesiunii anterioare.',
  'workbench.settings.def.general.collectionEnvAutoSwitch.label': 'Comutare automată a mediului',
  'workbench.settings.def.general.collectionEnvAutoSwitch.description':
    'Cum se schimbă mediul activ pe măsură ce vă deplasați între colecții și entitățile din ele (reguli, cereri, foldere). Se aplică atât colecțiilor de reguli, cât și colecțiilor de cereri API. Colecțiile pot avea un mediu implicit și pot fixa o listă scurtă de medii recomandate; această setare controlează dacă acele valori implicite preiau controlul automat.',
  'workbench.settings.def.general.collectionEnvAutoSwitch.option.keep-selection.label': 'Păstrare mediu selectat',
  'workbench.settings.def.general.collectionEnvAutoSwitch.option.keep-selection.description':
    'Orice ați selectat (inclusiv niciun mediu) rămâne selectat pe măsură ce navigați între colecții și subfolderele, regulile sau cererile lor. Valoarea implicită a unei colecții se aplică doar când nu este selectat niciun mediu.',
  'workbench.settings.def.general.collectionEnvAutoSwitch.option.apply-defaults.label':
    'Aplicare valori implicite ale colecției',
  'workbench.settings.def.general.collectionEnvAutoSwitch.option.apply-defaults.description':
    'Valoarea implicită a unei colecții preia controlul cât timp sunteți în ea (sau în orice subfolder, regulă ori cerere din ea). Ultima dvs. alegere manuală este mediul de bază — restaurat de fiecare dată când părăsiți o colecție sau intrați în una fără valoare implicită. Fără memorie per colecție.',
  'workbench.settings.def.general.collectionEnvAutoSwitch.option.follow-collection.label': 'Urmărire fiecare colecție',
  'workbench.settings.def.general.collectionEnvAutoSwitch.option.follow-collection.description':
    'Deschiderea unei colecții (sau a oricărui subfolder, regulă ori cerere din ea) cu un mediu implicit comută la acea valoare implicită. Alegerile făcute în interiorul unei colecții sunt reținute pentru acea colecție. Colecțiile fără valoare implicită nu comută automat.',
  'workbench.settings.def.general.settingsOpenMode.label': 'Mod de deschidere',
  'workbench.settings.def.general.settingsOpenMode.description':
    'Cum se deschide pagina Setări când este lansată din bara de instrumente, din fereastra popup sau din paleta de comenzi.',
  'workbench.settings.def.general.settingsOpenMode.option.modal.label': 'Modal',
  'workbench.settings.def.general.settingsOpenMode.option.modal.description': 'Suprapunere centrată pe pagina curentă',
  'workbench.settings.def.general.settingsOpenMode.option.modal-maximized.label': 'Modal (maximizat)',
  'workbench.settings.def.general.settingsOpenMode.option.modal-maximized.description':
    'Suprapunere care umple cea mai mare parte a ferestrei',
  'workbench.settings.def.general.settingsOpenMode.option.tab.label': 'Filă de editor',
  'workbench.settings.def.general.settingsOpenMode.option.tab.description':
    'Se deschide ca filă de editor completă în spațiul de lucru',
  'workbench.settings.def.general.settingsShowCategoryLabels.label': 'Afișare nume categorii în bara laterală',
  'workbench.settings.def.general.settingsShowCategoryLabels.description':
    'Afișează etichete text lângă pictogramele categoriilor din bara laterală a Setărilor. Clic dreapta pe bara laterală pentru comutare. Dezactivați pentru o șină compactă doar cu pictograme.',

  // ── Appearance category defs ───────────────────────────────────────
  'workbench.settings.def.appearance.theme.label': 'Temă de culoare',
  'workbench.settings.def.appearance.theme.description': 'Controlează tema de culoare generală a aplicației.',
  'workbench.settings.def.appearance.theme.option.light.label': 'Luminoasă',
  'workbench.settings.def.appearance.theme.option.dark.label': 'Întunecată',
  'workbench.settings.def.appearance.theme.option.auto.label': 'Ca în sistem',
  'workbench.settings.def.appearance.theme.option.auto.description': 'Urmează sistemul de operare',
  'workbench.settings.def.appearance.lightVariant.label': 'Varianta luminoasă',
  'workbench.settings.def.appearance.lightVariant.description':
    'Paleta folosită când tema de culoare rezolvată este luminoasă.',
  'workbench.settings.def.appearance.lightVariant.option.default.label': 'Implicită',
  'workbench.settings.def.appearance.lightVariant.option.default.description':
    'Temă luminoasă neutră, echilibrată, pentru uz zilnic.',
  'workbench.settings.def.appearance.lightVariant.option.highContrast.label': 'Contrast ridicat',
  'workbench.settings.def.appearance.lightVariant.option.highContrast.description':
    'Lizibilitate maximă — suprafețe albe pure, text aproape negru, contrast AAA.',
  'workbench.settings.def.appearance.lightVariant.option.warm.label': 'Warm',
  'workbench.settings.def.appearance.lightVariant.option.warm.description':
    'Suprafețe ca de hârtie, cu tonuri neutre calde și un accent chihlimbar — mai odihnitoare pentru ochi în sesiunile lungi.',
  'workbench.settings.def.appearance.lightVariant.option.cool.label': 'Cool',
  'workbench.settings.def.appearance.lightVariant.option.cool.description':
    'Temă luminoasă în nuanțe de albastru-ardezie — suprafețe clare cu un accent albastru-oțel.',
  'workbench.settings.def.appearance.lightVariant.option.rose.label': 'Rose',
  'workbench.settings.def.appearance.lightVariant.option.rose.description':
    'Suprafețe roz pal cu un accent magenta — căldură blândă, fără tonul chihlimbar al variantei Warm.',
  'workbench.settings.def.appearance.lightVariant.option.sepia.label': 'Sepia',
  'workbench.settings.def.appearance.lightVariant.option.sepia.description':
    'Paletă de pergament saturat cu text maro închis — cea mai nuanțată variantă luminoasă, ideală pentru lectura îndelungată.',
  'workbench.settings.def.appearance.darkVariant.label': 'Varianta întunecată',
  'workbench.settings.def.appearance.darkVariant.description':
    'Paleta folosită când tema de culoare rezolvată este întunecată.',
  'workbench.settings.def.appearance.darkVariant.option.default.label': 'Implicită',
  'workbench.settings.def.appearance.darkVariant.option.default.description':
    'Temă întunecată neutră, echilibrată, pentru uz zilnic.',
  'workbench.settings.def.appearance.darkVariant.option.highContrast.label': 'Contrast ridicat',
  'workbench.settings.def.appearance.darkVariant.option.highContrast.description':
    'Lizibilitate maximă — suprafețe negre pure, text luminos, contrast AAA.',
  'workbench.settings.def.appearance.darkVariant.option.dim.label': 'Dim',
  'workbench.settings.def.appearance.darkVariant.option.dim.description':
    'Suprafețe moi albastru-ardezie cu strălucire redusă — mai odihnitoare pentru ochi în medii slab luminate.',
  'workbench.settings.def.appearance.darkVariant.option.midnight.label': 'Midnight',
  'workbench.settings.def.appearance.darkVariant.option.midnight.description':
    'Suprafețe bleumarin profund cu un accent albastru viu — mai bogată și mai saturată decât Dim.',
  'workbench.settings.def.appearance.darkVariant.option.forest.label': 'Forest',
  'workbench.settings.def.appearance.darkVariant.option.forest.description':
    'Suprafețe întunecate cu nuanțe de verde și un accent smarald — paletă calmă, vegetală.',
  'workbench.settings.def.appearance.darkVariant.option.arctic.label': 'Arctic',
  'workbench.settings.def.appearance.darkVariant.option.arctic.description':
    'Temă întunecată gri-albăstrui rece cu un accent cyan înghețat — mai plată și mai puțin saturată decât Dim sau Midnight.',
  'workbench.settings.def.appearance.uiScale.label': 'Scară',
  'workbench.settings.def.appearance.uiScale.description':
    'Scalează întreaga interfață — butoane, text, spațieri, controale — fără a schimba dimensiunea fontului din editor.',
  'workbench.settings.def.appearance.uiScale.option.0.7.label': 'Minusculă (70%)',
  'workbench.settings.def.appearance.uiScale.option.0.7.description':
    'Cel mai dens aspect — util în combinație cu fontul de interfață Press Start 2P, care se redă neobișnuit de înalt și de lat.',
  'workbench.settings.def.appearance.uiScale.option.0.8.label': 'Compactă (80%)',
  'workbench.settings.def.appearance.uiScale.option.0.8.description':
    'Interfață mai strânsă, care păstrează totuși ținte de clic confortabile.',
  'workbench.settings.def.appearance.uiScale.option.0.9.label': 'Mică (90%)',
  'workbench.settings.def.appearance.uiScale.option.0.9.description':
    'Puțin mai strânsă decât cea implicită — încape mai mult pe ecran.',
  'workbench.settings.def.appearance.uiScale.option.1.label': 'Normală (100%)',
  'workbench.settings.def.appearance.uiScale.option.1.description': 'Dimensiunea implicită a interfeței.',
  'workbench.settings.def.appearance.uiScale.option.1.1.label': 'Mare (110%)',
  'workbench.settings.def.appearance.uiScale.option.1.1.description': 'Puțin mărită, pentru o citire mai ușoară.',
  'workbench.settings.def.appearance.uiScale.option.1.25.label': 'Foarte mare (125%)',
  'workbench.settings.def.appearance.uiScale.option.1.25.description':
    'Scara maximă a interfeței — cea mai bună pentru accesibilitate.',
  'workbench.settings.def.appearance.fontFamilyPreset.label': 'Familie de fonturi',
  'workbench.settings.def.appearance.fontFamilyPreset.description':
    'Seturi sans-serif selecționate pentru interfața aplicației. Implicit este Inter pe Windows / Linux, pentru consecvență între platforme, și System Sans pe macOS, pentru a păstra dimensionarea optică nativă a fontului SF Pro. Fiecare opțiune este inclusă în extensie. Suprafețele de editor au propria setare de font.',
  'workbench.settings.def.appearance.fontFamilyPreset.option.inter.description':
    'Font sans de interfață inclus, proiectat pentru ecrane — se redă identic pe orice sistem de operare, așa că aplicația arată la fel pe macOS, Windows și Linux.',
  'workbench.settings.def.appearance.fontFamilyPreset.option.system.description':
    'Fontul sans de interfață implicit al sistemului de operare — San Francisco pe macOS, Segoe UI pe Windows, Roboto pe Linux. Folosiți-l dacă preferați aspectul nativ în locul consecvenței între platforme.',
  'workbench.settings.def.appearance.fontFamilyPreset.option.atkinson-hyperlegible.description':
    'Font sans proiectat pentru lizibilitate la vedere slabă — formele distinctive ale literelor reduc confuzia între caractere. Inclus — disponibil întotdeauna.',
  'workbench.settings.def.appearance.fontFamilyPreset.option.jetbrains-mono.description':
    'Interfață monospațiată, potrivită cu fontul terminalului încorporat — un aspect de instrument pentru dezvoltatori în toată interfața. Inclus — disponibil întotdeauna.',
  'workbench.settings.def.appearance.fontFamilyPreset.option.press-start-2p.description':
    'Fontul de afișare în stil pixel pe care îl livrăm cu aplicația. Inclus — disponibil întotdeauna. O alegere de amuzament: lizibil, dar înalt și lat; spațierile interfeței vor părea generoase.',
  'workbench.settings.def.appearance.density.label': 'Densitate',
  'workbench.settings.def.appearance.density.description':
    'Modul compact reduce spațierea în liste, tabele și formulare.',
  'workbench.settings.def.appearance.density.option.comfortable.label': 'Aerisit',
  'workbench.settings.def.appearance.density.option.compact.label': 'Compact',
  'workbench.settings.def.appearance.editorHeaderPosition.label': 'Poziția antetului editorului',
  'workbench.settings.def.appearance.editorHeaderPosition.description':
    'Unde își andochează fiecare editor rândul cu titlu și acțiuni (nume, comutator de activare, Salvare). Jos păstrează partea de sus a editorului mai aerisită și acțiunile principale lângă conținutul pe care îl editați.',
  'workbench.settings.def.appearance.editorHeaderPosition.option.top.label': 'Sus',
  'workbench.settings.def.appearance.editorHeaderPosition.option.top.description':
    'Plasarea clasică, deasupra conținutului editorului.',
  'workbench.settings.def.appearance.editorHeaderPosition.option.bottom.label': 'Jos',
  'workbench.settings.def.appearance.editorHeaderPosition.option.bottom.description':
    'Andocat sub conținutul editorului, deasupra barei de stare.',
  'workbench.settings.def.appearance.clockFormat.label': 'Format oră',
  'workbench.settings.def.appearance.clockFormat.description':
    'Cum se afișează marcajele de timp în aplicație (notificări, jurnale). Explicit, deoarece localizarea browserului urmează limba browserului, nu formatul regional al sistemului dvs.',
  'workbench.settings.def.appearance.clockFormat.option.24h.label': '24 de ore',
  'workbench.settings.def.appearance.clockFormat.option.12h.label': '12 ore',
  'workbench.settings.def.appearance.accentColor.label': 'Culoare de accent',
  'workbench.settings.def.appearance.accentColor.description':
    'Culoarea principală folosită pentru butoane, linkuri și evidențierile active. Se aplică doar variantelor de temă Implicită — variantele cu contrast ridicat și cele nuanțate își fixează propriul accent.',

  // ── Workspace Layout category defs ─────────────────────────────────
  'workbench.settings.def.workspaceLayout.footerShowVersion.label': 'Afișare versiune',
  'workbench.settings.def.workspaceLayout.footerShowVersion.description':
    'Afișează numărul versiunii extensiei în bara de stare a spațiului de lucru.',
  'workbench.settings.def.workspaceLayout.footerShowThemeSwitcher.label': 'Afișare comutator de temă',
  'workbench.settings.def.workspaceLayout.footerShowThemeSwitcher.description':
    'Afișează lista derulantă de temă luminoasă/întunecată/automată în bara de stare a spațiului de lucru.',
  'workbench.settings.def.workspaceLayout.topbarShowPanelToggles.label': 'Afișare comutatoare de panouri',
  'workbench.settings.def.workspaceLayout.topbarShowPanelToggles.description':
    'Afișează pictogramele de comutare a panourilor din stânga / de jos / din dreapta în bara de sus a spațiului de lucru.',
  'workbench.settings.def.workspaceLayout.topbarShowLayoutMenu.label': 'Afișare meniu de aspect',
  'workbench.settings.def.workspaceLayout.topbarShowLayoutMenu.description':
    'Afișează lista derulantă de aspect (panou inferior pe toată lățimea, etichete ale ferestrelor de instrumente, aspectul barei laterale) în bara de sus a spațiului de lucru.',
  'workbench.settings.def.workspaceLayout.bottomPanelAlignment.label': 'Alinierea panoului inferior',
  'workbench.settings.def.workspaceLayout.bottomPanelAlignment.description':
    'Unde stă panoul inferior în shell. Stânga/dreapta îl aliniază sub o bară laterală + editor; centrat îl imbrică în coloana din mijloc; justificat îl întinde pe toată fereastra.',
  'workbench.settings.def.workspaceLayout.bottomPanelAlignment.option.center.label': 'Centrat (imbricat)',
  'workbench.settings.def.workspaceLayout.bottomPanelAlignment.option.center.description':
    'Panoul inferior imbricat în coloana din mijloc',
  'workbench.settings.def.workspaceLayout.bottomPanelAlignment.option.left.label': 'Stânga',
  'workbench.settings.def.workspaceLayout.bottomPanelAlignment.option.left.description':
    'Panoul inferior se întinde sub bara laterală stângă + editor',
  'workbench.settings.def.workspaceLayout.bottomPanelAlignment.option.right.label': 'Dreapta',
  'workbench.settings.def.workspaceLayout.bottomPanelAlignment.option.right.description':
    'Panoul inferior se întinde sub editor + bara laterală dreaptă',
  'workbench.settings.def.workspaceLayout.bottomPanelAlignment.option.justify.label': 'Justificat (lățime completă)',
  'workbench.settings.def.workspaceLayout.bottomPanelAlignment.option.justify.description':
    'Panoul inferior se întinde pe toată lățimea ferestrei',
  'workbench.settings.def.workspaceLayout.bottomPanelSplit.label': 'Împărțirea panoului inferior',
  'workbench.settings.def.workspaceLayout.bottomPanelSplit.description':
    'Cum împart două docuri deschise panoul inferior: unul lângă altul sau unul deasupra celuilalt.',
  'workbench.settings.def.workspaceLayout.bottomPanelSplit.option.columns.label': 'Alăturat',
  'workbench.settings.def.workspaceLayout.bottomPanelSplit.option.columns.description':
    'Docurile inferioare stau unul lângă altul',
  'workbench.settings.def.workspaceLayout.bottomPanelSplit.option.rows.label': 'Suprapus',
  'workbench.settings.def.workspaceLayout.bottomPanelSplit.option.rows.description':
    'Docurile inferioare se așază unul deasupra celuilalt',
  'workbench.settings.def.workspaceLayout.showToolWindowLabels.label': 'Afișare nume ferestre de instrumente',
  'workbench.settings.def.workspaceLayout.showToolWindowLabels.description':
    'Afișează etichete text lângă pictogramele din bara de activități și din filele docurilor. Dezactivați pentru un shell compact doar cu pictograme.',
  'workbench.settings.def.workspaceLayout.activityBarWidthLeft.label': 'Lățimea barei de activități din stânga',
  'workbench.settings.def.workspaceLayout.activityBarWidthLeft.description':
    'Lățimea barei de activități din stânga când etichetele ferestrelor de instrumente sunt vizibile. Fixată la 36px în modul doar cu pictograme.',
  'workbench.settings.def.workspaceLayout.activityBarWidthRight.label': 'Lățimea barei de activități din dreapta',
  'workbench.settings.def.workspaceLayout.activityBarWidthRight.description':
    'Lățimea barei de activități din dreapta când etichetele ferestrelor de instrumente sunt vizibile. Fixată la 36px în modul doar cu pictograme.',
  'workbench.settings.def.workspaceLayout.sidebarLayout.label': 'Aspect bară de activități',
  'workbench.settings.def.workspaceLayout.sidebarLayout.description':
    'Cum împarte bara de activități grupurile de ferestre de instrumente de sus și de jos.',
  'workbench.settings.def.workspaceLayout.sidebarLayout.option.proportional.label': 'Proporțional',
  'workbench.settings.def.workspaceLayout.sidebarLayout.option.proportional.description':
    'Grupurile de sus și de jos împart bara de activități 50/50',
  'workbench.settings.def.workspaceLayout.sidebarLayout.option.compact.label': 'Compact',
  'workbench.settings.def.workspaceLayout.sidebarLayout.option.compact.description':
    'Grupul de sus se dimensionează după conținut; cel de jos e fixat jos',
  'workbench.settings.def.workspaceLayout.sidebarLayout.option.stacked.label': 'Suprapus',
  'workbench.settings.def.workspaceLayout.sidebarLayout.option.stacked.description':
    'Toate grupurile adunate sus, cu separatoare între ele',
  'workbench.settings.def.workspaceLayout.sidebarLayout.option.dynamic.label': 'Dinamic',
  'workbench.settings.def.workspaceLayout.sidebarLayout.option.dynamic.description':
    'Grupurile de cipuri urmează înălțimile panourilor adiacente. Docurile închise se restrâng la conținut, iar vecinii activi preiau spațiul.',

  // ── Debug mode (inspection) category defs ──────────────────────────
  'workbench.settings.def.inspection.cdpEnabled.label': 'Modul Depanare',
  'workbench.settings.def.inspection.cdpEnabled.description':
    'Inspectați și modificați cererile cu aceeași profunzime ca instrumentele pentru dezvoltatori încorporate ale browserului — încărcări de pagină, workeri și iframe-uri, nu doar fetch-urile la nivel de pagină. Cât timp este activ, browserul afișează un banner de depanare pe fiecare filă atașată; este dezactivat implicit și îl puteți activa oricând.',
  'workbench.settings.def.inspection.cdpEnabled.capabilityUnavailableHint':
    'Modul Depanare este disponibil în browserele Chrome și Edge.',
  'workbench.settings.def.inspection.cdpScope.label': 'Atașare la care file',
  'workbench.settings.def.inspection.cdpScope.description':
    'La ce file se atașează modul Depanare cât timp este activ. „Unde este deschisă fereastra DevTools” se atașează filelor de browser cu instrumentele pentru dezvoltatori deschise. „Fila focalizată” urmează fila de browser activă fără să fie nevoie de instrumente pentru dezvoltatori deschise — trecerea la o filă nouă sau la o pagină internă lasă fila anterioară atașată, fără reatașări repetate. „Ambele” le combină. Filele de browser individuale pot fi fixate și din subsol, indiferent de această alegere.',
  'workbench.settings.def.inspection.cdpScope.capabilityUnavailableHint':
    'Modul Depanare este disponibil în browserele Chrome și Edge.',
  'workbench.settings.def.inspection.cdpScope.option.devtools.label': 'Unde este deschisă fereastra DevTools',
  'workbench.settings.def.inspection.cdpScope.option.devtools.description':
    'Filele de browser cu instrumentele pentru dezvoltatori deschise.',
  'workbench.settings.def.inspection.cdpScope.option.active.label': 'Fila focalizată',
  'workbench.settings.def.inspection.cdpScope.option.active.description':
    'Fila de browser activă, urmând focalizarea — fără instrumente pentru dezvoltatori.',
  'workbench.settings.def.inspection.cdpScope.option.both.label': 'Ambele',
  'workbench.settings.def.inspection.cdpScope.option.both.description': 'Filele cu DevTools și fila focalizată.',

  // ── Traffic Monitor category defs ──────────────────────────────────
  'workbench.settings.def.trafficMonitor.captureDebugDefault.label': 'Pornire capturi cu modul Depanare',
  'workbench.settings.def.trafficMonitor.captureDebugDefault.description':
    'Capturile noi atașează depanatorul browserului pentru fidelitate completă — corpurile răspunsurilor și antetele exacte. Browserul afișează un banner de depanare pe filă. Fiecare gest de pornire poate suprascrie această setare la Avansat.',
  'workbench.settings.def.trafficMonitor.captureSaveDefault.label': 'Salvare capturi în arhivă',
  'workbench.settings.def.trafficMonitor.captureSaveDefault.description':
    'Capturile noi se înregistrează în arhiva de sesiuni criptată de pe acest computer. Fiecare gest de pornire poate suprascrie această setare la Avansat.',
  'workbench.settings.def.trafficMonitor.sessionAgentRawReads.label': 'Permiteți citiri de sesiune nemascate',
  'workbench.settings.def.trafficMonitor.sessionAgentRawReads.description':
    'Agenții conectați citesc sesiunile arhivate cu valorile reale în locul marcajelor de mascare — inclusiv antetele de autentificare, cookie-urile și valorile în formă de token. Dezactivată implicit; cât timp este activă, fiecare citire nemascată este consemnată în Fluxul de activitate.',
  'workbench.settings.def.trafficMonitor.sessionRetentionGiB.label': 'Buget de dimensiune al arhivei (GiB)',
  'workbench.settings.def.trafficMonitor.sessionRetentionGiB.description':
    'Spațiul total pe disc pentru sesiunile arhivate. Odată ce arhiva depășește bugetul, cele mai vechi sesiuni sigilate sunt eliminate primele; o sesiune care încă înregistrează nu este eliminată niciodată.',
  'workbench.settings.def.trafficMonitor.railSide.label': 'Latura surselor',
  'workbench.settings.def.trafficMonitor.railSide.description':
    'Pe ce latură a panoului Trafic stă lista de surse. Butonul de aspect din antetul panoului o comută și el.',
  'workbench.settings.def.trafficMonitor.railSide.option.left.label': 'Stânga',
  'workbench.settings.def.trafficMonitor.railSide.option.left.description':
    'Lista de surse în stânga, vizualizările de trafic în dreapta.',
  'workbench.settings.def.trafficMonitor.railSide.option.right.label': 'Dreapta',
  'workbench.settings.def.trafficMonitor.railSide.option.right.description':
    'Lista de surse în dreapta, vizualizările de trafic în stânga.',

  // ── Code Editor category defs ──────────────────────────────────────
  'workbench.settings.def.editor.fontSize.label': 'Dimensiunea fontului',
  'workbench.settings.def.editor.fontSize.description':
    'Dimensiunea fontului, în pixeli, pentru suprafețele de editor.',
  'workbench.settings.def.editor.fontFamilyPreset.label': 'Familie de fonturi',
  'workbench.settings.def.editor.fontFamilyPreset.description':
    'Seturi monospațiate selecționate pentru editor. Fiecare opțiune este inclusă în extensie — nu necesită instalare în sistem. Implicit este JetBrains Mono pe Windows / Linux, pentru consecvență între platforme, și System Mono pe macOS, pentru a păstra redarea nativă a fontului SF Mono.',
  'workbench.settings.def.editor.fontFamilyPreset.option.system.description':
    'Fontul monospațiat implicit al sistemului de operare — SF Mono pe macOS, Consolas pe Windows, Liberation Mono pe Linux.',
  'workbench.settings.def.editor.fontFamilyPreset.option.fira-code.description':
    'Font monospațiat cu ligaturi de programare. Inclus — disponibil întotdeauna.',
  'workbench.settings.def.editor.fontFamilyPreset.option.jetbrains-mono.description':
    'Font monospațiat reglat pentru editoare, cu ligaturi. Inclus — disponibil întotdeauna.',
  'workbench.settings.def.editor.fontFamilyPreset.option.cascadia-code.description':
    'Font monospațiat cu ligaturi de programare. Inclus — disponibil întotdeauna.',
  'workbench.settings.def.editor.fontFamilyPreset.option.source-code-pro.description':
    'Font monospațiat Adobe reglat pentru cod. Inclus — disponibil întotdeauna.',
  'workbench.settings.def.editor.fontFamilyPreset.option.press-start-2p.description':
    'Fontul de afișare în stil pixel pe care îl livrăm cu aplicația. Inclus — disponibil întotdeauna. O alegere de amuzament: lizibil, dar înalt și lat.',
  'workbench.settings.def.editor.fontLigatures.label': 'Ligaturi de font',
  'workbench.settings.def.editor.fontLigatures.description':
    'Activează ligaturile de programare — combină secvențe de caractere precum `=>` sau `!=` în glife unice. Necesită un font cu suport pentru ligaturi (de ex. Fira Code, JetBrains Mono).',
  'workbench.settings.def.editor.lineHeight.label': 'Înălțimea liniei',
  'workbench.settings.def.editor.lineHeight.description':
    'Înălțimea liniei din editor, în pixeli. 0 lasă editorul să aleagă o înălțime proporțională cu dimensiunea fontului; valorile de la 8 în sus sunt interpretate ca pixeli expliciți.',
  'workbench.settings.def.editor.tabSize.label': 'Dimensiunea tabului',
  'workbench.settings.def.editor.tabSize.description': 'Numărul de coloane ocupate de un caracter tab.',
  'workbench.settings.def.editor.insertSpaces.label': 'Inserare spații',
  'workbench.settings.def.editor.insertSpaces.description':
    'Inserează spații în locul caracterelor tab la apăsarea tastei Tab.',
  'workbench.settings.def.editor.wordWrap.label': 'Încadrare text',
  'workbench.settings.def.editor.wordWrap.description': 'Dacă liniile lungi se încadrează pe rândul următor în editor.',
  'workbench.settings.def.editor.wordWrap.option.off.label': 'Dezactivată',
  'workbench.settings.def.editor.wordWrap.option.on.label': 'Lățimea ferestrei',
  'workbench.settings.def.editor.wordWrap.option.bounded.label': 'Coloană delimitată',
  'workbench.settings.def.editor.wordWrapColumn.label': 'Coloana de încadrare',
  'workbench.settings.def.editor.wordWrapColumn.description':
    'Coloana la care se încadrează liniile când Încadrare text este setată la „Delimitat”.',
  'workbench.settings.def.editor.lineNumbers.label': 'Numere de linie',
  'workbench.settings.def.editor.lineNumbers.description': 'Afișează numerele de linie în marginea din stânga.',
  'workbench.settings.def.editor.renderWhitespace.label': 'Redare spații albe',
  'workbench.settings.def.editor.renderWhitespace.description': 'Redă vizual caracterele de spațiu alb.',
  'workbench.settings.def.editor.renderWhitespace.option.none.label': 'Niciunul',
  'workbench.settings.def.editor.renderWhitespace.option.boundary.label': 'Doar la margini',
  'workbench.settings.def.editor.renderWhitespace.option.all.label': 'Toate',
  'workbench.settings.def.editor.renderLineEnds.label': 'Redare sfârșituri de linie',
  'workbench.settings.def.editor.renderLineEnds.description':
    'Desenează un ¬ discret după ultimul caracter al fiecărei linii reale, astfel încât rândurile încadrate automat (număr de margine gol, indentare suspendată, fără marcaj) să nu poată fi confundate cu întreruperi de linie. Doar pentru afișare: marcajul nu este niciodată selectabil, copiat sau trimis.',
  'workbench.settings.def.editor.formatOnSave.label': 'Formatare la salvare',
  'workbench.settings.def.editor.formatOnSave.description':
    'Formatează automat conținutul editorului când salvați o regulă sau un șablon.',
  'workbench.settings.def.editor.bracketPairColorization.label': 'Colorarea perechilor de paranteze',
  'workbench.settings.def.editor.bracketPairColorization.description':
    'Evidențiază parantezele pereche în culori diferite.',

  // ── API Requests category defs ─────────────────────────────────────
  'workbench.settings.def.requests.trustedRoots.label': 'Certificatele spațiului de lucru',
  'workbench.settings.def.requests.trustedRoots.description':
    'Autoritățile de certificare în care are încredere acest spațiu de lucru pe lângă rădăcinile încorporate, aplicate fiecărei conexiuni TLS stabilite de runtime-ul aplicației. Partajate cu fiecare peer al spațiului de lucru — material public, niciodată un secret.',
  'workbench.settings.def.requests.deviceTrust.label': 'Certificatele dispozitivului',
  'workbench.settings.def.requests.deviceTrust.description':
    'Certificatele pe care acest computer le fixează pe lângă lista spațiului de lucru — un localhost autosemnat, un server de staging. Niciodată sincronizate sau exportate; aplicate fiecărei conexiuni TLS stabilite de runtime-ul aplicației de pe acest dispozitiv.',
  'workbench.settings.def.requests.systemTrust.label': 'Depozitul de încredere al sistemului',
  'workbench.settings.def.requests.systemTrust.description':
    'Acordă încredere și certificatelor din depozitul sistemului de operare al acestui computer — rădăcina instalată de un profil IT pentru un proxy corporativ. Adăugate pe lângă rădăcinile încorporate, lista spațiului de lucru și certificatele fixate ale dispozitivului; niciodată sincronizate sau exportate.',
  'workbench.settings.def.requests.responseBodyCapMB.label': 'Limita corpului răspunsului (MB)',
  'workbench.settings.def.requests.responseBodyCapMB.description':
    'Cât din corpul unui răspuns păstrează executorul pentru afișare. Corpurile mai mari sunt trunchiate la această limită — dimensiunea completă este măsurată și raportată în continuare. Ridicarea limitei crește consumul de memorie per filă de cerere deschisă.',
  'workbench.settings.def.requests.sseEventsNewestFirst.label': 'Cele mai noi primele',
  'workbench.settings.def.requests.sseEventsNewestFirst.description':
    'Ordinea listei Server-Sent Events — cele mai noi evenimente sus. Dezactivați pentru a citi de la cele mai vechi. Bara de instrumente a listei modifică aceeași setare.',
  'workbench.settings.def.requests.sseEventsGroupByName.label': 'Grupare după numele evenimentului',
  'workbench.settings.def.requests.sseEventsGroupByName.description':
    'Grupează lista Server-Sent Events sub antete restrângibile cu numele evenimentului, cu ordinea sosirii păstrată în fiecare grup. Bara de instrumente a listei modifică aceeași setare.',
  'workbench.settings.def.requests.sseEventsGroupRowLimit.label': 'Rânduri per grup',
  'workbench.settings.def.requests.sseEventsGroupRowLimit.description':
    'La gruparea după numele evenimentului, afișează doar atâtea dintre cele mai noi evenimente ale fiecărui grup — fereastra alunecă pe măsură ce sosesc evenimente noi, astfel încât mai multe grupuri rămân urmăribile deodată. 0 afișează fiecare eveniment. Bara de instrumente a listei modifică aceeași setare.',
  'workbench.settings.def.requests.grpcMessagesNewestFirst.label': 'Cele mai noi primele',
  'workbench.settings.def.requests.grpcMessagesNewestFirst.description':
    'Ordinea cronologiei mesajelor gRPC — cele mai noi mesaje sus. Dezactivați pentru a citi de la cele mai vechi. Bara de instrumente a cronologiei modifică aceeași setare.',
  'workbench.settings.def.requests.grpcIncludeDefaultValues.label': 'Includere valori implicite',
  'workbench.settings.def.requests.grpcIncludeDefaultValues.description':
    'Redă câmpurile pe care un răspuns gRPC le-a omis de pe fir ca valorile lor implicite — numere zero, șiruri goale, false, prima valoare a enumerării, liste și mape goale — așa cum emite proto3 JSON valorile implicite. Dezactivată implicit: răspunsul afișează câmpurile trimise efectiv de server. Câmpurile cu prezență (mesaje, optional, membrii oneof) rămân absente în ambele cazuri. Meniul ⋯ al panoului de răspuns modifică aceeași setare.',
  'workbench.settings.def.requests.grpcMessagesShowTypes.label': 'Afișare tipuri de mesaje',
  'workbench.settings.def.requests.grpcMessagesShowTypes.description':
    'Etichetează fiecare rând din cronologie cu tipul de mesaj protobuf declarat. Dezactivată implicit — tipurile unui rpc sunt fixe pe direcție, așa că insigna de direcție deja deosebește rândurile. Bara de instrumente a cronologiei modifică aceeași setare.',
  'workbench.settings.def.requests.grpcMessagesGroupByType.label': 'Grupare după tipul mesajului',
  'workbench.settings.def.requests.grpcMessagesGroupByType.description':
    'Grupează cronologia mesajelor gRPC sub antete restrângibile cu tipul mesajului, cu ordinea sosirii păstrată în fiecare grup. Bara de instrumente a cronologiei modifică aceeași setare.',
  'workbench.settings.def.requests.grpcMessagesGroupByDirection.label': 'Grupare după direcție',
  'workbench.settings.def.requests.grpcMessagesGroupByDirection.description':
    'Grupează cronologia mesajelor gRPC sub antete restrângibile trimise / primite. Combinată cu gruparea după tipul mesajului, fiecare pereche (tip, direcție) primește propriul grup — utilă la apelurile bidirecționale ale căror cerere și răspuns au același tip de mesaj. Bara de instrumente a cronologiei modifică aceeași setare.',
  'workbench.settings.def.requests.grpcMessagesGroupRowLimit.label': 'Rânduri per grup',
  'workbench.settings.def.requests.grpcMessagesGroupRowLimit.description':
    'La gruparea după tipul mesajului, afișează doar atâtea dintre cele mai noi mesaje ale fiecărui grup — fereastra alunecă pe măsură ce sosesc mesaje noi, astfel încât mai multe grupuri rămân urmăribile deodată. 0 afișează fiecare mesaj. Bara de instrumente a cronologiei modifică aceeași setare.',
  'workbench.settings.def.requests.mqttMessagesNewestFirst.label': 'Cele mai noi primele',
  'workbench.settings.def.requests.mqttMessagesNewestFirst.description':
    'Ordinea cronologiei mesajelor MQTT — cele mai noi mesaje sus. Dezactivați pentru a citi de la cele mai vechi. Bara de instrumente a cronologiei modifică aceeași setare.',
  'workbench.settings.def.requests.wsMessagesNewestFirst.label': 'Cele mai noi primele',
  'workbench.settings.def.requests.wsMessagesNewestFirst.description':
    'Ordinea cronologiei mesajelor WebSocket — cele mai noi mesaje sus. Dezactivați pentru a citi de la cele mai vechi. Bara de instrumente a cronologiei modifică aceeași setare.',
  'workbench.settings.def.requests.wsMessagesGroupByDirection.label': 'Grupare după direcție',
  'workbench.settings.def.requests.wsMessagesGroupByDirection.description':
    'Grupează cronologia mesajelor WebSocket sub antete restrângibile trimise / primite, cu ordinea sosirii păstrată în fiecare grup. Bara de instrumente a cronologiei modifică aceeași setare.',
  'workbench.settings.def.requests.wsMessagesGroupByEvent.label': 'Grupare după eveniment',
  'workbench.settings.def.requests.wsMessagesGroupByEvent.description':
    'Grupează cronologiile sesiunilor Socket.IO sub antete restrângibile cu numele evenimentului decodat (cadrele de control se grupează după tipul lor de pe fir). Combinată cu gruparea după direcție, fiecare pereche (eveniment, direcție) primește propriul grup. Se aplică doar sesiunilor Socket.IO — cadrele WebSocket brute nu poartă nume de evenimente. Bara de instrumente a cronologiei modifică aceeași setare.',
  'workbench.settings.def.requests.wsMessagesHideHeartbeat.label': 'Ascundere heartbeat',
  'workbench.settings.def.requests.wsMessagesHideHeartbeat.description':
    'Ascunde rândurile keep-alive ping / pong engine.io din cronologiile sesiunilor Socket.IO. Cadrele sunt capturate și exportate în continuare — doar afișarea le filtrează. Bara de instrumente a cronologiei modifică aceeași setare.',
  'workbench.settings.def.requests.wsMessagesHideHandshake.label': 'Ascundere cadre handshake',
  'workbench.settings.def.requests.wsMessagesHideHandshake.description':
    'Ascunde rândurile de încadrare handshake ale Socket.IO — open / close engine.io și conectarea la spațiul de nume cu confirmarea ei — din cronologiile sesiunilor. Deconectările și erorile de conectare se afișează întotdeauna. Cadrele sunt capturate și exportate în continuare. Bara de instrumente a cronologiei modifică aceeași setare.',
  'workbench.settings.def.requests.wsMessagesGroupRowLimit.label': 'Rânduri per grup',
  'workbench.settings.def.requests.wsMessagesGroupRowLimit.description':
    'La gruparea după direcție, afișează doar atâtea dintre cele mai noi mesaje ale fiecărui grup — fereastra alunecă pe măsură ce sosesc mesaje noi, astfel încât ambele grupuri rămân urmăribile deodată. 0 afișează fiecare mesaj. Bara de instrumente a cronologiei modifică aceeași setare.',
  'workbench.settings.def.requests.grpcSendInvalidMessage.label': 'Trimitere mesaje nevalide',
  'workbench.settings.def.requests.grpcSendInvalidMessage.description':
    'Când mesajul gRPC nu este o valoare JSON validă, invocă oricum cu un mesaj gol și lasă serverul să răspundă — de obicei INVALID_ARGUMENT. Dezactivată implicit: invocarea eșuează înainte de a ajunge pe fir, cu eroarea exactă de parsare.',

  // ── Rules Engine category defs ─────────────────────────────────────
  'workbench.settings.def.rulesEngine.paused.label': 'Pauză în execuția regulilor',
  'workbench.settings.def.rulesEngine.paused.description':
    'Oprește aplicarea regulilor asupra cererilor de rețea live. Regulile rămân editabile.',
  'workbench.settings.def.rulesEngine.evaluationStrategy.label': 'Strategie de evaluare',
  'workbench.settings.def.rulesEngine.evaluationStrategy.description':
    'Cum alege motorul între reguli când mai multe se potrivesc cu aceeași cerere.',
  'workbench.settings.def.rulesEngine.evaluationStrategy.option.first-match.label': 'Prima potrivire',
  'workbench.settings.def.rulesEngine.evaluationStrategy.option.first-match.description':
    'Folosește prima regulă în ordinea priorității',
  'workbench.settings.def.rulesEngine.evaluationStrategy.option.closest-match.label': 'Cea mai specifică potrivire',
  'workbench.settings.def.rulesEngine.evaluationStrategy.option.closest-match.description':
    'Preferă cea mai specifică regulă care se potrivește',
  'workbench.settings.def.rulesEngine.evaluationStrategy.option.all-matching.label': 'Toate potrivirile',
  'workbench.settings.def.rulesEngine.evaluationStrategy.option.all-matching.description':
    'Aplică fiecare regulă care se potrivește, în ordine',
  'workbench.settings.def.rulesEngine.updateDebounceMs.label': 'Debounce actualizări',
  'workbench.settings.def.rulesEngine.updateDebounceMs.description':
    'Întârzierea (ms) înainte ca editările regulilor să fie trimise către declarativeNetRequest.',
  'workbench.settings.def.rulesEngine.maxActiveRules.label': 'Număr maxim de reguli active',
  'workbench.settings.def.rulesEngine.maxActiveRules.description':
    'Numărul maxim de reguli compilate deodată în setul de reguli dinamic.',
  'workbench.settings.def.rulesEngine.visibleResourceTypes.label': 'Tipuri de resurse vizibile',
  'workbench.settings.def.rulesEngine.visibleResourceTypes.description':
    'Ce tipuri de resurse ale cererilor apar în vizualizarea „Această pagină” din fereastra popup. Totul se colectează întotdeauna; aceasta schimbă doar ce afișează interfața. Rândul de cipuri din fereastra popup scrie în aceeași setare.',
  'workbench.settings.def.rulesEngine.showShadowWarnings.label': 'Afișare avertismente de umbrire',
  'workbench.settings.def.rulesEngine.showShadowWarnings.description':
    'Evidențiază regulile al căror efect este umbrit de o regulă cu prioritate mai mare (blocare, redirecționare, simulare, întârziere sau conflict de suprapunere a antetelor).',
  'workbench.settings.def.rulesEngine.warnOnLargeRuleSets.label': 'Avertizare la seturi mari de reguli',
  'workbench.settings.def.rulesEngine.warnOnLargeRuleSets.description':
    'Afișează un avertisment când numărul de reguli active se apropie de plafonul browserului.',
  'workbench.settings.def.rulesEngine.largeRuleSetThreshold.label': 'Prag pentru seturi mari de reguli',
  'workbench.settings.def.rulesEngine.largeRuleSetThreshold.description':
    'Numărul de reguli active la care se declanșează avertismentul.',
  'workbench.settings.def.rulesEngine.liveRulesMode.label': 'Modul Reguli Live',
  'workbench.settings.def.rulesEngine.liveRulesMode.description':
    'Injectează Cache-Control: no-cache pe fiecare cerere care se potrivește cu una dintre regulile dvs., forțând revalidarea cu serverul, astfel încât efectul regulii să fie aplicat mereu proaspăt. Împiedică răspunsurile învechite din cache să ascundă o regulă — util când valoarea unei reguli se schimbă (precum un token de autentificare), dar pagina servește în continuare răspunsul vechi din cache.',
  'workbench.settings.def.rulesEngine.bypassHttpCache.label': 'Ocolire cache HTTP',
  'workbench.settings.def.rulesEngine.bypassHttpCache.description':
    'Adaugă Cache-Control: no-cache pe fiecare cerere din fila inspectată — forțează revalidarea cu serverul. Sfera este doar cache-ul HTTP; opțiunea proprie a browserului Chrome „Dezactivare cache” (fila Network) ocolește și cache-ul din memoria procesului de redare. Cererile potrivite cu reguli sunt păstrate mereu proaspete automat de Modul Reguli Live.',
  'workbench.settings.def.rulesEngine.variableAutocomplete.label': 'Completare automată a variabilelor',
  'workbench.settings.def.rulesEngine.variableAutocomplete.description':
    'Sugerează referințe `{{env.X}}` / `{{vault.X}}` / `{{live.X}}` / `{{workspace.X}}` / `{{collection.X}}` / `{{step.X.Y}}` pe măsură ce tastați. Se deschide la `{{` în orice câmp de valoare al unei reguli și în editoarele de corp JSON/GraphQL/XML/text simplu. Dezactivați dacă preferați editarea ca text simplu.',
  'workbench.settings.def.rulesEngine.draftUrlStrategy.label': 'Strategie URL pentru ciorne',
  'workbench.settings.def.rulesEngine.draftUrlStrategy.description':
    'Cum transformă regulile precompletate din Inspectorul DevTools o adresă URL capturată într-un model url-filter. Exactă (implicit) păstrează adresa URL verbatim, astfel încât regula se potrivește doar cu cererea inspectată. Substituția în cale înlocuiește ultimul segment al căii cu *, astfel încât resursele vecine se potrivesc. Doar gazda se extinde la întregul domeniu.',
  'workbench.settings.def.rulesEngine.draftUrlStrategy.option.exact.label': 'Adresă URL exactă',
  'workbench.settings.def.rulesEngine.draftUrlStrategy.option.exact.description':
    'Potrivire cu această adresă URL verbatim, normalizată (recomandat)',
  'workbench.settings.def.rulesEngine.draftUrlStrategy.option.path-wildcard.label': 'Substituție în cale',
  'workbench.settings.def.rulesEngine.draftUrlStrategy.option.path-wildcard.description':
    'Înlocuiește ultimul segment al căii cu un metacaracter',
  'workbench.settings.def.rulesEngine.draftUrlStrategy.option.host-only.label': 'Doar gazda',
  'workbench.settings.def.rulesEngine.draftUrlStrategy.option.host-only.description':
    'Potrivire cu fiecare cerere de pe gazdă',
  'workbench.settings.def.rulesEngine.draftUrlStrategy.option.raw.label': 'Adresă URL originală',
  'workbench.settings.def.rulesEngine.draftUrlStrategy.option.raw.description':
    'Potrivire cu această adresă URL verbatim, fără normalizare',

  // ── Diff Viewer category defs ──────────────────────────────────────
  'workbench.settings.def.workspaceSharing.importPreviewShowMergeStrategy.label':
    'Afișare strategie de îmbinare pe rânduri',
  'workbench.settings.def.workspaceSharing.importPreviewShowMergeStrategy.description':
    'Activată, fiecare rând de entitate din bara laterală stângă a previzualizării importului afișează strategia de îmbinare aleasă („Adăugare ca noi”, „Înlocuire”, „Omitere”, …) inline, lângă numărul de linii. Dezactivați pentru a elibera lățimea rândurilor în panourile înguste.',
  'workbench.settings.def.workspaceSharing.importPreviewDiffViewer.label': 'Aspect',
  'workbench.settings.def.workspaceSharing.importPreviewDiffViewer.description':
    'Redă ținta față de conținutul primit alăturat sau suprapus inline. Trece automat la unificat când panoul de diff este prea îngust.',
  'workbench.settings.def.workspaceSharing.importPreviewDiffViewer.option.side-by-side.label': 'Alăturat',
  'workbench.settings.def.workspaceSharing.importPreviewDiffViewer.option.unified.label': 'Unificat',
  'workbench.settings.def.workspaceSharing.importPreviewDiffWhitespace.label': 'Tratarea spațiilor albe',
  'workbench.settings.def.workspaceSharing.importPreviewDiffWhitespace.description':
    'Dacă diff-ul tratează modificările doar de spații albe ca editări sau le ascunde.',
  'workbench.settings.def.workspaceSharing.importPreviewDiffWhitespace.option.none.label': 'Fără ignorare',
  'workbench.settings.def.workspaceSharing.importPreviewDiffWhitespace.option.ignore.label': 'Ignorare spații albe',
  'workbench.settings.def.workspaceSharing.importPreviewDiffCollapseUnchanged.label':
    'Restrângere regiuni nemodificate',
  'workbench.settings.def.workspaceSharing.importPreviewDiffCollapseUnchanged.description':
    'Ascunde seriile de linii nemodificate și le înlocuiește cu un marcaj extensibil la clic.',
  'workbench.settings.def.workspaceSharing.importPreviewDiffShowWhitespaces.label': 'Afișare caractere de spațiu alb',
  'workbench.settings.def.workspaceSharing.importPreviewDiffShowWhitespaces.description':
    'Redă spațiile și taburile ca glife vizibile (·, →) în diff.',
  'workbench.settings.def.workspaceSharing.importPreviewDiffShowLineNumbers.label': 'Afișare numere de linie',
  'workbench.settings.def.workspaceSharing.importPreviewDiffShowLineNumbers.description':
    'Afișează coloana cu numerele de linie din margine lângă fiecare parte a diff-ului.',
  'workbench.settings.def.workspaceSharing.importPreviewDiffShowIndentGuides.label': 'Afișare ghidaje de indentare',
  'workbench.settings.def.workspaceSharing.importPreviewDiffShowIndentGuides.description':
    'Redă ghidaje verticale de indentare pentru ca imbricarea YAML să fie mai ușor de urmărit.',
  'workbench.settings.def.workspaceSharing.importPreviewDiffSoftWrap.label': 'Încadrare automată a liniilor lungi',
  'workbench.settings.def.workspaceSharing.importPreviewDiffSoftWrap.description':
    'Încadrează liniile lungi pe următorul rând vizual în loc de derulare orizontală.',

  // ── Data category defs ─────────────────────────────────────────────
  'workbench.settings.def.data.logLevel.label': 'Nivel de jurnalizare',
  'workbench.settings.def.data.logLevel.description':
    'Detalierea jurnalului extensiei. Nivelurile superioare le includ pe toate cele de deasupra lor.',
  'workbench.settings.def.data.logLevel.option.error.label': 'Eroare',
  'workbench.settings.def.data.logLevel.option.error.description': 'Doar eșecurile',
  'workbench.settings.def.data.logLevel.option.warn.label': 'Avertisment',
  'workbench.settings.def.data.logLevel.option.warn.description': 'Anomalii și reîncercări',
  'workbench.settings.def.data.logLevel.option.info.label': 'Informații',
  'workbench.settings.def.data.logLevel.option.info.description': 'Evenimente operaționale',
  'workbench.settings.def.data.logLevel.option.debug.label': 'Depanare',
  'workbench.settings.def.data.logLevel.option.debug.description': 'Detalii interne complete',
  'workbench.settings.def.data.exportSettings.label': 'Export setări',
  'workbench.settings.def.data.exportSettings.description': 'Descarcă toate setările ca fișier JSON.',
  'workbench.settings.def.data.exportSettings.action.label': 'Export',
  'workbench.settings.def.data.importSettings.label': 'Import setări',
  'workbench.settings.def.data.importSettings.description': 'Încarcă setările dintr-un fișier JSON exportat anterior.',
  'workbench.settings.def.data.importSettings.action.label': 'Import…',
  'workbench.settings.def.data.exportObservabilityLog.label': 'Export jurnal de diagnostic',
  'workbench.settings.def.data.exportObservabilityLog.description':
    'Descarcă ultimele 500 de evenimente structurate (recompilări de reguli, erori de cereri, comutări de spații de lucru) ca JSON. Doar local; nimic nu părăsește dispozitivul decât dacă atașați dvs. fișierul la un raport de eroare.',
  'workbench.settings.def.data.exportObservabilityLog.action.label': 'Export jurnal',
  'workbench.settings.def.data.clearObservabilityLog.label': 'Golire jurnal de diagnostic',
  'workbench.settings.def.data.clearObservabilityLog.description':
    'Elimină fiecare eveniment din memoria tampon. Nu afectează regulile, cererile sau alte date ale spațiului de lucru.',
  'workbench.settings.def.data.clearObservabilityLog.action.label': 'Golire',
  'workbench.settings.def.data.clearObservabilityLog.confirm':
    'Goliți jurnalul de diagnostic? Aceasta elimină fiecare eveniment din memoria tampon.',
  'workbench.settings.def.data.exportImportReports.label': 'Export rapoarte de import',
  'workbench.settings.def.data.exportImportReports.description':
    'Descarcă rapoartele structurate de eliminare/transformare pentru fiecare rulare de import (curl astăzi; HAR / Postman / Insomnia urmează) ca JSON. Stocate per spațiu de lucru — cele mai recente 50 de importuri per spațiu de lucru. Nu părăsesc niciodată dispozitivul decât dacă atașați fișierul.',
  'workbench.settings.def.data.exportImportReports.action.label': 'Export rapoarte',
  'workbench.settings.def.data.clearImportReports.label': 'Golire rapoarte de import',
  'workbench.settings.def.data.clearImportReports.description':
    'Elimină fiecare raport de import pentru spațiul de lucru activ. Nu afectează cererile în sine — doar jurnalul de audit a ceea ce s-a eliminat/transformat la import.',
  'workbench.settings.def.data.clearImportReports.action.label': 'Golire',
  'workbench.settings.def.data.clearImportReports.confirm':
    'Goliți rapoartele de import pentru acest spațiu de lucru? Această acțiune nu poate fi anulată.',
  'workbench.settings.def.data.uploadFile.label': 'Încărcare fișier',
  'workbench.settings.def.data.uploadFile.description':
    'Adaugă un fișier în spațiul de lucru activ pentru folosirea în corpuri multipart și în referințe `{{file.X}}`. Fișierele sunt adresate după conținut (sha256), așa că reîncărcarea acelorași octeți rămâne un singur blob. Stocarea este în IndexedDB local; nimic nu părăsește dispozitivul.',
  'workbench.settings.def.data.uploadFile.action.label': 'Încărcare…',
  'workbench.settings.def.data.exportFilesManifest.label': 'Export manifest al fișierelor',
  'workbench.settings.def.data.exportFilesManifest.description':
    'Descarcă lista fișierelor din spațiul de lucru activ (nume, hash, dimensiune, tip MIME) ca JSON. Octeții NU sunt incluși — este un manifest pentru audit și reîncărcare de către colegi, nu o copie de rezervă a conținutului.',
  'workbench.settings.def.data.exportFilesManifest.action.label': 'Export manifest',
  'workbench.settings.def.data.filesBrowser.label': 'Fișiere',
  'workbench.settings.def.data.filesBrowser.description':
    'Fiecare blob încărcat în spațiul de lucru activ. Descărcați octeții, copiați hash-ul scurt sau ștergeți. Metadatele fișierelor (nume, dimensiune, tip MIME, hash) pot fi căutate în indexul setărilor.',
  'workbench.settings.def.data.clearAllFiles.label': 'Golire toate fișierele',
  'workbench.settings.def.data.clearAllFiles.description':
    'Șterge fiecare blob de fișier din spațiul de lucru activ. Cererile care fac referire la aceste fișiere prin părți multipart vor da eroare la executare; va trebui să reîncărcați fișierele sau să editați acele cereri.',
  'workbench.settings.def.data.clearAllFiles.action.label': 'Golire totală',
  'workbench.settings.def.data.clearAllFiles.confirm':
    'Ștergeți fiecare fișier din acest spațiu de lucru? Părțile multipart care fac referire la ele vor da eroare la trimitere.',
  'workbench.settings.def.data.resetAllSettings.label': 'Resetare toate setările',
  'workbench.settings.def.data.resetAllSettings.description':
    'Readuce fiecare setare din fiecare categorie la valoarea implicită.',
  'workbench.settings.def.data.resetAllSettings.action.label': 'Resetare la valorile implicite',
  'workbench.settings.def.data.resetAllSettings.confirm':
    'Resetați fiecare setare la valoarea implicită? Această acțiune nu poate fi anulată.',

  // ── Updates defs (About category) ──────────────────────────────────
  'workbench.settings.def.updates.state.label': 'Actualizare software',
  'workbench.settings.def.updates.state.description':
    'Starea curentă a actualizărilor. Descărcarea și instalarea necesită întotdeauna clicul dvs. explicit.',
  'workbench.settings.def.updates.check.label': 'Verificare actualizări',
  'workbench.settings.def.updates.check.description':
    'Caută versiuni noi o dată pe zi și afișează un punct de notificare când una este disponibilă. Verificarea nu descarcă nimic și nu trimite nimic despre dvs. sau despre această instalare — citește o listă publică de versiuni și compară local. „Doar remedieri de securitate” rămâne tăcută dacă o versiune nu remediază o problemă de securitate care afectează versiunea pe care o rulați. Actualizările nu se instalează niciodată fără acțiunea dvs. explicită.',
  'workbench.settings.def.updates.check.option.all.label': 'Toate versiunile',
  'workbench.settings.def.updates.check.option.security-only.label': 'Doar remedieri de securitate',
  'workbench.settings.def.updates.check.option.off.label': 'Dezactivată',
  'workbench.settings.def.updates.channel.label': 'Canal de actualizare',
  'workbench.settings.def.updates.channel.description':
    'Ce linie de versiuni urmează verificările de actualizare. Beta primește funcțiile noi mai devreme, dar poate fi mai puțin finisată. Revenirea la Stabil nu retrogradează niciodată — păstrați versiunea instalată până când următoarea versiune stabilă o depășește. Notificările de securitate urmează întotdeauna linia stabilă pe oricare canal.',
  'workbench.settings.def.updates.channel.option.stable.label': 'Stabil',
  'workbench.settings.def.updates.channel.option.beta.label': 'Beta',
  'workbench.settings.def.updates.showWhatsNew.label': 'Afișare „Noutăți” după actualizare',
  'workbench.settings.def.updates.showWhatsNew.description':
    'Deschide o filă cu punctele importante ale versiunii prima dată când deschideți fereastra Workbench după o versiune cu funcții noi. Versiunile de corecție nu o deschid niciodată — rămân în cronologia notificărilor. Notele sunt livrate în aplicație; nimic nu se descarcă.',
  'workbench.settings.def.updates.autoDownload.label': 'Descărcare automată a actualizărilor',
  'workbench.settings.def.updates.autoDownload.description':
    'Când se găsește o actualizare, o descarcă imediat în fundal, astfel încât instalarea să fie un singur clic pe „Actualizare și repornire” — iar simpla închidere și redeschidere a aplicației lansează versiunea nouă. Dezactivată, nimic nu se descarcă până nu alegeți dvs. „Actualizare și repornire”. În ambele cazuri, aplicația nu repornește niciodată de la sine.',

  // ── About category defs ────────────────────────────────────────────
  'workbench.settings.def.about.version.label': 'Versiune',
  'workbench.settings.def.about.version.description': 'Versiunea instalată în prezent a extensiei.',
  'workbench.settings.def.about.build.label': 'Build',
  'workbench.settings.def.about.build.description': 'Numărul și data build-ului.',
  'workbench.settings.def.about.commit.label': 'Commit',
  'workbench.settings.def.about.commit.description': 'Commit-ul Git din care a fost produs acest build.',
  'workbench.settings.def.about.protocol.label': 'Protocol',
  'workbench.settings.def.about.protocol.description':
    'Versiunea protocolului de rețea pe care această extensie o vorbește cu aplicația desktop. Peerii nepotriviți sunt respinși cu o solicitare clară de actualizare.',
  'workbench.settings.def.about.browser.label': 'Browser',
  'workbench.settings.def.about.browser.description': 'Browserul și platforma detectate.',
  'workbench.settings.def.about.openSource.label': 'Pachete incluse',
  'workbench.settings.def.about.openSource.description':
    'Software liber inclus în acest build, cu licența fiecărui pachet.',
} as const satisfies Catalog;
