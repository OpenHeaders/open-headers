/**
 * Import/export family — Spanish. Extends the es register contract
 * (`es/shared.ts`). Mirrors `catalogs/en/workbench-import-export.ts`
 * key for key.
 *
 * Raw by design inside keyed sentences: brand + format proper nouns
 * (Postman / Insomnia / Bruno / HAR / OpenAPI), file extensions and
 * filenames rendered as `<Text code>` chips (`.bru`,
 * `.openheaders.yaml`), export ids / fingerprints / entity names
 * ({id} / {name} holes carry data), the ` · ` separator glyphs,
 * third-party UI paths and button labels (Postman menus, DevTools
 * `Save all as HAR`, `Copy as cURL` — fr precedent, Postman does not
 * localize Spanish), `uid` / `{{template}}` tokens, and `vault`
 * lowercase per the glossary. The import hub quotes the S65 binding
 * mint `centro de importación`; the report hover quotes the S64
 * settings path `Configuración → Datos`. MINTS: export (noun) =
 * `exportación`; passphrase = `frase secreta`; fingerprint =
 * `huella`; drop = `descarte` (m., `descartado` family), transform =
 * `transformación`, preset = `preajuste`; merge strategies = «añadir
 * como nuevo» / «reemplazar el existente» (settings-defs must reuse);
 * scan = `escanear este equipo`.
 */

import { plural } from '../../runtime';
import type { Catalog } from '../../types';

