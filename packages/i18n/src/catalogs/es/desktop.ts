/**
 * Desktop namespace — Spanish. Mirrors `catalogs/en/desktop.ts` key for
 * key; role-bound menu items keep Electron's own labels and the
 * 'Open Headers' brand rides raw inside the values. Menu items follow
 * the es sentence-case convention; Settings = `Configuración` (es
 * register contract).
 */

import type { Catalog } from '../../types';

export const desktop = {
  'desktop.tray.open': 'Abrir Open Headers',
  'desktop.tray.quit': 'Salir',
  'desktop.menu.settings': 'Configuración…',
  'desktop.menu.about': 'Acerca de {name}',
  'desktop.menu.enableHardwareAcceleration': 'Activar aceleración por hardware',
  'desktop.menu.disableHardwareAcceleration': 'Desactivar aceleración por hardware',
  'desktop.menu.file': 'Archivo',
  'desktop.menu.edit': 'Edición',
  'desktop.menu.view': 'Ver',
  'desktop.menu.window': 'Ventana',
  'desktop.menu.help': 'Ayuda',
  'desktop.menu.newItem': 'Nuevo…',
  'desktop.menu.newTab': 'Nueva pestaña',
  'desktop.menu.newWindow': 'Nueva ventana',
  'desktop.menu.import': 'Importar…',
  'desktop.menu.closeTab': 'Cerrar pestaña',
  'desktop.menu.nextTab': 'Pestaña siguiente',
  'desktop.menu.previousTab': 'Pestaña anterior',
  'desktop.menu.actualSize': 'Tamaño real',
  'desktop.menu.documentation': 'Documentación',
  'desktop.menu.reportIssue': 'Informar de un problema',
  'desktop.menu.licenseAgreement': 'Acuerdo de licencia',
  'desktop.update.check': 'Buscar actualizaciones…',
  'desktop.update.checking': 'Buscando actualizaciones…',
  'desktop.update.updateAndRestart': 'Actualizar a Open Headers {version} y reiniciar',
  'desktop.update.availableExternal': 'Versión {version} disponible…',
  'desktop.update.downloading': 'Descargando actualización… {percent}%',
  'desktop.update.downloadingNoProgress': 'Descargando actualización…',
  'desktop.update.restartToInstall': 'Reiniciar para instalar Open Headers {version}',
  'desktop.dialog.hardwareAcceleration.title': 'Aceleración por hardware',
  'desktop.dialog.hardwareAcceleration.willBeDisabled':
    'La aceleración por hardware se desactivará la próxima vez que {name} se inicie.',
  'desktop.dialog.hardwareAcceleration.willBeEnabled':
    'La aceleración por hardware se activará la próxima vez que {name} se inicie.',
  'desktop.dialog.hardwareAcceleration.detail': 'Reinicia ahora para aplicar el cambio de inmediato.',
  'desktop.dialog.hardwareAcceleration.restartNow': 'Reiniciar ahora',
  'desktop.dialog.hardwareAcceleration.later': 'Más tarde',
  'desktop.firstRunLegal.message':
    'Al seguir usando Open Headers, aceptas nuestros términos de licencia y nuestra política de privacidad.',
  'desktop.firstRunLegal.license': 'Términos de licencia',
  'desktop.firstRunLegal.privacy': 'Política de privacidad',
  'desktop.firstRunLegal.acknowledge': 'Entendido',
} as const satisfies Catalog;
