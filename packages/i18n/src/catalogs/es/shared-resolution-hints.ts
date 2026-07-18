/**
 * Resolution-hint family — Spanish. Mirrors
 * `catalogs/en/shared-resolution-hints.ts` key for key; the en side is
 * byte-faithful to core's `buildHint` — never edit it from here.
 * `{{…}}` reference syntax, namespace ids, `requestDomains` / sha256 /
 * punycode vocabulary stay raw. Mints: scope = ámbito; bare hostnames
 * = nombres de host simples; sanitization = saneamiento.
 */

import type { Catalog } from '../../types';

export const sharedResolutionHints = {
  'shared.resolutionHint.empty': 'La referencia está vacía. Usa {{name}} o {{namespace.name}}.',
  'shared.resolutionHint.unknownNamespace':
    'Espacio de nombres desconocido. Espacios de nombres válidos: env, vault, collection, workspace, file, ' +
    'live, step, dynamic.',
  'shared.resolutionHint.unset.envActive':
    'Define esta variable en Entornos → entorno activo (o en el entorno por defecto como respaldo).',
  'shared.resolutionHint.unset.envNoActive':
    'No hay ningún entorno activo seleccionado. Selecciona uno en Entornos, o define un entorno por defecto.',
  'shared.resolutionHint.unset.vault': 'Define este secreto en el Vault.',
  'shared.resolutionHint.unset.collection': 'Define esta variable en la colección actual.',
  'shared.resolutionHint.unset.workspace': 'Define esta variable en las variables del espacio de trabajo.',
  'shared.resolutionHint.unset.file':
    'Sube este archivo en Configuración → Archivos (o referéncialo por su hash sha256).',
  'shared.resolutionHint.unset.live':
    'No hay ninguna variable Live con ese nombre. Crea una en las variables Live, o espera a su primera ' +
    'actualización.',
  'shared.resolutionHint.unset.step':
    'Id de paso o nombre de captura no encontrado en esta ejecución del workflow. Comprueba la configuración ' +
    'de los pasos del workflow.',
  'shared.resolutionHint.unset.dynamic':
    'No hay ningún generador integrado con ese nombre. Elige uno de la lista de sugerencias ({{dynamic.uuid}}, ' +
    '{{dynamic.timestamp}}, …).',
  'shared.resolutionHint.unset.generic': 'No está definida en este ámbito.',
  'shared.resolutionHint.stepOutOfContext':
    'Las referencias de paso ({{step.<stepId>.<captureName>}}) solo son válidas dentro de un paso de Live ' +
    'Workflow.',
  'shared.resolutionHint.unresolved':
    'No se encuentra en el vault, el entorno, la colección ni el espacio de trabajo. Defínela en uno de esos ' +
    'ámbitos.',
  'shared.resolutionHint.invalidDomain.whitespace':
    'La variable se resuelve en un valor que Chrome rechaza en esta posición — contiene espacios en blanco ' +
    '(separa los nombres de host con comas). Usa nombres de host simples separados por comas.',
  'shared.resolutionHint.invalidDomain.scheme':
    'La variable se resuelve en un valor que Chrome rechaza en esta posición — contiene un esquema — quita el ' +
    'prefijo de protocolo. Usa nombres de host simples separados por comas.',
  'shared.resolutionHint.invalidDomain.wildcard':
    'La variable se resuelve en un valor que Chrome rechaza en esta posición — contiene un comodín — ' +
    'requestDomains cubre los subdominios automáticamente. Usa nombres de host simples separados por comas.',
  'shared.resolutionHint.invalidDomain.port':
    'La variable se resuelve en un valor que Chrome rechaza en esta posición — contiene un puerto — ' +
    'requestDomains compara solo por nombre de host. Usa nombres de host simples separados por comas.',
  'shared.resolutionHint.invalidDomain.uppercase':
    'La variable se resuelve en un valor que Chrome rechaza en esta posición — contiene mayúsculas — ' +
    'requestDomains es ASCII en minúsculas. Usa nombres de host simples separados por comas.',
  'shared.resolutionHint.invalidDomain.nonAscii':
    'La variable se resuelve en un valor que Chrome rechaza en esta posición — contiene caracteres que Chrome ' +
    'rechaza (usa punycode para los nombres IDN). Usa nombres de host simples separados por comas.',
  'shared.resolutionHint.invalidDomain.empty':
    'La variable se resuelve en un valor que Chrome rechaza en esta posición — queda vacía tras el ' +
    'saneamiento. Usa nombres de host simples separados por comas.',
} as const satisfies Catalog;
