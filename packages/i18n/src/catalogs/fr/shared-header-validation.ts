/**
 * Header-validation family — French. Mirrors
 * `catalogs/en/shared-header-validation.ts` key for key; the en side is
 * byte-faithful to core's validator sentences — never edit it from
 * here. Operation names (Append / Override / Merge) stay raw.
 */

import type { Catalog } from '../../types';

export const sharedHeaderValidation = {
  'shared.headerValidation.nameEmpty': "Le nom d'en-tête ne peut pas être vide",
  'shared.headerValidation.nameWhitespaceOnly': "Le nom d'en-tête ne peut pas contenir que des espaces",
  'shared.headerValidation.nameTooLong': "Le nom d'en-tête est trop long ({max} caractères max)",
  'shared.headerValidation.nameProtected':
    '« {name} » est un en-tête protégé que les extensions ne peuvent pas modifier',
  'shared.headerValidation.nameInvalidCharacters':
    "Le nom d'en-tête contient des caractères invalides. Seuls les lettres, les chiffres et -_.~!#$%&'*+^`| " +
    'sont autorisés',
  'shared.headerValidation.nameTemplated':
    "Le nom d'en-tête utilise des modèles — la valeur résolue est validée au moment de la requête.",
  'shared.headerValidation.nameReferrerSpelling': "Note : l'orthographe correcte est « Referer » (un seul r)",
  'shared.headerValidation.valueEmpty': "La valeur d'en-tête ne peut pas être vide",
  'shared.headerValidation.valueWhitespaceOnly': "La valeur d'en-tête ne peut pas contenir que des espaces",
  'shared.headerValidation.valueTooLong': "La valeur d'en-tête est trop longue ({max} caractères max)",
  'shared.headerValidation.valueNullBytes': "La valeur d'en-tête ne peut pas contenir d'octets nuls",
  'shared.headerValidation.valueLineFolding':
    "La valeur d'en-tête ne peut pas contenir de pli de ligne (CRLF suivi d'espace/tabulation)",
  'shared.headerValidation.valueLineBreaks': "La valeur d'en-tête ne peut pas contenir de sauts de ligne",
  'shared.headerValidation.valueControlCharacters': "La valeur d'en-tête contient des caractères de contrôle invalides",
  'shared.headerValidation.valueContentTypeFormat': "L'en-tête Content-Type a un format invalide",
  'shared.headerValidation.valueNonAscii':
    "La valeur d'en-tête contient des caractères non ASCII qui peuvent causer des problèmes de compatibilité",
  'shared.headerValidation.appendNotAllowlisted.request':
    "Append n'est pris en charge que sur les en-têtes de requête multi-valeurs standard. « {name} » n'est pas " +
    'dans la liste des en-têtes extensibles de Chrome — utilisez Override à la place, ou passez à Merge pour un ' +
    'ajout par script.',
  'shared.headerValidation.appendNotAllowlisted.response':
    "Append n'est pris en charge que sur les en-têtes de réponse multi-valeurs standard. « {name} » n'est pas " +
    'dans la liste des en-têtes extensibles de Chrome — utilisez Override à la place, ou passez à Merge pour un ' +
    'ajout par script.',
} as const satisfies Catalog;
