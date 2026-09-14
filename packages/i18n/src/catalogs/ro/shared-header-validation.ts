/**
 * Header-validation family — Romanian. Mirrors
 * `catalogs/en/shared-header-validation.ts` key for key; see that file
 * for the core mirror contract (values byte-faithful to core's English
 * on the en side — the ro side renders the same structured `code` +
 * `params`). Mints: antet = header; împăturire a liniei = line folding;
 * caractere de control = control characters; lista Chrome de antete
 * permise la adăugare = Chrome's appendable allowlist (brand raw with
 * a head noun); Suprascriere / Îmbinare / Adăugare la sfârșit = the op
 * nouns from `shared.ts`.
 */

import type { Catalog } from '../../types';

export const sharedHeaderValidation = {
  'shared.headerValidation.nameEmpty': 'Numele antetului nu poate fi gol',
  'shared.headerValidation.nameWhitespaceOnly': 'Numele antetului nu poate conține doar spații',
  'shared.headerValidation.nameTooLong': 'Numele antetului este prea lung (maximum {max} caractere)',
  'shared.headerValidation.nameProtected': '„{name}” este un antet protejat, care nu poate fi modificat de extensii',
  'shared.headerValidation.nameInvalidCharacters':
    "Numele antetului conține caractere nevalide. Sunt permise doar litere, cifre și -_.~!#$%&'*+^`|",
  'shared.headerValidation.nameTemplated':
    'Numele antetului folosește șabloane — valoarea rezolvată este validată la momentul cererii.',
  'shared.headerValidation.nameReferrerSpelling': 'Notă: ortografia corectă este „Referer” (cu un singur r)',
  'shared.headerValidation.valueEmpty': 'Valoarea antetului nu poate fi goală',
  'shared.headerValidation.valueWhitespaceOnly': 'Valoarea antetului nu poate conține doar spații',
  'shared.headerValidation.valueTooLong': 'Valoarea antetului este prea lungă (maximum {max} caractere)',
  'shared.headerValidation.valueNullBytes': 'Valoarea antetului nu poate conține octeți nuli',
  'shared.headerValidation.valueLineFolding':
    'Valoarea antetului nu poate conține împăturire a liniei (CRLF urmat de spațiu/tab)',
  'shared.headerValidation.valueLineBreaks': 'Valoarea antetului nu poate conține sfârșituri de linie',
  'shared.headerValidation.valueControlCharacters': 'Valoarea antetului conține caractere de control nevalide',
  'shared.headerValidation.valueContentTypeFormat': 'Antetul Content-Type are un format nevalid',
  'shared.headerValidation.valueNonAscii':
    'Valoarea antetului conține caractere non-ASCII care pot cauza probleme de compatibilitate',
  'shared.headerValidation.appendNotAllowlisted.request':
    'Adăugarea la sfârșit este acceptată doar pentru antetele de cerere standard cu valori multiple. „{name}” nu este în lista Chrome de antete permise la adăugare — folosiți Suprascriere în schimb sau treceți la Îmbinare pentru o adăugare bazată pe script.',
  'shared.headerValidation.appendNotAllowlisted.response':
    'Adăugarea la sfârșit este acceptată doar pentru antetele de răspuns standard cu valori multiple. „{name}” nu este în lista Chrome de antete permise la adăugare — folosiți Suprascriere în schimb sau treceți la Îmbinare pentru o adăugare bazată pe script.',
} as const satisfies Catalog;
