/**
 * Web namespace — Romanian. Mirrors `catalogs/en/web.ts` key for key.
 * Brand ('OpenHeaders' / 'OpenHeaders Server' — the tier-neutral
 * server name, quoted from the ro settings panes), URLs, the
 * `oh-license.` key prefix and `{provider}` / `{org}` ride raw with
 * instanță / furnizor / organizație as head nouns (această instanță
 * OpenHeaders Server, prin furnizorul {provider}, la organizația
 * {org}) — prefix/suffix fragments split around those islands. Quotes
 * the shipped ro mints: Conectare / Deconectare = sign in / sign out
 * (shared-chrome), Setări, Dispozitive asociate (settings panes),
 * administratorul serverului / loc individual / loc / poarta web
 * (server admin), furnizorul de identitate, Workbench raw, proxy
 * invers = reverse proxy. MINTS: cod de configurare = setup code;
 * autentificare unică = single sign-on; origine securizată / conexiune
 * securizată = secure origin / connection; identitatea dispozitivului
 * = a device's identity; dezasociat = unpaired. Plurals one / few /
 * other (dispozitiv / dispozitive / de dispozitive).
 */

import { plural } from '../../runtime';
import type { Catalog } from '../../types';

export const web = {
  'web.gate.titleSignIn': 'Conectare la acest server',
  'web.gate.titleSetup': 'Configurarea acestui server',
  'web.gate.introSso':
    'Conectați-vă prin furnizorul {provider} pentru a ajunge la această instanță OpenHeaders Server.',
  'web.gate.introPassword':
    'Conectați-vă cu adresa de e-mail și parola setate pentru dvs. de administratorul serverului.',
  'web.gate.introSetup':
    'Nimeni nu a configurat încă această instanță OpenHeaders Server. Creați primul cont — el administrează serverul și ' +
    'deține tot ce se află deja pe el.',
  'web.gate.introNoLogin':
    'Acest server nu are nicio cale prin care un browser să se conecteze: autentificarea unică nu este configurată și ' +
    'niciun cont de pe el nu are parolă. Cereți-i celui care administrează serverul să vă seteze una.',
  'web.gate.ssoButton': 'Conectare prin furnizorul {provider}',
  'web.gate.emailPlaceholder': 'E-mail',
  'web.gate.passwordPlaceholder': 'Parolă',
  'web.gate.signIn': 'Conectare',
  'web.gate.setupNamePlaceholder': 'Numele dvs.',
  'web.gate.setupConfirmPlaceholder': 'Confirmați parola',
  'web.gate.setupPasswordHint':
    'Cel puțin {min} caractere. Nu există resetare a parolei — păstrați-o într-un loc sigur.',
  'web.gate.setupCodePlaceholder': 'Cod de configurare',
  'web.gate.setupCodeHint': 'Apare în jurnalul serverului la pornire. Fiecare repornire afișează unul nou.',
  'web.gate.setupSubmit': 'Creare cont',
  'web.gate.setupDoneTitle': 'Acest server este configurat',
  'web.gate.setupDoneRepair': ({ count }, locale) =>
    plural(locale, Number(count), {
      one:
        '{count} dispozitiv asociat a fost dezasociat de configurare, așa că nu poate continua să administreze acest ' +
        'server pe lângă noul dvs. cont. Asociați-l din nou din Setări.',
      few:
        '{count} dispozitive asociate au fost dezasociate de configurare, așa că nu pot continua să administreze acest ' +
        'server pe lângă noul dvs. cont. Asociați-le din nou din Setări.',
      other:
        '{count} de dispozitive asociate au fost dezasociate de configurare, așa că nu pot continua să administreze ' +
        'acest server pe lângă noul dvs. cont. Asociați-le din nou din Setări.',
    }),
  'web.gate.setupDoneContinue': 'Continuare la administrarea serverului',
  'web.gate.setupDoneReload': 'Reîncărcare',
  'web.gate.setupErrorDisplayName': 'Introduceți numele de pus pe cont.',
  'web.gate.setupErrorEmail': 'Introduceți adresa de e-mail cu care vă conectați.',
  'web.gate.setupErrorPasswordShort': 'Folosiți cel puțin {min} caractere.',
  'web.gate.setupErrorPasswordMismatch': 'Cele două parole nu coincid.',
  'web.gate.setupErrorMalformed': 'Serverul nu a putut citi formularul. Reîncărcați pagina și încercați din nou.',
  'web.gate.setupErrorRefused':
    'Serverul a refuzat configurarea. Poate fi deja configurat, sau codul de configurare poate fi greșit ori rămas de ' +
    'la o pornire anterioară — serverul afișează unul nou la fiecare repornire.',
  'web.gate.setupErrorSessionRefused':
    'Contul a fost creat, dar această filă nu a putut deschide o sesiune. Reîncărcați pagina și conectați-vă cu el.',
  'web.gate.clientsIntro':
    'Această filă nu este singurul client. Extensia și aplicația desktop ajung la acest server direct la',
  'web.gate.clientsExtension': 'Obținere extensie',
  'web.gate.clientsDesktop': 'Obținere aplicație desktop',
  'web.gate.errorServerOffline': 'Serverul nu a răspuns. Verificați că rulează și încercați din nou.',
  'web.gate.errorPasswordRefused': 'Conectarea a eșuat. Verificați adresa de e-mail și parola și încercați din nou.',
  'web.gate.errorSessionRefused': 'Serverul nu a acceptat sesiunea. Încercați din nou.',
  'web.gate.seatIntroPrefix':
    'Aveți un loc individual? Lipiți cheia lui pentru a vă conecta fără a aștepta un loc de echipă liber — admite ' +
    'adresa de e-mail cu care a fost cumpărat. Obțineți unul la',
  'web.gate.seatIntroSuffix': '.',
  'web.gate.seatKeyPlaceholder': 'Cheie de loc individual (oh-license.…)',
  'web.gate.seatSignIn': 'Conectare cu loc individual',
  'web.overlay.signingIn': 'Vă conectăm…',
  'web.overlay.takingYouTo': 'Vă ducem la {provider}…',
  'web.oidcError.unknownUser':
    'Conectat, dar acest server nu are niciun utilizator pentru adresa dvs. de e-mail. Cereți-i administratorului serverului să vă adauge.',
  'web.oidcError.userDeactivated':
    'Conectat, dar utilizatorul dvs. de pe acest server este dezactivat. Adresați-vă administratorului serverului.',
  'web.oidcError.emailUnverified':
    'Furnizorul dvs. de identitate raportează adresa de e-mail ca neverificată. Verificați-o și încercați din nou.',
  'web.oidcError.providerUnavailable':
    'Furnizorul de identitate nu a putut fi contactat. Încercați din nou peste puțin timp.',
  'web.oidcError.seatLimitReached':
    'Conectat, dar acest server nu are locuri libere pentru un utilizator nou. Adresați-vă administratorului serverului ' +
    '— sau intrați acum cu propriul loc individual.',
  'web.oidcError.personalSeatsDisabled':
    'Locurile individuale sunt dezactivate pe acest server. Întrebați administratorul serverului despre un loc.',
  'web.oidcError.personalLicenseInvalid':
    'Acea cheie de loc individual nu este utilizabilă — este nevalidă, expirată sau nu este un loc individual. ' +
    'Verificați cheia și încercați din nou.',
  'web.oidcError.personalLicenseIdentityMismatch':
    'Acel loc individual aparține altei adrese de e-mail. Admite doar adresa cu care a fost cumpărat.',
  'web.oidcError.personalLicenseNoIdentity':
    'Conectarea dvs. nu a purtat nicio adresă de e-mail de comparat cu locul individual. Adresați-vă administratorului serverului.',
  'web.oidcError.failed':
    'Autentificarea unică a eșuat. Încercați din nou sau cereți-i celui care administrează serverul să verifice furnizorul.',
  'web.access.title': 'Niciun spațiu de lucru acordat încă',
  'web.access.intro':
    'Sunteți conectat la organizația {org}, dar niciun spațiu de lucru al ei nu v-a fost acordat încă. Un administrator ' +
    'trebuie să vă acorde acces la un spațiu de lucru.',
  'web.access.introNoOrg':
    'Sunteți conectat la acest server, dar niciun spațiu de lucru de pe el nu v-a fost acordat încă. Un administrator ' +
    'trebuie să vă acorde acces la un spațiu de lucru.',
  'web.access.signedInAs': 'Conectat ca {name}',
  'web.access.signedInAsWithEmail': 'Conectat ca {name} ({email})',
  'web.access.waiting':
    'Acest ecran se actualizează în clipa în care accesul este acordat — nu este nevoie de reîncărcare.',
  'web.access.signOut': 'Deconectare',
  'web.insecure.title': 'Această pagină are nevoie de o conexiune securizată',
  'web.insecure.intro':
    'Această filă rulează întregul Workbench, nu o vizualizare subțire a serverului, așa că trebuie să creeze o ' +
    'identitate pentru acest dispozitiv — iar browserele permit asta doar pe o origine securizată.',
  'web.insecure.optionLocal': 'Chiar pe server:',
  'web.insecure.optionTls': 'De aici prin HTTPS — puneți în față un proxy invers care termină TLS.',
  'web.insecure.optionClients': 'De aici fără TLS — extensia și aplicația desktop se conectează direct la',
} as const satisfies Catalog;
