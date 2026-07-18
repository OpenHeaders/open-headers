/**
 * Header-validation family — Spanish. Mirrors
 * `catalogs/en/shared-header-validation.ts` key for key; see that file
 * for the core-mirror rules. Header = encabezado (es register
 * contract); the quoted `{name}` rides in as an arg; the editor
 * operation names quoted in the append-allowlist sentences mint the es
 * contract: Append = `Añadir al final`, Override = `Sobrescribir`,
 * Merge = `Fusionar`.
 */

import type { Catalog } from '../../types';

export const sharedHeaderValidation = {
  'shared.headerValidation.nameEmpty': 'El nombre del encabezado no puede estar vacío',
  'shared.headerValidation.nameWhitespaceOnly': 'El nombre del encabezado no puede ser solo espacios en blanco',
  'shared.headerValidation.nameTooLong': 'El nombre del encabezado es demasiado largo (máx. {max} caracteres)',
  'shared.headerValidation.nameProtected':
    '"{name}" es un encabezado protegido que las extensiones no pueden modificar',
  'shared.headerValidation.nameInvalidCharacters':
    "El nombre del encabezado contiene caracteres no válidos. Solo se permiten letras, números y -_.~!#$%&'*+^`|",
  'shared.headerValidation.nameTemplated':
    'El nombre del encabezado usa plantillas — el valor resuelto se valida al momento de la solicitud.',
  'shared.headerValidation.nameReferrerSpelling': 'Nota: la ortografía correcta es "Referer" (una sola r)',
  'shared.headerValidation.valueEmpty': 'El valor del encabezado no puede estar vacío',
  'shared.headerValidation.valueWhitespaceOnly': 'El valor del encabezado no puede ser solo espacios en blanco',
  'shared.headerValidation.valueTooLong': 'El valor del encabezado es demasiado largo (máx. {max} caracteres)',
  'shared.headerValidation.valueNullBytes': 'El valor del encabezado no puede contener bytes nulos',
  'shared.headerValidation.valueLineFolding':
    'El valor del encabezado no puede contener plegado de líneas (CRLF seguido de espacio/tabulación)',
  'shared.headerValidation.valueLineBreaks': 'El valor del encabezado no puede contener saltos de línea',
  'shared.headerValidation.valueControlCharacters': 'El valor del encabezado contiene caracteres de control no válidos',
  'shared.headerValidation.valueContentTypeFormat': 'El encabezado Content-Type tiene un formato no válido',
  'shared.headerValidation.valueNonAscii':
    'El valor del encabezado contiene caracteres no ASCII que pueden causar problemas de compatibilidad',
  'shared.headerValidation.appendNotAllowlisted.request':
    'Añadir al final solo se admite en encabezados de solicitud estándar de varios valores. "{name}" no está ' +
    'en la lista de encabezados anexables de Chrome — usa Sobrescribir en su lugar, o cambia a Fusionar para ' +
    'un añadido basado en script.',
  'shared.headerValidation.appendNotAllowlisted.response':
    'Añadir al final solo se admite en encabezados de respuesta estándar de varios valores. "{name}" no está ' +
    'en la lista de encabezados anexables de Chrome — usa Sobrescribir en su lugar, o cambia a Fusionar para ' +
    'un añadido basado en script.',
} as const satisfies Catalog;