export const workbenchImportExport = {
  // ── Export modal ───────────────────────────────────────────────────
  'workbench.importExport.export.title': 'Exportar',
  'workbench.importExport.export.cancel': 'Cancelar',
  'workbench.importExport.export.download': 'Descargar',
  'workbench.importExport.export.sourceLabel': 'Origen:',
  'workbench.importExport.export.scopeLabel': 'Alcance:',
  'workbench.importExport.export.filenameLabel': 'Nombre del archivo:',
  'workbench.importExport.export.scopeWholeWorkspace': 'Todo el espacio de trabajo',
  'workbench.importExport.export.vaultSecrets': 'Secretos del vault',
  'workbench.importExport.export.vaultOmit': 'Omitir (por defecto)',
  'workbench.importExport.export.vaultEncrypted': 'Cifrados (frase secreta)',
  'workbench.importExport.export.vaultPlaintext': 'En claro (avanzado)',
  'workbench.importExport.export.passphrasePlaceholder': 'Frase secreta',
  'workbench.importExport.export.confirmPassphrasePlaceholder': 'Confirma la frase secreta',
  'workbench.importExport.export.hintPlaceholder':
    'Pista opcional (visible para el destinatario — nunca la propia frase secreta)',
  'workbench.importExport.export.strengthEmpty': 'introduce una frase secreta',
  'workbench.importExport.export.strengthWeak': 'débil',
  'workbench.importExport.export.strengthFair': 'aceptable',
  'workbench.importExport.export.strengthGood': 'buena',
  'workbench.importExport.export.strengthStrong': 'fuerte',
  'workbench.importExport.export.strengthNote':
    'Solidez de la frase secreta: {label}. Comparte la frase secreta por otro canal (Signal, gestor de ' +
    'contraseñas, voz). Cualquiera con la frase secreta puede leer todos los secretos de esta exportación.',
  'workbench.importExport.export.plaintextTitle': 'Los secretos en claro puede leerlos cualquiera que vea este archivo',
  'workbench.importExport.export.plaintextUseOnly':
    'Úsalo solo al compartir con un sistema de total confianza (p. ej. una copia de seguridad en tu propio ' +
    'disco cifrado).',
  'workbench.importExport.export.switchToEncrypted': 'Cambiar a cifrado (recomendado)',
  'workbench.importExport.export.acknowledgeRisks': 'Entiendo los riesgos',
  'workbench.importExport.export.fingerprintsTitle': 'Cifrado — comparte estas huellas con el destinatario',
  'workbench.importExport.export.ciphertextFingerprint': 'Huella del cifrado:',
  'workbench.importExport.export.keyFingerprint': 'Huella de la clave:',
  'workbench.importExport.export.fingerprintMatchNote':
    'Cuando el destinatario introduzca la frase secreta, verá la misma huella de clave si coincide con la ' + 'tuya.',
  'workbench.importExport.export.advanced': 'Avanzado',
  'workbench.importExport.export.strictLiteralLabel': 'Estrictamente literal — exportar solo lo que seleccioné',
  'workbench.importExport.export.strictLiteralHelp':
    'Por defecto, elegir una colección o carpeta arrastra cada descendiente más los contenedores padres para ' +
    'que la importación se sostenga por sí sola. Con estrictamente literal, solo viajan los uids elegidos — ' +
    'el destinatario ve dependencias ausentes para todo lo que no incluiste.',
  'workbench.importExport.export.oauthNote':
    'Los secretos de cliente OAuth se omiten siempre, sea cual sea el modo del vault. El destinatario ' +
    'introduce los suyos en la primera autenticación.',
  'workbench.importExport.export.exportFailed': 'La exportación falló',
  'workbench.importExport.export.exportedShareFingerprints':
    'Se exportó {filename} — comparte las huellas con el destinatario',
  'workbench.importExport.export.exported': 'Se exportó {filename}',

  // ── Import hub (ImportSourceModal) ─────────────────────────────────
  'workbench.importExport.hub.title': 'IMPORTAR',
  'workbench.importExport.hub.closeAria': 'Cerrar la importación',
  'workbench.importExport.hub.readingFile': 'Leyendo el archivo…',
  'workbench.importExport.hub.pastePlaceholder': 'Pega un comando curl o una URL',
  'workbench.importExport.hub.continueAria': 'Continuar la importación',
  'workbench.importExport.hub.notRecognized':
    'Aún no se reconoce — pega un comando curl, una URL, un HAR, una exportación de Postman / Insomnia / ' +
    'Bruno, un documento OpenAPI o una exportación de espacio de trabajo.',
  'workbench.importExport.hub.dropAria': 'Suelta aquí un archivo o carpeta importable',
  'workbench.importExport.hub.dropTitle': 'Suelta un archivo o una carpeta para importar',
  'workbench.importExport.hub.kindHar': 'Captura HAR',
  'workbench.importExport.hub.kindPostman': 'Colección o copia de seguridad de Postman',
  'workbench.importExport.hub.kindInsomnia': 'Exportación de Insomnia',
  'workbench.importExport.hub.kindBrunoSuffix': 'archivo o carpeta de colección',
  'workbench.importExport.hub.kindOpenapi': 'Documento OpenAPI 3.x',
  'workbench.importExport.hub.kindWorkspaceSuffix': 'exportación de espacio de trabajo',
  'workbench.importExport.hub.autoDetected': 'El formato se reconoce automáticamente.',
  'workbench.importExport.hub.browseFiles': 'Examinar archivos…',
  'workbench.importExport.hub.browseFolder': 'Examinar una carpeta…',
  'workbench.importExport.hub.switchingFrom': 'Migras desde',
  'workbench.importExport.hub.switchingOr': 'o',
  'workbench.importExport.hub.migrateCta': 'Migrar desde otra herramienta',

  // ── Modal farm (ImportExportModals) ────────────────────────────────
  'workbench.importExport.modals.noBrunoFiles':
    'No hay archivos de Bruno en esa carpeta — se esperaban archivos .bru o un bruno.json.',
  'workbench.importExport.modals.unreadableSkipped': ({ count }, locale) =>
    plural(locale, Number(count), {
      one: '{count} archivo no se pudo leer y se omitió.',
      many: '{count} archivos no se pudieron leer y se omitieron.',
      other: '{count} archivos no se pudieron leer y se omitieron.',
    }),
  'workbench.importExport.modals.readFailed': 'No se pudo leer {name}: {message}',
  'workbench.importExport.modals.importedSummary': ({ count, label }, locale) =>
    `${plural(locale, Number(count), {
      one: 'Se importó {count} entidad',
      many: 'Se importaron {count} entidades',
      other: 'Se importaron {count} entidades',
    })} desde «${label}»`,

  // ── Import preview shell (ImportPreviewModal) ──────────────────────
  'workbench.importExport.preview.fallbackTitle': 'IMPORTAR UNA EXPORTACIÓN DE ESPACIO DE TRABAJO',
  'workbench.importExport.preview.closeAria': 'Cerrar la vista previa de importación',
  'workbench.importExport.preview.cancel': 'Cancelar',
  'workbench.importExport.preview.emptyFile': 'Suelta un archivo .openheaders.yaml para previsualizarlo.',
  'workbench.importExport.preview.emptyClipboard': 'Pega una exportación de espacio de trabajo para previsualizarla.',
  'workbench.importExport.preview.preparing': 'Preparando la importación…',
  'workbench.importExport.preview.footerExportInfo': 'Exportación {id} · {scope}',
  'workbench.importExport.preview.footerPickFile': 'Elige un archivo para previsualizarlo',
  'workbench.importExport.preview.footerNoData': 'Sin datos',
  'workbench.importExport.preview.importInto': 'Importar en:',
  'workbench.importExport.preview.staleTitle': 'El espacio de trabajo cambió desde que se abrió esta vista previa',
  'workbench.importExport.preview.staleDescription':
    'Reabre la vista previa de importación para refrescar el diff y vuelve a intentarlo.',
  'workbench.importExport.preview.advanced': 'Avanzado',
  'workbench.importExport.preview.advancedCount': 'Avanzado ({count})',
  'workbench.importExport.preview.previewFailed': 'La vista previa falló',
  'workbench.importExport.preview.mergeTitle': ({ count }, locale) =>
    `Importar — ${plural(locale, Number(count), {
      one: '{count} elemento',
      many: '{count} elementos',
      other: '{count} elementos',
    })}`,

  // ── Target picker (TargetControl) ──────────────────────────────────
  'workbench.importExport.target.importInto': 'Importar en',
  'workbench.importExport.target.current': 'Actual',
  'workbench.importExport.target.new': 'Nuevo',
  'workbench.importExport.target.pickExisting': 'Elegir uno existente',
  'workbench.importExport.target.noActiveWorkspace': 'No hay espacio de trabajo activo',
  'workbench.importExport.target.selectWorkspace': 'Selecciona un espacio de trabajo',
  'workbench.importExport.target.landsOnOrg': 'Aterriza en {name} y se sincroniza a sus dispositivos',
  'workbench.importExport.target.staysLocal': 'Se queda en este dispositivo',

  // ── Advanced toggles (AdvancedPanel) ───────────────────────────────
  'workbench.importExport.advanced.title': 'Avanzado',
  'workbench.importExport.advanced.closeAria': 'Cerrar el panel avanzado',
  'workbench.importExport.advanced.backupRestoreLabel': 'Es mío — preferir la actualización por uid',
  'workbench.importExport.advanced.backupRestoreHelp':
    'Cambia las colisiones con uid coincidente de «añadir como nuevo» a «reemplazar el existente». Se omite ' +
    'para las entidades editadas localmente desde que se hizo la exportación.',
  'workbench.importExport.advanced.trustExportLabel':
    'Confiar en esta exportación — conservar los indicadores de activación',
  'workbench.importExport.advanced.trustExportHelp':
    'Las reglas / workflows Live / variables Live importados aterrizan desactivados por defecto. Actívalo ' +
    'solo cuando confíes en el remitente.',
  'workbench.importExport.advanced.stripScriptsLabel': 'Quitar los scripts de solicitud al importar',
  'workbench.importExport.advanced.stripScriptsHelp':
    'Elimina los scripts pre-solicitud y post-respuesta de cada solicitud importada. Recomendado cuando el ' +
    'remitente no es de confianza.',
  'workbench.importExport.advanced.omitOAuthLabel': 'Omitir las configuraciones OAuth',
  'workbench.importExport.advanced.omitOAuthHelp':
    'Por defecto, las configuraciones OAuth2 viajan con la solicitud (endpoint de token, client id, scopes — ' +
    'nunca el secreto de cliente ni los tokens). Con esto activado, cada solicitud OAuth2 aterriza con la ' +
    'autenticación en none.',
  'workbench.importExport.advanced.keepOrderLabel': 'Mantener el orden de la colección de destino al actualizar',
  'workbench.importExport.advanced.keepOrderHelp':
    'Por defecto, una colección actualizada toma el orden de hijos de la exportación. Con esto activado, se ' +
    'conserva el orden existente de tu destino.',
  'workbench.importExport.advanced.workspaceSettingsLabel': 'Incluir los ajustes a nivel de espacio de trabajo',
  'workbench.importExport.advanced.workspaceSettingsHelp':
    'Reservado para una futura lista de ajustes con semántica de espacio de trabajo. La lista actual está ' +
    'vacía — nada viaja por este interruptor en v1.',
  'workbench.importExport.advanced.refuseUidCollisionLabel': 'Rechazar en colisión de workspace.uid',
  'workbench.importExport.advanced.refuseUidCollisionHelp':
    'Por defecto, importar en un espacio de trabajo nuevo regenera en silencio el uid del espacio en caso de ' +
    'colisión. Con esto activado, un espacio de trabajo existente con el mismo uid bloquea la importación.',

  // ── Status chips (StatusChips + buildImportStatusChips) ────────────
  'workbench.importExport.chips.dismiss': 'Descartar',
  'workbench.importExport.chips.plaintextLabel': 'Secretos en claro',
  'workbench.importExport.chips.plaintextTitle': 'Esta exportación contiene secretos del vault en claro.',
  'workbench.importExport.chips.plaintextBody':
    'Cualquiera con este archivo puede leer todos los secretos que transporta. Considera reemitirla cifrada ' +
    'antes de reenviarla.',
  'workbench.importExport.chips.skippedLabel': '{count} omitidas',
  'workbench.importExport.chips.skippedTitle': ({ count }, locale) =>
    plural(locale, Number(count), {
      one: '{count} entidad no se pudo analizar y se omitirá.',
      many: '{count} entidades no se pudieron analizar y se omitirán.',
      other: '{count} entidades no se pudieron analizar y se omitirán.',
    }),
  'workbench.importExport.chips.andMore': '…y {count} más',
  'workbench.importExport.chips.dedupSameLabel': 'Ya importado aquí',
  'workbench.importExport.chips.dedupSameTitle': 'Importaste esta exportación ({id}) aquí el {date}.',
  'workbench.importExport.chips.dedupSameBody':
    'Reimportarla aplicará tus elecciones de estrategia por entidad actuales.',
  'workbench.importExport.chips.dedupOtherLabel': 'Importado en otro sitio',
  'workbench.importExport.chips.dedupOtherTitle': 'También importaste la exportación {id} en «{name}».',
  'workbench.importExport.chips.dedupOtherBody': 'Ese espacio de trabajo no se ve afectado por esta importación.',
  'workbench.importExport.chips.dedupUidLabel': 'El origen ya existe',
  'workbench.importExport.chips.dedupUidTitle': 'Ya existe un espacio de trabajo de este origen («{name}»).',
  'workbench.importExport.chips.dedupUidBody':
    'Cambia el destino de arriba para refrescarlo, o importa como una copia nueva.',
  'workbench.importExport.chips.staleLabel': 'Datos cambiados',
  'workbench.importExport.chips.staleTitle': 'El espacio de trabajo de destino fue modificado por otra pestaña.',
  'workbench.importExport.chips.staleBody':
    'El árbol de colisiones de abajo se ha refrescado — revísalo y haz clic en Importar de nuevo.',
  'workbench.importExport.chips.previewErrorLabel': 'La vista previa falló',
  'workbench.importExport.chips.previewErrorTitle': 'No se pudo calcular el diff de colisiones.',
  'workbench.importExport.chips.unresolvedLabel': '{count} sin resolver',
  'workbench.importExport.chips.unresolvedTitle': ({ count }, locale) =>
    plural(locale, Number(count), {
      one: '{count} referencia sin resolver.',
      many: '{count} referencias sin resolver.',
      other: '{count} referencias sin resolver.',
    }),
  'workbench.importExport.chips.unresolvedBody':
    'Estos nombres no se resuelven ni en la exportación ni en el destino. Las importaciones aterrizarán como ' +
    'vinculaciones rotas — vuelve a vincular cuando aparezca la entidad ausente.',
  'workbench.importExport.chips.referencedBy': 'referenciado por {count}',
  'workbench.importExport.chips.summaryThen': 'Antes:',
  'workbench.importExport.chips.summaryNow': 'Ahora:',
  'workbench.importExport.chips.summaryNew': '{count} nuevos',
  'workbench.importExport.chips.summaryKept': '{count} conservados',
  'workbench.importExport.chips.summaryRemoved': '{count} retirados',
  'workbench.importExport.chips.showBreakdown': 'Mostrar el desglose por sección',
  'workbench.importExport.chips.hideBreakdown': 'Ocultar el desglose',
  'workbench.importExport.chips.sectionNew': '(+{count} nuevos)',
  'workbench.importExport.chips.sectionRemoved': '({count} retirados)',

  // ── Vault blocks (VaultBlocks) ─────────────────────────────────────
  'workbench.importExport.vault.encryptedTitle': ({ count }, locale) =>
    plural(locale, Number(count), {
      one: 'Vault cifrado — {count} secreto',
      many: 'Vault cifrado — {count} secretos',
      other: 'Vault cifrado — {count} secretos',
    }),
  'workbench.importExport.vault.hintFromSender': 'Pista del remitente:',
  'workbench.importExport.vault.enterPassphrase':
    'Introduce la frase secreta para descifrar estos secretos localmente. Omitir el descifrado continúa con ' +
    'el resto de la importación — los secretos simplemente se omiten.',
  'workbench.importExport.vault.passphrasePlaceholder': 'Frase secreta',
  'workbench.importExport.vault.decrypt': 'Descifrar el vault',
  'workbench.importExport.vault.decryptedTitle': ({ count }, locale) =>
    plural(locale, Number(count), {
      one: 'Vault descifrado — {count} secreto listo para importar',
      many: 'Vault descifrado — {count} secretos listos para importar',
      other: 'Vault descifrado — {count} secretos listos para importar',
    }),
  'workbench.importExport.vault.keyFingerprint': 'Huella de la clave:',
  'workbench.importExport.vault.compareWithSender': '(compárala con el remitente)',
  'workbench.importExport.vault.ciphertextFingerprint': 'Huella del cifrado:',
  'workbench.importExport.vault.partialTitle': ({ count }, locale) =>
    plural(locale, Number(count), {
      one: '{count} secreto no se pudo decodificar — se omitirá de la importación',
      many: '{count} secretos no se pudieron decodificar — se omitirán de la importación',
      other: '{count} secretos no se pudieron decodificar — se omitirán de la importación',
    }),
  'workbench.importExport.vault.andMore': '…y {count} más',

  // ── Shared across the stage-2 import modals ────────────────────────
  'workbench.importExport.import.cancel': 'Cancelar',
  'workbench.importExport.import.importCta': 'Importar',
  'workbench.importExport.import.importCtaCount': 'Importar ({count})',
  'workbench.importExport.import.importShortcutTooltip': 'Importar ({shortcut})',
  'workbench.importExport.import.importTo': 'IMPORTAR EN',
  'workbench.importExport.import.hintNavigate': 'navegar',
  'workbench.importExport.import.hintSelect': 'seleccionar',
  'workbench.importExport.import.hintImport': 'importar',
  'workbench.importExport.import.hintClose': 'cerrar',
  'workbench.importExport.import.cantReadFile': 'No se pudo leer este archivo',
  'workbench.importExport.import.failedCreateCollection': 'No se pudo crear la colección',
  'workbench.importExport.import.importFailed': 'La importación falló: {message}',
  'workbench.importExport.import.transformsCount': ({ count }, locale) =>
    plural(locale, Number(count), {
      one: '{count} transformación',
      many: '{count} transformaciones',
      other: '{count} transformaciones',
    }),
  'workbench.importExport.import.dropsCount': ({ count }, locale) =>
    plural(locale, Number(count), {
      one: '{count} descarte',
      many: '{count} descartes',
      other: '{count} descartes',
    }),
  'workbench.importExport.import.importedRequests': ({ count }, locale) =>
    plural(locale, Number(count), {
      one: 'Se importó {count} solicitud',
      many: 'Se importaron {count} solicitudes',
      other: 'Se importaron {count} solicitudes',
    }),

  // ── HAR modal ──────────────────────────────────────────────────────
  'workbench.importExport.har.title': 'IMPORTAR DESDE HAR',
  'workbench.importExport.har.tooltipChooseFile': 'Elige primero un archivo .har',
  'workbench.importExport.har.tooltipSelectEntry': 'Selecciona al menos una entrada',
  'workbench.importExport.har.footerSelected': '{selected} de {total} seleccionadas',
  'workbench.importExport.har.footerChooseFile': 'Elige un archivo .har',
  'workbench.importExport.har.introPrefix': 'Importa un archivo',
  'workbench.importExport.har.introSuffix':
    '(HTTP Archive) exportado desde las DevTools o un proxy. Cada entrada se convierte en una solicitud de ' +
    'destino en la colección elegida. Las cookies y las subidas multipart se descartan con anotaciones de ' +
    'seguimiento; los encabezados de autenticación se promueven a tipos de autenticación de primera clase.',
  'workbench.importExport.har.filterPlaceholder': 'Filtrar por URL / método / nombre',
  'workbench.importExport.har.selectAll': 'Seleccionar todo',
  'workbench.importExport.har.selectNone': 'Ninguna',
  'workbench.importExport.har.readFailed': 'No se pudo leer el HAR: {message}',
  'workbench.importExport.har.dropTitle': 'Suelta un archivo .har aquí, o haz clic para elegir uno',
  'workbench.importExport.har.dropHint': 'Exportado desde DevTools Network → clic derecho → Save all as HAR',
  'workbench.importExport.har.noImportableEntries': 'El archivo no tiene entradas importables.',
  'workbench.importExport.har.noFilterMatch': 'Ninguna entrada coincide con el filtro.',
  'workbench.importExport.har.showingFirst': 'Se muestran las primeras {shown} de {total}. Usa el filtro para acotar.',
  'workbench.importExport.har.transformsApplied': ({ count }, locale) =>
    plural(locale, Number(count), {
      one: '{count} transformación aplicada al origen',
      many: '{count} transformaciones aplicadas al origen',
      other: '{count} transformaciones aplicadas al origen',
    }),
  'workbench.importExport.har.dropsRecorded': ({ count }, locale) =>
    plural(locale, Number(count), {
      one: '{count} descarte registrado',
      many: '{count} descartes registrados',
      other: '{count} descartes registrados',
    }),
  'workbench.importExport.har.transformsTooltip':
    'Las transformaciones reescriben campos del origen en equivalentes normalizados — p. ej. promover los ' +
    'encabezados Authorization a tipos de autenticación de primera clase.',
  'workbench.importExport.har.dropsTooltip':
    'Los descartes son campos del origen que no encajan en el modelo (cookies, subidas multipart, etc.). ' +
    'Cada uno lleva una anotación de seguimiento en el informe completo.',
  'workbench.importExport.har.reportHover':
    'Pasa el cursor para los detalles · lista completa en la exportación del informe de importación ' +
    '(Configuración → Datos)',

  // ── cURL modal ─────────────────────────────────────────────────────
  'workbench.importExport.curl.title': 'IMPORTAR DESDE CURL',
  'workbench.importExport.curl.tooltipPasteFirst': 'Pega primero un comando curl',
  'workbench.importExport.curl.tooltipEnterName': 'Introduce un nombre',
  'workbench.importExport.curl.introPrefix': 'Pega un comando',
  'workbench.importExport.curl.introSuffix':
    '— p. ej. «Copy as cURL» desde las DevTools del navegador o la documentación de una API.',
  'workbench.importExport.curl.sourcePlaceholder':
    "curl -X POST 'https://api.openheaders.com/v1/things' \\\n  -H 'authorization: Bearer xyz' \\\n  -H 'content-type: application/json' \\\n  --data-raw '{\"name\":\"hello\"}'",
  'workbench.importExport.curl.cantParse': 'No se pudo analizar este comando',
  'workbench.importExport.curl.parseFallback': 'No se pudo analizar — comprueba el comando y vuelve a intentarlo.',
  'workbench.importExport.curl.nameLabel': 'NOMBRE',
  'workbench.importExport.curl.namePlaceholder': 'Cómo aparece esta solicitud en la barra lateral',
  'workbench.importExport.curl.failedCreateRequest': 'No se pudo crear la solicitud',
  'workbench.importExport.curl.importedName': 'Se importó «{name}»',
  'workbench.importExport.curl.headersCount': ({ count }, locale) =>
    plural(locale, Number(count), {
      one: '{count} encabezado',
      many: '{count} encabezados',
      other: '{count} encabezados',
    }),
  'workbench.importExport.curl.paramsCount': ({ count }, locale) =>
    plural(locale, Number(count), {
      one: '{count} parámetro de consulta',
      many: '{count} parámetros de consulta',
      other: '{count} parámetros de consulta',
    }),
  'workbench.importExport.curl.noBody': 'sin cuerpo',
  'workbench.importExport.curl.bodyType': 'cuerpo {type}',
  'workbench.importExport.curl.noAuth': 'sin auth',
  'workbench.importExport.curl.authType': 'auth {type}',
  'workbench.importExport.curl.droppedWord': 'descartado',

  // ── Postman collection modal ───────────────────────────────────────
  'workbench.importExport.postman.title': 'IMPORTAR DESDE POSTMAN',
  'workbench.importExport.postman.intro':
    'Importa un JSON de colección Postman v2.1. Se conservan la estructura de carpetas, las variables de ' +
    'colección, la documentación y los ajustes de las solicitudes, la autenticación por solicitud (basic / ' +
    'bearer / api-key / OAuth 2.0) y los scripts de solicitud (traducidos a la API oh.* cuando es posible). ' +
    'AWS sigv4 y las subidas de archivos se registran como descartes. Opcionalmente, adjunta un archivo de ' +
    'entorno de Postman para crear un entorno equivalente.',
  'workbench.importExport.postman.tooltipChooseFile': 'Elige primero un archivo de colección',
  'workbench.importExport.postman.tooltipEnterName': 'Introduce un nombre de colección',
  'workbench.importExport.postman.collectionNameLabel': 'NOMBRE DE LA COLECCIÓN',
  'workbench.importExport.postman.collectionNamePlaceholder': 'Nombre para la nueva colección',
  'workbench.importExport.postman.readFileFailed': 'No se pudo leer el archivo: {message}',
  'workbench.importExport.postman.readEnvFailed': 'No se pudo leer el entorno: {message}',
  'workbench.importExport.postman.parsedCollection': 'COLECCIÓN ANALIZADA',
  'workbench.importExport.postman.requestsLabel': 'Solicitudes:',
  'workbench.importExport.postman.foldersLabel': 'Carpetas:',
  'workbench.importExport.postman.collectionVarsLabel': 'Vars de colección:',
  'workbench.importExport.postman.folderTree': 'Árbol de carpetas',
  'workbench.importExport.postman.optionalEnvFile': 'OPCIONAL · ARCHIVO DE ENTORNO',
  'workbench.importExport.postman.environmentLabel': 'Entorno: {name}',
  'workbench.importExport.postman.varsCount': ({ count }, locale) =>
    plural(locale, Number(count), { one: '{count} var', many: '{count} vars', other: '{count} vars' }),
  'workbench.importExport.postman.secretCount': '{count} secreto',
  'workbench.importExport.postman.remove': 'Quitar',
  'workbench.importExport.postman.envDropped': ({ count }, locale) =>
    plural(locale, Number(count), {
      one: '{count} variable de entorno descartada (entradas desactivadas)',
      many: '{count} variables de entorno descartadas (entradas desactivadas)',
      other: '{count} variables de entorno descartadas (entradas desactivadas)',
    }),
  'workbench.importExport.postman.dropCollectionTitle':
    'Suelta aquí un JSON de colección Postman v2.1, o haz clic para elegir uno',
  'workbench.importExport.postman.dropEnvTitle': 'Suelta aquí un JSON de entorno de Postman (opcional)',
  'workbench.importExport.postman.dropCollectionHint':
    'Exportado desde Postman → Collection → ⋯ → Export (Collection v2.1)',
  'workbench.importExport.postman.dropEnvHint': 'Exportado desde Postman → Environments → ⋯ → Export',
  'workbench.importExport.postman.foldersCount': ({ count }, locale) =>
    plural(locale, Number(count), { one: '{count} carpeta', many: '{count} carpetas', other: '{count} carpetas' }),
  'workbench.importExport.postman.oneEnvironment': '1 entorno',

  // ── Sectioned modal (backup / Insomnia / Bruno / OpenAPI) ──────────
  'workbench.importExport.sectioned.titlePostmanBackup': 'IMPORTAR DESDE UNA COPIA DE SEGURIDAD DE POSTMAN',
  'workbench.importExport.sectioned.blurbPostmanBackup':
    'Importa un volcado de copia de seguridad de Postman. Se reconocen las colecciones, los entornos, las ' +
    'globales y los preajustes de encabezados; los preajustes de encabezados aterrizan como reglas de ' +
    'encabezados sin publicar. Los scripts, OAuth 2.0, AWS sigv4 y las subidas de archivos se registran como ' +
    'descartes.',
  'workbench.importExport.sectioned.titleInsomnia': 'IMPORTAR DESDE INSOMNIA',
  'workbench.importExport.sectioned.blurbInsomnia':
    'Importa una exportación de Insomnia (JSON v4 o YAML v5). Los espacios de trabajo se convierten en ' +
    'colecciones con sus árboles de carpetas; los entornos se aplanan (los subentornos se fusionan sobre su ' +
    'base) y las referencias {{ _.var }} se reescriben como {{var}}; las especificaciones API incrustadas se ' +
    'conservan como especificaciones editables vinculadas a sus colecciones generadas.',
  'workbench.importExport.sectioned.titleBruno': 'IMPORTAR DESDE BRUNO',
  'workbench.importExport.sectioned.blurbBruno':
    'Importa una solicitud .bru de Bruno o una carpeta de colección entera. Se conservan el método, los ' +
    'encabezados, los parámetros, el cuerpo y la auth basic/bearer/api-key; una carpeta trae su árbol de ' +
    'carpetas, su orden y sus entornos; los scripts, los tests y los bloques de docs se registran como ' +
    'descartes.',
  'workbench.importExport.sectioned.titleOpenapi': 'IMPORTAR DESDE OPENAPI',
  'workbench.importExport.sectioned.blurbOpenapi':
    'Importa un documento OpenAPI 3.x (JSON o YAML). Las operaciones se convierten en solicitudes bajo ' +
    '{{baseUrl}}, los tags se convierten en carpetas, los parámetros y cuerpos de solicitud se conservan ' +
    '(los cuerpos definidos solo por esquema reciben un andamiaje de relleno), y los esquemas de seguridad ' +
    'se asignan a la autenticación — rellena los marcadores {{clientId}}/{{clientSecret}} tras importar. El ' +
    'documento también puede seguir viviendo como una especificación editable vinculada a la colección ' +
    'generada.',
  'workbench.importExport.sectioned.tooltipNothingParsed': 'Aún no se ha analizado nada',
  'workbench.importExport.sectioned.tooltipNeedsNames': 'Cada colección necesita un nombre',
  'workbench.importExport.sectioned.cantReadImport': 'No se pudo leer esta importación',
  'workbench.importExport.sectioned.readInputFailed': 'No se pudo leer la entrada: {message}',
  'workbench.importExport.sectioned.importAs': 'IMPORTAR COMO',
  'workbench.importExport.sectioned.specWithCollection': 'Especificación con una colección',
  'workbench.importExport.sectioned.specWithCollectionHelp':
    'El documento sigue viviendo como especificación editable, vinculada a la colección generada.',
  'workbench.importExport.sectioned.collectionOnly': 'Colección',
  'workbench.importExport.sectioned.collectionOnlyHelp': 'Solo conversión — el documento en sí no se conserva.',
  'workbench.importExport.sectioned.specificationsSection': 'ESPECIFICACIONES · {count}',
  'workbench.importExport.sectioned.collectionsSection': 'COLECCIONES · {count}',
  'workbench.importExport.sectioned.environmentsSection': 'ENTORNOS · {count}',
  'workbench.importExport.sectioned.headerPresetsSection': 'PREAJUSTES DE ENCABEZADOS · {count}',
  'workbench.importExport.sectioned.collectionNamePlaceholder': 'Nombre de la colección',
  'workbench.importExport.sectioned.varsShort': ({ count }, locale) =>
    plural(locale, Number(count), { one: '{count} var', many: '{count} vars', other: '{count} vars' }),
  'workbench.importExport.sectioned.headersShort': ({ count }, locale) =>
    plural(locale, Number(count), {
      one: '{count} encabezado',
      many: '{count} encabezados',
      other: '{count} encabezados',
    }),
  'workbench.importExport.sectioned.presetsNote':
    'Cada preajuste aterriza como una regla de encabezados sin publicar — añade condiciones y publícala ' +
    'cuando esté lista; nada toca el tráfico real hasta entonces.',
  'workbench.importExport.sectioned.nothingImportable': 'Nada importable en este archivo',
  'workbench.importExport.sectioned.nothingImportableDesc':
    'El archivo se analizó, pero todas las secciones estaban vacías o descartadas — mira las notas de ' +
    'importación de abajo.',
  'workbench.importExport.sectioned.requestsPart': ({ count }, locale) =>
    plural(locale, Number(count), {
      one: '{count} solicitud',
      many: '{count} solicitudes',
      other: '{count} solicitudes',
    }),
  'workbench.importExport.sectioned.specificationsPart': ({ count }, locale) =>
    plural(locale, Number(count), {
      one: '{count} especificación',
      many: '{count} especificaciones',
      other: '{count} especificaciones',
    }),
  'workbench.importExport.sectioned.environmentsPart': ({ count }, locale) =>
    plural(locale, Number(count), {
      one: '{count} entorno',
      many: '{count} entornos',
      other: '{count} entornos',
    }),
  'workbench.importExport.sectioned.headerRulesPart': ({ count }, locale) =>
    plural(locale, Number(count), {
      one: '{count} regla de encabezados (sin publicar)',
      many: '{count} reglas de encabezados (sin publicar)',
      other: '{count} reglas de encabezados (sin publicar)',
    }),
  'workbench.importExport.sectioned.importedLead': 'Se importaron {parts}',
  'workbench.importExport.sectioned.emptyFinish': 'Importación terminada — nada que traer',

  // ── Migration surfaces ─────────────────────────────────────────────
  'workbench.importExport.migrate.title': 'Migrar desde otra herramienta',
  'workbench.importExport.migrate.scanCta': 'Escanear este equipo',
  'workbench.importExport.migrate.pullCta': 'Importar desde una cuenta de Postman',
  'workbench.importExport.migrate.scanNote':
    'El escaneo comprueba una lista fija de carpetas de aplicaciones y solo lee archivos de datos de las ' +
    'herramientas (copias de seguridad y almacenes locales). Nunca abre archivos de credenciales, cookies o ' +
    'sesión, y nada sale de este equipo. Importar cualquier cosa es un paso aparte y explícito.',
  'workbench.importExport.migrate.scanFailed':
    'El escaneo no se pudo ejecutar — vuelve a intentarlo, o usa el centro de importación con un archivo ' +
    'exportado.',
  'workbench.importExport.migrate.backupReadFailed': 'No se pudo leer el archivo de copia de seguridad.',
  'workbench.importExport.migrate.localReadFailed': 'No se pudieron leer los datos locales.',
  'workbench.importExport.migrate.detected': 'Detectado',
  'workbench.importExport.migrate.notFound': 'No encontrado',
  'workbench.importExport.migrate.cancel': 'Cancelar',
  'workbench.importExport.migrate.fromAccount': 'Importar desde tu cuenta de Postman',
  'workbench.importExport.migrate.localDataPrefix':
    '¿Tienes datos locales de Insomnia, Thunder Client o Bruno? Expórtalos desde la herramienta y suelta el ' +
    'archivo en el',
  'workbench.importExport.migrate.importHub': 'centro de importación',
  'workbench.importExport.migrate.localDataSuffix':
    '— o escanea este equipo con la aplicación de escritorio de Open Headers.',
  'workbench.importExport.migrate.desktopConnected':
    'Tu aplicación de escritorio está conectada — elige allí «Migrar desde otra herramienta»; el progreso se ' +
    'refleja aquí y los espacios de trabajo importados se sincronizan.',
  'workbench.importExport.migrate.desktopNeeded':
    'El escaneo necesita la aplicación de escritorio; en cuanto se ejecute allí, los espacios de trabajo ' +
    'importados se sincronizan a este navegador.',
  'workbench.importExport.migrate.closeConfirmTitle': '¿Cerrar la importación?',
  'workbench.importExport.migrate.closeListingContent':
    'Tus espacios de trabajo aún se están listando — las cuentas grandes pueden tardar un minuto. Cerrar ' +
    'abandona el listado.',
  'workbench.importExport.migrate.closeListingOk': 'Seguir esperando',
  'workbench.importExport.migrate.closeSelectingContent':
    'Tu selección de espacios de trabajo se descartará. Aún no se ha importado nada.',
  'workbench.importExport.migrate.closeSelectingOk': 'Seguir seleccionando',
  'workbench.importExport.migrate.closeAnyway': 'Cerrar de todos modos',
  'workbench.importExport.migrate.discardAndClose': 'Descartar y cerrar',

  // ── Postman account pull (PostmanPullStepper + PostmanKeySteps) ────
  // The steps.glyph* values depict Postman's own UI inside the
  // walkthrough glyphs — Postman's UI does not localize into Spanish,
  // so its menu paths and button labels ride raw; only the
  // instruction chrome around them translates.
  'workbench.importExport.pull.keyIntro':
    'Pega una clave de API de Postman para listar tus espacios de trabajo y elegir cuáles importar.',
  'workbench.importExport.pull.keyAria': 'Clave de API de Postman',
  'workbench.importExport.pull.listCta': 'Listar los espacios de trabajo',
  'workbench.importExport.pull.listFailed': 'No se pudieron listar los espacios de trabajo.',
  'workbench.importExport.pull.startFailed': 'La importación no pudo empezar.',
  'workbench.importExport.pull.quipContacting': 'Contactando con tu cuenta de Postman',
  'workbench.importExport.pull.quipCounting': 'Contando colecciones',
  'workbench.importExport.pull.quipWeighing': 'Sopesando entornos',
  'workbench.importExport.pull.quipWrangling': 'Domando espacios de trabajo',
  'workbench.importExport.pull.quipAlphabetizing': 'Alfabetizando carpetas',
  'workbench.importExport.pull.quipSniffing': 'Rastreando solicitudes',
  'workbench.importExport.pull.quipUntangling': 'Desenredando variables',
  'workbench.importExport.pull.quipStacking': 'Apilando encabezados',
  'workbench.importExport.pull.pickIntro':
    'Cada espacio de trabajo de Postman seleccionado aterriza en su propio espacio de trabajo, con su nombre ' +
    'exacto, y con un informe de fin de ejecución.',
  'workbench.importExport.pull.noWorkspaces': 'No se encontraron espacios de trabajo en esta cuenta.',
  'workbench.importExport.pull.workspaceCounts': '{collections} colecciones · {environments} entornos',
  'workbench.importExport.pull.importCta': 'Importar la selección',
  'workbench.importExport.pull.back': 'Atrás',
  'workbench.importExport.pull.steps.menuA': 'En la aplicación de Postman o en https://postman.co',
  'workbench.importExport.pull.steps.menuB': 'Menú Settings → Account settings',
  'workbench.importExport.pull.steps.generateA': 'Barra lateral izquierda → API keys',
  'workbench.importExport.pull.steps.generateB': 'Generate API key',
  'workbench.importExport.pull.steps.copyA': 'Pon un nombre cualquiera → Generate API key',
  'workbench.importExport.pull.steps.copyB': 'Copia la clave → Pégala arriba',
  'workbench.importExport.pull.steps.glyphAccountSettings': 'Account settings',
  'workbench.importExport.pull.steps.glyphApiKeys': 'API keys',
  'workbench.importExport.pull.steps.glyphGenerate': 'Generate API key',
  'workbench.importExport.pull.steps.glyphCopy': 'Copy to Clipboard',

  // ── Detection details table ────────────────────────────────────────
  'workbench.importExport.detection.vendorCol': 'Herramienta',
  'workbench.importExport.detection.dataFoundCol': 'Datos encontrados',
  'workbench.importExport.detection.contentsCol': 'Contenido',
  'workbench.importExport.detection.backupFrom': 'Copia de seguridad del {date}',
  'workbench.importExport.detection.localData': 'Datos locales',
  'workbench.importExport.detection.importCta': 'Importar…',
  'workbench.importExport.detection.exportFallbackPrefix':
    'O expórtalos (Preferences → Data → Export) y suelta el archivo en el',
  'workbench.importExport.detection.backupContents':
    '{collections} colecciones · {environments} entornos · {headerPresets} preajustes de encabezados · ' +
    '{globals} globales',
  'workbench.importExport.detection.localContents':
    '{collections} colecciones · {environments} entornos · {requests} solicitudes',
  'workbench.importExport.detection.emptyScanned': 'No se encontraron almacenes de datos importables en este equipo.',
  'workbench.importExport.detection.emptyNotScanned':
    'Aún no se ha escaneado nada — «Escanear este equipo» lista aquí los datos importables.',
  'workbench.importExport.detection.skippedLead': ({ count }, locale) =>
    plural(locale, Number(count), {
      one: '{count} archivo de almacén se omitió —',
      many: '{count} archivos de almacén se omitieron —',
      other: '{count} archivos de almacén se omitieron —',
    }),

  // ── Migration report modal ─────────────────────────────────────────
  'workbench.importExport.report.title': 'Informe de importación de Postman',
  'workbench.importExport.report.noReport':
    'No se encontró ningún informe de importación para este espacio de trabajo.',
  'workbench.importExport.report.cleanImport': 'Todo se importó limpiamente — sin descartes ni transformaciones.',
  'workbench.importExport.report.copyOk': 'Informe copiado como JSON',
  'workbench.importExport.report.copyAnonymizedOk': 'Informe anonimizado copiado como JSON',
  'workbench.importExport.report.copyFailed': 'No se pudo copiar el informe.',
  'workbench.importExport.report.copyReport': 'Copiar el informe',
  'workbench.importExport.report.download': 'Descargar',
  'workbench.importExport.report.anonymizeTooltip':
    'Para compartirlo en público (p. ej. una issue de GitHub): los nombres de los espacios de trabajo se ' +
    'convierten en «Workspace N» y los valores reescritos se censuran. Las rutas, los motivos y los recuentos ' +
    'se conservan para que el informe siga siendo depurable.',
  'workbench.importExport.report.anonymize': 'Anonimizar',
  'workbench.importExport.report.close': 'Cerrar',
  'workbench.importExport.report.openWorkspace': 'Abrir el espacio de trabajo',
  'workbench.importExport.report.countsLine':
    '{collections} colecciones · {environments} entornos · {requests} solicitudes',
  'workbench.importExport.report.savedExamplesPart': '{count} ejemplos guardados',
  'workbench.importExport.report.globalVariablesPart': '{count} variables globales',
  'workbench.importExport.report.notesPart': ({ count }, locale) =>
    plural(locale, Number(count), { one: '{count} nota', many: '{count} notas', other: '{count} notas' }),
  'workbench.importExport.report.summaryImported': 'Importado',
  'workbench.importExport.report.wordCollection': ({ count }, locale) =>
    plural(locale, Number(count), { one: 'colección', many: 'colecciones', other: 'colecciones' }),
  'workbench.importExport.report.wordEnvironment': ({ count }, locale) =>
    plural(locale, Number(count), { one: 'entorno', many: 'entornos', other: 'entornos' }),
  'workbench.importExport.report.wordRequest': ({ count }, locale) =>
    plural(locale, Number(count), { one: 'solicitud', many: 'solicitudes', other: 'solicitudes' }),
  'workbench.importExport.report.wordSavedExample': ({ count }, locale) =>
    plural(locale, Number(count), {
      one: 'ejemplo guardado',
      many: 'ejemplos guardados',
      other: 'ejemplos guardados',
    }),
  'workbench.importExport.report.wordGlobalVariable': ({ count }, locale) =>
    plural(locale, Number(count), {
      one: 'variable global',
      many: 'variables globales',
      other: 'variables globales',
    }),
  'workbench.importExport.report.wordWorkspace': ({ count }, locale) =>
    plural(locale, Number(count), {
      one: '{count} espacio de trabajo',
      many: '{count} espacios de trabajo',
      other: '{count} espacios de trabajo',
    }),
  'workbench.importExport.report.withOpen': '(con',
  'workbench.importExport.report.and': 'y',
  'workbench.importExport.report.into': 'en',

  // ── Re-import diff panel ───────────────────────────────────────────
  'workbench.importExport.reimport.agePreviously': 'anteriormente',
  'workbench.importExport.reimport.previouslyImported': '(importado {age})',
  'workbench.importExport.reimport.newIssues': ({ count }, locale) =>
    plural(locale, Number(count), {
      one: '{count} problema nuevo desde la última importación',
      many: '{count} problemas nuevos desde la última importación',
      other: '{count} problemas nuevos desde la última importación',
    }),
  'workbench.importExport.reimport.nowHandled': ({ count }, locale) =>
    plural(locale, Number(count), {
      one: '{count} entrada antes no admitida ahora se gestiona',
      many: '{count} entradas antes no admitidas ahora se gestionan',
      other: '{count} entradas antes no admitidas ahora se gestionan',
    }),
  'workbench.importExport.reimport.countsChanged': 'Los recuentos cambiaron desde la última importación',
  'workbench.importExport.reimport.minorChanges': 'Cambios menores respecto a la última importación',
  'workbench.importExport.reimport.newDrops': 'Descartes nuevos ({count})',
  'workbench.importExport.reimport.dropsResolved': 'Descartes resueltos ({count})',
  'workbench.importExport.reimport.newTransforms': 'Transformaciones nuevas ({count})',
  'workbench.importExport.reimport.transformsResolved': 'Transformaciones ya innecesarias ({count})',
} as const satisfies Catalog;
