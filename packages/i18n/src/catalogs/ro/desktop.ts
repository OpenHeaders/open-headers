/**
 * Desktop namespace — Romanian. Mirrors `catalogs/en/desktop.ts` key
 * for key; the 'Open Headers' brand rides raw inside the values. Menu
 * rows are nouns (Setări…, Filă nouă, Fereastră nouă) per the register;
 * the update items keep en's `…` and the `{percent}%` figure style.
 */

import type { Catalog } from '../../types';

export const desktop = {
  'desktop.tray.open': 'Deschidere Open Headers',
  'desktop.tray.quit': 'Ieșire',
  'desktop.menu.settings': 'Setări…',
  'desktop.menu.about': 'Despre {name}',
  'desktop.menu.enableHardwareAcceleration': 'Activare accelerare hardware',
  'desktop.menu.disableHardwareAcceleration': 'Dezactivare accelerare hardware',
  'desktop.menu.file': 'Fișier',
  'desktop.menu.edit': 'Editare',
  'desktop.menu.view': 'Vizualizare',
  'desktop.menu.window': 'Fereastră',
  'desktop.menu.help': 'Ajutor',
  'desktop.menu.newItem': 'Nou…',
  'desktop.menu.newTab': 'Filă nouă',
  'desktop.menu.newWindow': 'Fereastră nouă',
  'desktop.menu.import': 'Import…',
  'desktop.menu.closeTab': 'Închidere filă',
  'desktop.menu.nextTab': 'Fila următoare',
  'desktop.menu.previousTab': 'Fila anterioară',
  'desktop.menu.actualSize': 'Dimensiune reală',
  'desktop.menu.documentation': 'Documentație',
  'desktop.menu.reportIssue': 'Raportare problemă',
  'desktop.menu.licenseAgreement': 'Acord de licență',
  'desktop.update.check': 'Căutare actualizări…',
  'desktop.update.checking': 'Se caută actualizări…',
  'desktop.update.updateAndRestart': 'Actualizare la {version} și repornire',
  'desktop.update.availableExternal': 'Versiunea {version} este disponibilă…',
  'desktop.update.downloading': 'Se descarcă actualizarea… {percent}%',
  'desktop.update.downloadingNoProgress': 'Se descarcă actualizarea…',
  'desktop.update.restartToInstall': 'Repornire pentru instalarea versiunii {version}',
  'desktop.dialog.hardwareAcceleration.title': 'Accelerare hardware',
  'desktop.dialog.hardwareAcceleration.willBeDisabled':
    'Accelerarea hardware va fi dezactivată la următoarea pornire a aplicației {name}.',
  'desktop.dialog.hardwareAcceleration.willBeEnabled':
    'Accelerarea hardware va fi activată la următoarea pornire a aplicației {name}.',
  'desktop.dialog.hardwareAcceleration.detail': 'Reporniți acum pentru a aplica modificarea imediat.',
  'desktop.dialog.hardwareAcceleration.restartNow': 'Repornire acum',
  'desktop.dialog.hardwareAcceleration.later': 'Mai târziu',
  'desktop.firstRunLegal.message':
    'Continuând să folosiți Open Headers, sunteți de acord cu termenii licenței și cu politica de confidențialitate.',
  'desktop.firstRunLegal.license': 'Termenii licenței',
  'desktop.firstRunLegal.privacy': 'Politica de confidențialitate',
  'desktop.firstRunLegal.acknowledge': 'Am înțeles',
} as const satisfies Catalog;
