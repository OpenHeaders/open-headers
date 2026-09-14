/**
 * Script-packages family — Romanian. Mirrors
 * `catalogs/en/workbench-script-packages.ts` key for key; the
 * `oh.require` / `module.exports` API vocabulary rides raw. Mints:
 * Biblioteca de pachete = Package Library; Renunțare la modificări =
 * Discard; pachet = package.
 */

import type { Catalog } from '../../types';

export const workbenchScriptPackages = {
  // ── List rail ──────────────────────────────────────────────────────
  'workbench.scriptPackages.title': 'Biblioteca de pachete',
  'workbench.scriptPackages.new': 'Nou',
  'workbench.scriptPackages.searchPlaceholder': 'Căutare pachete...',
  'workbench.scriptPackages.emptyNone': 'Niciun pachet încă',
  'workbench.scriptPackages.emptyNoMatch': 'Niciun pachet găsit',

  // ── Primer ─────────────────────────────────────────────────────────
  'workbench.scriptPackages.primer.title': 'Reutilizați scripturi între cereri cu ajutorul pachetelor',
  'workbench.scriptPackages.primer.step1': '1. Creați un pachet cu cod reutilizabil.',
  'workbench.scriptPackages.primer.step2': '2. Exportați funcțiile pe care doriți să le reutilizați.',
  'workbench.scriptPackages.primer.step3': '3. Folosiți oh.require pentru a încărca pachetul în scripturile cererilor.',

  // ── Editor pane ────────────────────────────────────────────────────
  'workbench.scriptPackages.nameAria': 'Numele pachetului',
  'workbench.scriptPackages.descriptionPlaceholder': 'Descriere (opțional)',
  'workbench.scriptPackages.descriptionAria': 'Descrierea pachetului',
  'workbench.scriptPackages.save': 'Salvare',
  'workbench.scriptPackages.deleteTitle': 'Ștergeți acest pachet?',
  'workbench.scriptPackages.deleteDescription': 'Scripturile care îl apelează prin oh.require vor începe să eșueze.',
  'workbench.scriptPackages.delete': 'Ștergere',
  'workbench.scriptPackages.loadFromScriptPrefix': 'Încărcați-l dintr-un script cu',
  'workbench.scriptPackages.exportViaInfix': '— exportați interfața publică prin',
  'workbench.scriptPackages.sourcePlaceholder': 'Scrieți JavaScript reutilizabil, apoi exportați cu module.exports.',

  // ── Discard-on-switch confirm ──────────────────────────────────────
  'workbench.scriptPackages.discardTitle': 'Renunțați la modificările nesalvate?',
  'workbench.scriptPackages.discardContent': 'Pachetul curent are editări nesalvate. Comutarea le pierde.',
  'workbench.scriptPackages.discardOk': 'Renunțare',

  // ── Write outcomes ─────────────────────────────────────────────────
  'workbench.scriptPackages.nameRequired': 'Numele pachetului este obligatoriu — este cheia oh.require.',
  'workbench.scriptPackages.saved': 'Pachet salvat',
  'workbench.scriptPackages.duplicateName': 'Un pachet numit „{name}” există deja în acest spațiu de lucru.',
  'workbench.scriptPackages.notFound': 'Pachetul nu a fost găsit — este posibil să fi fost șters.',
  'workbench.scriptPackages.saveFailed': 'Salvarea a eșuat',
  'workbench.scriptPackages.deleted': 'Pachet șters',
  'workbench.scriptPackages.deleteFailed': 'Ștergerea a eșuat',
} as const satisfies Catalog;
