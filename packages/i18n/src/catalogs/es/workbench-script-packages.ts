/**
 * Script-packages family — Spanish. Mirrors
 * `catalogs/en/workbench-script-packages.ts` key for key. Raw by
 * design inside keyed sentences: the `oh.require` / `module.exports`
 * API vocabulary (code chips), and {name} holes carrying package
 * names. Package = paquete (m., the established es dev term — no
 * loanword needed, unlike fr).
 */

import type { Catalog } from '../../types';

export const workbenchScriptPackages = {
  // ── List rail ──────────────────────────────────────────────────────
  'workbench.scriptPackages.title': 'Biblioteca de paquetes',
  'workbench.scriptPackages.new': 'Nuevo',
  'workbench.scriptPackages.searchPlaceholder': 'Buscar paquetes...',
  'workbench.scriptPackages.emptyNone': 'Aún no hay paquetes',
  'workbench.scriptPackages.emptyNoMatch': 'No se encontró ningún paquete',

  // ── Primer ─────────────────────────────────────────────────────────
  'workbench.scriptPackages.primer.title': 'Reutiliza scripts entre solicitudes con paquetes',
  'workbench.scriptPackages.primer.step1': '1. Crea un paquete con algo de código reutilizable.',
  'workbench.scriptPackages.primer.step2': '2. Exporta las funciones que quieras reutilizar.',
  'workbench.scriptPackages.primer.step3': '3. Usa oh.require para cargar el paquete en tus scripts de solicitud.',

  // ── Editor pane ────────────────────────────────────────────────────
  'workbench.scriptPackages.nameAria': 'Nombre del paquete',
  'workbench.scriptPackages.descriptionPlaceholder': 'Descripción (opcional)',
  'workbench.scriptPackages.descriptionAria': 'Descripción del paquete',
  'workbench.scriptPackages.save': 'Guardar',
  'workbench.scriptPackages.deleteTitle': '¿Eliminar este paquete?',
  'workbench.scriptPackages.deleteDescription': 'Los scripts que llaman a oh.require sobre él empezarán a fallar.',
  'workbench.scriptPackages.delete': 'Eliminar',
  'workbench.scriptPackages.loadFromScriptPrefix': 'Cárgalo desde un script con',
  'workbench.scriptPackages.exportViaInfix': '— exporta la superficie pública vía',
  'workbench.scriptPackages.sourcePlaceholder': 'Escribe JavaScript reutilizable y luego exporta con module.exports.',

  // ── Discard-on-switch confirm ──────────────────────────────────────
  'workbench.scriptPackages.discardTitle': '¿Descartar los cambios sin guardar?',
  'workbench.scriptPackages.discardContent': 'El paquete actual tiene ediciones sin guardar. Cambiar las descarta.',
  'workbench.scriptPackages.discardOk': 'Descartar',

  // ── Write outcomes ─────────────────────────────────────────────────
  'workbench.scriptPackages.nameRequired': 'El nombre del paquete es obligatorio — es la clave de oh.require.',
  'workbench.scriptPackages.saved': 'Paquete guardado',
  'workbench.scriptPackages.duplicateName': 'Ya existe un paquete llamado «{name}» en este espacio de trabajo.',
  'workbench.scriptPackages.notFound': 'Paquete no encontrado — puede que haya sido eliminado.',
  'workbench.scriptPackages.saveFailed': 'No se pudo guardar',
  'workbench.scriptPackages.deleted': 'Paquete eliminado',
  'workbench.scriptPackages.deleteFailed': 'No se pudo eliminar',
} as const satisfies Catalog;
