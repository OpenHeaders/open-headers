/**
 * Header-validation family — German. Mirrors
 * `catalogs/en/shared-header-validation.ts` key for key; see that file
 * for the core-mirror rules. Header = Header raw (m., de register
 * contract); the quoted `{name}` rides in as an arg inside German
 * quotes „…“; the editor operation names quoted in the append-allowlist
 * sentences mint the de contract: Append = `Anfügen`, Override =
 * `Überschreiben`, Merge = `Zusammenführen`.
 */

import type { Catalog } from '../../types';

export const sharedHeaderValidation = {
  'shared.headerValidation.nameEmpty': 'Der Header-Name darf nicht leer sein',
  'shared.headerValidation.nameWhitespaceOnly': 'Der Header-Name darf nicht nur aus Leerzeichen bestehen',
  'shared.headerValidation.nameTooLong': 'Der Header-Name ist zu lang (max. {max} Zeichen)',
  'shared.headerValidation.nameProtected': '„{name}“ ist ein geschützter Header, den Erweiterungen nicht ändern können',
  'shared.headerValidation.nameInvalidCharacters':
    "Der Header-Name enthält ungültige Zeichen. Erlaubt sind nur Buchstaben, Ziffern und -_.~!#$%&'*+^`|",
  'shared.headerValidation.nameTemplated':
    'Der Header-Name verwendet Templates — der aufgelöste Wert wird zur Anfragezeit validiert.',
  'shared.headerValidation.nameReferrerSpelling': 'Hinweis: Die korrekte Schreibweise ist „Referer“ (nur ein r)',
  'shared.headerValidation.valueEmpty': 'Der Header-Wert darf nicht leer sein',
  'shared.headerValidation.valueWhitespaceOnly': 'Der Header-Wert darf nicht nur aus Leerzeichen bestehen',
  'shared.headerValidation.valueTooLong': 'Der Header-Wert ist zu lang (max. {max} Zeichen)',
  'shared.headerValidation.valueNullBytes': 'Der Header-Wert darf keine Nullbytes enthalten',
  'shared.headerValidation.valueLineFolding':
    'Der Header-Wert darf keine Zeilenfaltung enthalten (CRLF gefolgt von Leerzeichen/Tabulator)',
  'shared.headerValidation.valueLineBreaks': 'Der Header-Wert darf keine Zeilenumbrüche enthalten',
  'shared.headerValidation.valueControlCharacters': 'Der Header-Wert enthält ungültige Steuerzeichen',
  'shared.headerValidation.valueContentTypeFormat': 'Der Content-Type-Header hat ein ungültiges Format',
  'shared.headerValidation.valueNonAscii':
    'Der Header-Wert enthält Nicht-ASCII-Zeichen, die Kompatibilitätsprobleme verursachen können',
  'shared.headerValidation.appendNotAllowlisted.request':
    'Anfügen wird nur bei standardmäßigen mehrwertigen Anfrage-Headern unterstützt. „{name}“ steht nicht auf der ' +
    'Allowlist der anfügbaren Header von Chrome — verwende stattdessen Überschreiben oder wechsle zu Zusammenführen ' +
    'für ein skriptbasiertes Anfügen.',
  'shared.headerValidation.appendNotAllowlisted.response':
    'Anfügen wird nur bei standardmäßigen mehrwertigen Antwort-Headern unterstützt. „{name}“ steht nicht auf der ' +
    'Allowlist der anfügbaren Header von Chrome — verwende stattdessen Überschreiben oder wechsle zu Zusammenführen ' +
    'für ein skriptbasiertes Anfügen.',
} as const satisfies Catalog;
