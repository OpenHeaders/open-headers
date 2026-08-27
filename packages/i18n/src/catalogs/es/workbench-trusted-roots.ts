/**
 * Trusted-certificates family — the TrustedRootsEditor singleton tab
 * (`workbench/components/trusted-roots/`): the row table, the
 * paste → summary → Add flow and its refusals, the remove confirm.
 *
 * Raw by design inside keyed sentences: PEM / CA / PKI / TLS / SHA-256
 * vocabulary (glossary duty), {count} chain lengths, {message} parser
 * text.
 */

import type { Catalog } from '../../types';

export const workbenchTrustedRoots = {
  'workbench.trustedRoots.title': 'Certificados de confianza',
  'workbench.trustedRoots.description':
    'Autoridades de certificación en las que confía cada conexión TLS de este workspace, además de las raíces integradas. Material público — sincronizado con el workspace, nunca un secreto.',
  'workbench.trustedRoots.count': 'CERTIFICADOS ({count})',
  'workbench.trustedRoots.empty': 'Aún no hay certificados de confianza',
  'workbench.trustedRoots.emptyHint':
    'Añade la raíz de tu CA privada para llegar a servidores y brokers detrás de tu propia PKI sin desactivar la verificación.',
  'workbench.trustedRoots.add': 'Añadir certificado',
  'workbench.trustedRoots.header.name': 'Nombre',
  'workbench.trustedRoots.header.subject': 'Sujeto',
  'workbench.trustedRoots.header.fingerprint': 'Huella SHA-256',
  'workbench.trustedRoots.header.expires': 'Caduca',
  'workbench.trustedRoots.row.chain': 'Cadena de {count}',
  'workbench.trustedRoots.row.expired': 'Caducado',
  'workbench.trustedRoots.row.copyFingerprint': 'Copiar huella',
  'workbench.trustedRoots.row.copied': 'Copiado',
  'workbench.trustedRoots.row.remove': 'Quitar',
  'workbench.trustedRoots.row.rename': 'Cambiar nombre',
  'workbench.trustedRoots.add.pemLabel': 'Certificado (PEM)',
  'workbench.trustedRoots.add.pemPlaceholder': 'Pega un certificado o una cadena PEM',
  'workbench.trustedRoots.add.nameLabel': 'Nombre',
  'workbench.trustedRoots.add.namePlaceholder': 'CA raíz interna',
  'workbench.trustedRoots.add.summary.subject': 'Sujeto',
  'workbench.trustedRoots.add.summary.issuer': 'Emisor',
  'workbench.trustedRoots.add.summary.fingerprint': 'SHA-256',
  'workbench.trustedRoots.add.summary.validFrom': 'Válido desde',
  'workbench.trustedRoots.add.summary.validUntil': 'Válido hasta',
  'workbench.trustedRoots.add.summary.chain': 'Cadena',
  'workbench.trustedRoots.add.parsing': 'Leyendo el certificado…',
  'workbench.trustedRoots.add.invalid': 'No es un certificado: {message}',
  'workbench.trustedRoots.add.notCa':
    'Esto es un certificado de servidor, no una autoridad de certificación. Añade en su lugar la raíz o la intermedia que lo emitió.',
  'workbench.trustedRoots.add.confirm': 'Añadir',
  'workbench.trustedRoots.add.cancel': 'Cancelar',
  'workbench.trustedRoots.saveFailed': 'No se pudieron guardar los certificados de confianza',
  'workbench.trustedRoots.saveFailedDetail': 'No se pudieron guardar los certificados de confianza: {message}',
  'workbench.trustedRoots.settings.label': 'Certificados de confianza',
  'workbench.trustedRoots.settings.count': '{count} de este espacio de trabajo',
  'workbench.trustedRoots.settings.none': 'Ninguno de este espacio de trabajo',
  'workbench.trustedRoots.settings.manage': 'Gestionar certificados de confianza',
  'workbench.trustedRoots.settings.empty': 'Todavía no hay certificados de confianza en este espacio de trabajo.',
  'workbench.trustedRoots.settings.browserStore': 'Almacén del navegador',
  'workbench.trustedRoots.settings.help':
    'Autoridades de certificación en las que confía este espacio de trabajo además de las raíces integradas — aplicadas a cada conexión TLS que establece el runtime de la app, una raíz por fila. Añade aquí una CA privada en lugar de desactivar la verificación.',
  'workbench.trustedRoots.settings.browserNote':
    'El navegador verifica con su propio almacén de confianza; los certificados añadidos a este espacio de trabajo solo se aplican cuando envía el runtime de la app.',
} as const satisfies Catalog;
