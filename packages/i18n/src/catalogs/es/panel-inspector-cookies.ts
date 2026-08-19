/**
 * DevTools panel — inspector Cookies tab — Spanish. Mirrors
 * `catalogs/en/panel-inspector-cookies.ts` key for key. Raw by design:
 * cookie names/values, Set-Cookie attribute names as titles and field
 * labels (Name / Value / Domain / Path / Expires / SameSite /
 * HttpOnly / Secure / Host-only), the parity-shaped column headers,
 * the `COOKIE_SAME_SITE_LABELS` round-trip vocabulary, `__Host-` /
 * `__Secure-` prefixes, format nouns, and byte figures. Mints: the
 * jar rides the S61 `tarro` (de cookies / del navegador); browser
 * rejection = `rechazar`; violated = `incumplido`; flag = `indicador`;
 * cookie scope prose = `ámbito`; tracking = `rastreo`; expiry rides
 * the `caducar`/`caducidad` family; chips ride raw (m.); DevTools path
 * quotes Chrome's own es UI (`Aplicación → Cookies`).
 */

import { plural } from '../../runtime';
import type { Catalog } from '../../types';

export const panelInspectorCookies = {
  // ── Cookies tab (inspector detail) ──────────────────────────────────
  'panel.inspector.cookies.filterPlaceholder':
    'Filtrar — texto, name:sess, is:secure, is:samesite-none, is:problem, is:third-party, …',
  'panel.inspector.cookies.filterAria': 'Filtrar las cookies',
  'panel.inspector.cookies.empty': 'No se envió ni se recibió ninguna cookie.',

  // Table column headers — parity-shaped grid headers stay raw.
  'panel.inspector.cookies.col.name': 'Name',
  'panel.inspector.cookies.col.value': 'Value',
  'panel.inspector.cookies.col.scope': 'Scope',
  'panel.inspector.cookies.col.size': 'Size',
  'panel.inspector.cookies.col.sec': 'Sec',

  // Footprint strip — independent clauses joined with raw ' · '.
  'panel.inspector.cookies.footprint.sent': '{count} enviadas · {bytes} B',
  'panel.inspector.cookies.footprint.set': '{count} definidas · {bytes} B',
  'panel.inspector.cookies.footprint.dropped': '{count} se rechazarán',
  'panel.inspector.cookies.footprint.filteredOut': '{count} filtradas',
  'panel.inspector.cookies.footprint.flagged': '{count} señaladas',

  // Toolbar CTAs — the rule world (Override Cookies ▾) and the jar
  // world (Add cookie), each with its own (i) corpus.
  'panel.inspector.cookies.cta.overrideCookies': 'Sustituir las cookies',
  'panel.inspector.cookies.cta.overrideCookiesTitle':
    'Crear una regla que cambie las cookies de las solicitudes coincidentes',
  'panel.inspector.cookies.cta.requestCookies': 'Cookies de solicitud…',
  'panel.inspector.cookies.cta.requestCookiesTitle': 'Reemplazar el encabezado Cookie enviado en esta solicitud',
  'panel.inspector.cookies.cta.responseCookies': 'Cookies de respuesta…',
  'panel.inspector.cookies.cta.responseCookiesTitle': 'Reemplazar un encabezado Set-Cookie que devuelve el servidor',
  'panel.inspector.cookies.cta.noCookies': 'No enviar ninguna cookie…',
  'panel.inspector.cookies.cta.noCookiesTitle':
    'Quitar el encabezado Cookie por completo, para que el servidor no vea ninguna cookie',
  'panel.inspector.cookies.cta.addCookie': 'Añadir cookie',
  'panel.inspector.cookies.cta.addCookieTitle': 'Añadir una cookie al tarro del navegador (incluidas las HttpOnly)',
  'panel.inspector.cookies.ctaInfo.overrideTitle': 'Sustituir las cookies',
  'panel.inspector.cookies.ctaInfo.ruleKicker': 'Regla',
  'panel.inspector.cookies.ctaInfo.overrideSummary':
    'Crea una regla que reescribe los encabezados Cookie / Set-Cookie de las solicitudes coincidentes mientras ' +
    'se dispara. El tarro de cookies del navegador queda intacto.',
  'panel.inspector.cookies.ctaInfo.choicesHeading': 'Opciones',
  'panel.inspector.cookies.ctaInfo.requestLabel': 'Cookies de solicitud',
  'panel.inspector.cookies.ctaInfo.requestDesc': 'Reemplazar el encabezado Cookie que envía el navegador.',
  'panel.inspector.cookies.ctaInfo.responseLabel': 'Cookies de respuesta',
  'panel.inspector.cookies.ctaInfo.responseDesc': 'Reemplazar un encabezado Set-Cookie que devuelve el servidor.',
  'panel.inspector.cookies.ctaInfo.noneLabel': 'No enviar ninguna cookie',
  'panel.inspector.cookies.ctaInfo.noneDesc':
    'Quitar el encabezado Cookie por completo — el servidor ve una solicitud sin cookies.',
  'panel.inspector.cookies.ctaInfo.addTitle': 'Añadir una Cookie',
  'panel.inspector.cookies.ctaInfo.jarKicker': 'Tarro del navegador',
  'panel.inspector.cookies.ctaInfo.addSummary':
    'Escribe una cookie real en el tarro del navegador — el mismo almacén que el navegador muestra en ' +
    'Aplicación → Cookies.',
  'panel.inspector.cookies.ctaInfo.addDescription':
    'Persiste más allá de esta solicitud y el navegador la adjunta allí donde su dominio, su ruta y sus ' +
    'indicadores coinciden — sin regla alguna. También es la forma de crear cookies HttpOnly, que los scripts ' +
    'de página no pueden definir. El valor acepta referencias {{variable}}, resueltas una vez al guardar — el ' +
    'tarro conserva esa instantánea aunque la variable cambie después; usa Sustituir las cookies cuando el ' +
    'valor deba seguir a la variable.',

  // Jar-write toasts + the delete confirm.
  'panel.inspector.cookies.toast.saved': 'Cookie «{name}» guardada',
  'panel.inspector.cookies.toast.saveFailed': 'No se pudo guardar la cookie «{name}»',
  'panel.inspector.cookies.toast.saveFailedWithError': 'No se pudo guardar la cookie «{name}» — {error}',
  'panel.inspector.cookies.toast.deleted': 'Cookie «{name}» eliminada',
  'panel.inspector.cookies.toast.deleteFailed': 'No se pudo eliminar la cookie «{name}»',
  'panel.inspector.cookies.toast.mergeApplied': 'Fusión aplicada al formulario — Guardar la escribe en el navegador',
  'panel.inspector.cookies.confirmDelete.title': '¿Eliminar la cookie «{name}»?',
  'panel.inspector.cookies.confirmDelete.content':
    'Esto la quita del tarro de cookies del navegador. La página dejará de enviarla.',
  'panel.inspector.cookies.confirmDelete.ok': 'Eliminar',

  // More filters ▾ / View ▾ — this tab's own menus.
  'panel.inspector.cookies.moreFilters.label': 'Filtros adicionales',
  'panel.inspector.cookies.moreFilters.problemsOnly': 'Solo problemas',
  'panel.inspector.cookies.moreFilters.thirdPartyOnly': 'Solo terceros',
  'panel.inspector.cookies.moreFilters.ruleOnly': 'Solo modificadas por reglas',
  'panel.inspector.cookies.moreFilters.showFilteredOut': 'Mostrar las cookies de solicitud filtradas',
  'panel.inspector.cookies.view.label': 'Vista',
  'panel.inspector.cookies.view.sort': 'Orden',
  'panel.inspector.cookies.view.sortOriginal': 'Original',
  'panel.inspector.cookies.view.sortAz': 'A → Z',
  'panel.inspector.cookies.view.sortSize': 'Size',
  'panel.inspector.cookies.view.sortExpires': 'Expires',
  'panel.inspector.cookies.view.expiresFormat': 'Expires',
  'panel.inspector.cookies.view.expiresRelative': 'Relativo',
  'panel.inspector.cookies.view.expiresAbsolute': 'Absoluto',
  'panel.inspector.cookies.view.decodeValues': 'Decodificar los valores con codificación URL',
  'panel.inspector.cookies.view.groupByRole': 'Agrupar por rol (auth / pref / rastreo)',
  'panel.inspector.cookies.view.showTags': 'Mostrar las etiquetas',
  'panel.inspector.cookies.view.showSuggestions': 'Mostrar las sugerencias',

  // Section chrome.
  'panel.inspector.cookies.section.responseCookies': 'Cookies de respuesta',
  'panel.inspector.cookies.section.requestCookies': 'Cookies de solicitud',
  'panel.inspector.cookies.section.countOf': '{visible} de {total}',

  // Role vocabulary — product classifier copy.
  'panel.inspector.cookies.role.chipAuth': '¿auth?',
  'panel.inspector.cookies.role.chipTracking': '¿rastreo?',
  'panel.inspector.cookies.role.chipPref': 'pref',
  'panel.inspector.cookies.role.sectionAuth': 'Auth y sesión',
  'panel.inspector.cookies.role.sectionFunctional': 'Funcionales',
  'panel.inspector.cookies.role.sectionPref': 'Preferencias',
  'panel.inspector.cookies.role.sectionTracking': 'Analítica y rastreo',
  'panel.inspector.cookies.role.nounAuth': 'auth / sesión',
  'panel.inspector.cookies.role.nounTracking': 'analítica / rastreo',
  'panel.inspector.cookies.role.nounPref': 'preferencia / consentimiento',
  'panel.inspector.cookies.role.nounOther': 'cookie',
  'panel.inspector.cookies.role.vendorTooltip': '{vendor} — cookie de {noun}.',
  'panel.inspector.cookies.role.tooltipAuth': 'Parece una cookie de auth / sesión (heurística).',
  'panel.inspector.cookies.role.tooltipTracking': 'Parece una cookie de analítica / rastreo (heurística).',
  'panel.inspector.cookies.role.tooltipPref': 'Una cookie de preferencias del usuario.',

  // Lifecycle / context chips — facts not in any column.
  'panel.inspector.cookies.chips.partitioned': 'particionada',
  'panel.inspector.cookies.chips.partitionedTitle': 'Aislada al sitio de nivel superior: {key}',
  'panel.inspector.cookies.chips.thirdParty': 'terceros',
  'panel.inspector.cookies.chips.justSet': 'recién definida',
  'panel.inspector.cookies.chips.justSetTitle': 'Definida por esta respuesta.',
  'panel.inspector.cookies.chips.dropped': 'rechazada',
  'panel.inspector.cookies.chips.droppedTitle': 'El navegador rechazará este Set-Cookie.',
  'panel.inspector.cookies.chips.filteredOut': 'filtrada',
  'panel.inspector.cookies.chips.filteredOutFallbackTitle': 'No enviada en esta solicitud.',
  'panel.inspector.cookies.chips.problemTitle': 'Mira la sugerencia de arriba.',

  // S / H / L security-glyph tooltips — the letters stay raw.
  'panel.inspector.cookies.glyphs.secureOn': 'Secure — enviada solo por HTTPS.',
  'panel.inspector.cookies.glyphs.secureMissingSameSiteNone':
    'Falta Secure — SameSite=None exige Secure; el navegador rechazará esta cookie.',
  'panel.inspector.cookies.glyphs.secureMissingPrefix': 'Falta Secure — el prefijo __Host- / __Secure- exige Secure.',
  'panel.inspector.cookies.glyphs.secureOff': 'Sin atributo Secure.',
  'panel.inspector.cookies.glyphs.httpOnlyOn': 'HttpOnly — no se puede leer desde JavaScript.',
  'panel.inspector.cookies.glyphs.httpOnlyOff': 'Se puede leer desde JavaScript (sin HttpOnly).',
  'panel.inspector.cookies.glyphs.sameSiteStrict': 'SameSite=Strict — enviada solo en navegaciones same-site.',
  'panel.inspector.cookies.glyphs.sameSiteLax': 'SameSite=Lax — enviada en los GET cross-site de nivel superior.',
  'panel.inspector.cookies.glyphs.sameSiteNoneNoSecure': 'SameSite=None sin Secure — el navegador la rechazará.',
  'panel.inspector.cookies.glyphs.sameSiteNone': 'SameSite=None — enviada en todas las solicitudes cross-site.',
  'panel.inspector.cookies.glyphs.sameSiteUnspecified': 'SameSite sin especificar.',

  // Row actions + status dots + name/value tooltips.
  'panel.inspector.cookies.row.copyValue': 'Copiar el valor',
  'panel.inspector.cookies.row.copied': 'Copiado',
  'panel.inspector.cookies.row.override': 'Sustituir',
  'panel.inspector.cookies.row.overrideSetCookieTitle': 'Crear una regla para sustituir este Set-Cookie',
  'panel.inspector.cookies.row.overrideCookieTitle': 'Crear una regla para sustituir este valor de Cookie',
  'panel.inspector.cookies.row.editCookieTitle': 'Editar esta cookie en el tarro del navegador',
  'panel.inspector.cookies.row.editCookieAria': 'Editar la cookie',
  'panel.inspector.cookies.row.deleteCookieTitle': 'Eliminar esta cookie del tarro del navegador',
  'panel.inspector.cookies.row.deleteCookieAria': 'Eliminar la cookie',
  'panel.inspector.cookies.row.ruleDotTitle': 'Una regla modifica el encabezado {header} en esta solicitud',
  'panel.inspector.cookies.row.ruleDotAria': 'Se aplica una regla',
  'panel.inspector.cookies.row.editedDotTitle': 'Editada desde este panel',
  'panel.inspector.cookies.row.editedDotAria': 'Editada',
  'panel.inspector.cookies.row.hostPrefixHint':
    'El prefijo __Host- fija esta cookie a un solo host: el navegador impone Secure, Path=/ y la ausencia del ' +
    'atributo Domain. Las líneas Set-Cookie que incumplen cualquiera de esas condiciones se rechazan.',
  'panel.inspector.cookies.row.securePrefixHint':
    'El prefijo __Secure- obliga a que esta cookie sea Secure (solo HTTPS). Las líneas Set-Cookie sin Secure ' +
    'se rechazan.',
  'panel.inspector.cookies.row.editedValueTitle': 'Editada — la solicitud llevaba: {value}',
  'panel.inspector.cookies.row.valueNoteResponse':
    'Esta respuesta definió: {value} — el valor del tarro ha cambiado desde entonces.',
  'panel.inspector.cookies.row.valueNoteRequest':
    'Esta solicitud envió: {value} — el valor del tarro ha cambiado desde entonces.',

  // Status-rail (i) — OH-native rail copy; kicker is the raw brand.
  'panel.inspector.cookies.statusRail.title': 'Estado',
  'panel.inspector.cookies.statusRail.summary':
    'Un cuadrado marca las cookies que no están en su estado original del navegador.',
  'panel.inspector.cookies.statusRail.colorsHeading': 'Colores de los cuadrados',
  'panel.inspector.cookies.statusRail.blue': 'azul',
  'panel.inspector.cookies.statusRail.blueDesc':
    'Una regla disparada en esta solicitud modifica el encabezado Cookie / Set-Cookie de esta dirección.',
  'panel.inspector.cookies.statusRail.grey': 'gris',
  'panel.inspector.cookies.statusRail.greyDesc': 'Añadida o editada desde este panel durante esta sesión.',

  // Add / edit popover. The SameSite labels stay raw (round-trip
  // vocabulary); the On/Off projection words translate on BOTH sides
  // (rendered and parsed from these same keys).
  'panel.inspector.cookies.edit.editTitle': 'Editar la cookie',
  'panel.inspector.cookies.edit.valueChanged': 'valor cambiado',
  'panel.inspector.cookies.edit.goneNote':
    'Esta cookie se eliminó en el navegador mientras el formulario estaba abierto — Guardar la vuelve a ' + 'escribir.',
  'panel.inspector.cookies.edit.openInTab': 'Abrir en una pestaña nueva',
  'panel.inspector.cookies.edit.openDirtyTitle':
    'Guarda o cancela tus cambios primero — el documento se abre desde el tarro del navegador',
  'panel.inspector.cookies.edit.openTitle': 'Abrir esta cookie como pestaña de documento',
  'panel.inspector.cookies.edit.save': 'Guardar',
  'panel.inspector.cookies.edit.unresolved': 'No se resuelve — crea la variable o corrige la referencia.',
  'panel.inspector.cookies.edit.writes': 'Escribe: {value}',
  'panel.inspector.cookies.edit.field.name': 'Name',
  'panel.inspector.cookies.edit.field.value': 'Value',
  'panel.inspector.cookies.edit.field.hostOnly': 'Host-only',
  'panel.inspector.cookies.edit.namePlaceholder': 'nombre de la cookie',
  'panel.inspector.cookies.edit.valuePlaceholder': 'valor o {{variable}}',
  'panel.inspector.cookies.edit.session': 'Session',
  'panel.inspector.cookies.edit.onDate': 'En la fecha',
  'panel.inspector.cookies.edit.sameSite.unspecified': 'Unspecified',
  'panel.inspector.cookies.edit.sameSite.noRestriction': 'None (cross-site)',
  'panel.inspector.cookies.edit.sameSite.lax': 'Lax',
  'panel.inspector.cookies.edit.sameSite.strict': 'Strict',
  'panel.inspector.cookies.edit.flagOn': 'Activado',
  'panel.inspector.cookies.edit.flagOff': 'Desactivado',
  // Pre-write constraint sentences.
  'panel.inspector.cookies.edit.constraint.hostSecure': 'Las cookies __Host- deben tener el indicador Secure activado.',
  'panel.inspector.cookies.edit.constraint.hostDomain':
    'Las cookies __Host- no pueden llevar un atributo Domain — activa «Host-only».',
  'panel.inspector.cookies.edit.constraint.hostPath': 'Las cookies __Host- deben usar la ruta «/».',
  'panel.inspector.cookies.edit.constraint.securePrefix':
    'Las cookies __Secure- deben tener el indicador Secure activado.',
  'panel.inspector.cookies.edit.constraint.sameSiteNone': 'SameSite «{label}» requiere el indicador Secure.',
  // Merge parse-back errors.
  'panel.inspector.cookies.edit.merge.invalidJson':
    'El resultado fusionado no es JSON válido — corrige la sintaxis y completa la fusión de nuevo.',
  'panel.inspector.cookies.edit.merge.notObject':
    'El resultado fusionado debe ser un objeto JSON con los campos de la cookie.',
  'panel.inspector.cookies.edit.merge.fieldMissing': '"{field}" debe estar presente como cadena.',
  'panel.inspector.cookies.edit.merge.flagOnOff': '"{field}" debe ser "{on}" o "{off}".',
  'panel.inspector.cookies.edit.merge.sameSiteOneOf': '"sameSite" debe ser uno de {labels}.',
  'panel.inspector.cookies.edit.merge.expiresInvalid':
    '"expires" debe ser "{session}" o una fecha como 2026-07-09T14:30.',

  // Edit-form field (i) corpus — titles are the raw attribute names.
  'panel.inspector.cookies.fieldInfo.exampleCaption': 'Ejemplo de Set-Cookie',
  'panel.inspector.cookies.fieldInfo.fieldKicker': 'Campo de Cookie',
  'panel.inspector.cookies.fieldInfo.flagKicker': 'Indicador de Cookie',
  'panel.inspector.cookies.fieldInfo.templateNote':
    'Acepta referencias {{variable}}, resueltas una vez al guardar — el tarro almacena el texto resuelto.',
  'panel.inspector.cookies.fieldInfo.name.summary':
    'El identificador de la cookie. Los navegadores indexan por (name, domain, path) — el mismo nombre con ' +
    'otro ámbito es una cookie distinta.',
  'panel.inspector.cookies.fieldInfo.name.description':
    'El navegador impone los prefijos: __Host- exige Secure, Path=/ y ningún Domain; __Secure- exige Secure.',
  'panel.inspector.cookies.fieldInfo.value.summary':
    'La carga útil de la cookie — lo que el navegador devuelve en el encabezado Cookie.',
  'panel.inspector.cookies.fieldInfo.value.description':
    'El valor es una instantánea: si la variable cambia después, el tarro conserva este texto — usa una regla ' +
    'Sustituir las cookies cuando el valor deba seguir a la variable.',
  'panel.inspector.cookies.fieldInfo.domain.summary': 'Qué hosts reciben la cookie.',
  'panel.inspector.cookies.fieldInfo.domain.description':
    'Un dominio simple como openheaders.com incluye sus subdominios (el navegador lo almacena con un punto ' +
    'inicial), salvo que Host-only esté activado, lo que fija la cookie exactamente a este host.',
  'panel.inspector.cookies.fieldInfo.path.summary':
    'Prefijo de ruta de URL por el que viaja la cookie — /api significa que solo la llevan las solicitudes ' +
    'bajo /api.',
  'panel.inspector.cookies.fieldInfo.path.description': 'Por defecto: /.',
  'panel.inspector.cookies.fieldInfo.expires.summary': 'Cuándo elimina el navegador la cookie.',
  'panel.inspector.cookies.fieldInfo.expires.description':
    'Las cookies de sesión viven hasta que termina la sesión del navegador; En la fecha define una caducidad ' +
    'absoluta (almacenada como el atributo Expires).',
  'panel.inspector.cookies.fieldInfo.samesite.summary': 'Cuándo pueden llevar la cookie las solicitudes cross-site.',
  'panel.inspector.cookies.fieldInfo.samesite.valuesHeading': 'Valores',
  'panel.inspector.cookies.fieldInfo.samesite.strict': 'Solo solicitudes same-site.',
  'panel.inspector.cookies.fieldInfo.samesite.lax':
    'Same-site más las navegaciones cross-site de nivel superior (GET).',
  'panel.inspector.cookies.fieldInfo.samesite.none': 'Enviada también cross-site — el navegador exige Secure con él.',
  'panel.inspector.cookies.fieldInfo.samesite.unspecified':
    'Valor por defecto del navegador (tratado como Lax en Chrome).',
  'panel.inspector.cookies.fieldInfo.httponly.summary':
    'Oculta la cookie al JavaScript de la página — document.cookie no puede leerla ni sobrescribirla.',
  'panel.inspector.cookies.fieldInfo.httponly.description':
    'Solo los servidores (Set-Cookie) y este editor pueden crear cookies HttpOnly; los scripts de página no. ' +
    'El endurecimiento estándar de los tokens de sesión.',
  'panel.inspector.cookies.fieldInfo.secure.summary':
    'La cookie viaja solo por HTTPS — las solicitudes http planas nunca la llevan.',
  'panel.inspector.cookies.fieldInfo.secure.description':
    'Requerido para SameSite=None y para los prefijos de nombre __Host- / __Secure-.',
  'panel.inspector.cookies.fieldInfo.hostonly.summary':
    'Fija la cookie exactamente al host del Domain — los subdominios no la reciben.',
  'panel.inspector.cookies.fieldInfo.hostonly.description':
    'Desactivado, la cookie se almacena para todo el dominio (forma con punto inicial) y fluye hacia los ' +
    'subdominios. Las cookies propias del navegador son host-only cuando el servidor omitió el atributo Domain.',

  // Column (i) corpus — column-name titles stay raw.
  'panel.inspector.cookies.columnInfo.name.summary':
    'El identificador de la cookie. Los navegadores indexan por (name, domain, path) — dos cookies con el ' +
    'mismo nombre pero distinto ámbito son distintas.',
  'panel.inspector.cookies.columnInfo.name.description':
    'Los chips de la derecha muestran hechos que no están en ninguna columna. Aparecen junto al nombre; pasa ' +
    'el cursor por una fila para revelar la acción Sustituir sobre el valor.',
  'panel.inspector.cookies.columnInfo.name.roleHeading': 'Rol (heurística)',
  'panel.inspector.cookies.columnInfo.name.authDesc':
    'Parece una cookie de auth / sesión — el nombre coincide con sess / session / auth / sid / token / csrf / ' +
    'xsrf, o la cookie es HttpOnly con un valor aleatorio largo.',
  'panel.inspector.cookies.columnInfo.name.trackingDesc':
    'Parece una cookie de analítica / rastreo — el nombre coincide con un rastreador conocido (_ga, _gid, ' +
    '_fbp, NID, IDE, MUID, _hjid, …), o la cookie es de terceros sin otra clasificación.',
  'panel.inspector.cookies.columnInfo.name.prefDesc':
    'Una cookie de preferencias del usuario — tz, lang, locale, theme, color-mode, currency, cpu-bucket, ' +
    'font-size, …',
  'panel.inspector.cookies.columnInfo.name.lifecycleHeading': 'Ciclo de vida',
  'panel.inspector.cookies.columnInfo.name.justSetDesc':
    'Un Set-Cookie llegó en esta respuesta y el navegador lo aceptó.',
  'panel.inspector.cookies.columnInfo.name.droppedDesc':
    'Un Set-Cookie llegó pero el navegador lo rechazará — incumplió una regla como SameSite=None sin Secure, ' +
    'violación del prefijo __Host-, prefijo __Secure- sin Secure, o Partitioned sin Secure.',
  'panel.inspector.cookies.columnInfo.name.filteredOutDesc':
    'El tarro contiene esta cookie pero no se envió en esta solicitud (ruta sin coincidencia, Secure sobre ' +
    'http, caducada, restricción SameSite, …). Solo aparece cuando «Mostrar las cookies de solicitud ' +
    'filtradas» está activado.',
  'panel.inspector.cookies.columnInfo.name.contextHeading': 'Contexto',
  'panel.inspector.cookies.columnInfo.name.thirdPartyDesc':
    'El dominio de la cookie es cross-site respecto al origen del marco superior de la página.',
  'panel.inspector.cookies.columnInfo.name.partitionedDesc':
    'Aislamiento de estilo CHIPS — la cookie se indexa por el sitio de nivel superior además de por su propio ' +
    'ámbito. Pasa el cursor para ver la clave de partición.',
  'panel.inspector.cookies.columnInfo.name.problemDesc':
    'Esta cookie activó una sugerencia (las tarjetas de aviso en la parte superior de la pestaña). Mira el ' +
    'recuadro para saber por qué.',
  'panel.inspector.cookies.columnInfo.name.prefixesHeading': 'Prefijos (visibles en el nombre)',
  'panel.inspector.cookies.columnInfo.name.hostPrefixDesc':
    'Fijada al host — el navegador impone Secure, Path=/ y ningún Domain. Las violaciones se rechazan.',
  'panel.inspector.cookies.columnInfo.name.securePrefixDesc':
    'Solo HTTPS — el navegador impone Secure. Las violaciones se rechazan.',
  'panel.inspector.cookies.columnInfo.value.summary':
    'La carga útil de la cookie. Haz clic en una fila para expandir un panel con vistas analizadas cuando el ' +
    'valor lleva estructura.',
  'panel.inspector.cookies.columnInfo.value.formatsHeading': 'Formatos autodetectados',
  'panel.inspector.cookies.columnInfo.value.jwtDesc':
    'Tres segmentos base64url — el encabezado y la carga útil se decodifican; los claims exp / iat / nbf se ' +
    'muestran como tiempos relativos.',
  'panel.inspector.cookies.columnInfo.value.jsonDesc':
    'Formateado en el panel expandido (funciona también tras la decodificación URL).',
  'panel.inspector.cookies.columnInfo.value.b64Desc':
    'Base64 simple — se muestra el cuerpo decodificado cuando es imprimible.',
  'panel.inspector.cookies.columnInfo.value.urlEncodedDesc':
    'Texto con codificación por porcentaje — activa «Decodificar los valores con codificación URL» en Vista ' +
    'para mostrar lo decodificado en línea.',
  'panel.inspector.cookies.columnInfo.scope.summary':
    'Dónde adjuntará el navegador esta cookie — la combinación de Domain + Path.',
  'panel.inspector.cookies.columnInfo.scope.description':
    'Un punto inicial en el dominio (p. ej. `.openheaders.com`) significa que se incluyen los subdominios. Una ' +
    'ruta final como `/api` significa que la cookie solo se envía en las solicitudes bajo esa ruta.',
  'panel.inspector.cookies.columnInfo.expires.summary':
    'Cuándo dejará el navegador de enviar esta cookie. El color refleja la urgencia.',
  'panel.inspector.cookies.columnInfo.expires.colorHeading': 'Cómo leer el color',
  'panel.inspector.cookies.columnInfo.expires.red': 'rojo',
  'panel.inspector.cookies.columnInfo.expires.redDesc': 'Ya caducada, o caduca en menos de una hora.',
  'panel.inspector.cookies.columnInfo.expires.yellow': 'amarillo',
  'panel.inspector.cookies.columnInfo.expires.yellowDesc': 'Caduca dentro de las próximas 24 horas.',
  'panel.inspector.cookies.columnInfo.expires.plain': 'neutro',
  'panel.inspector.cookies.columnInfo.expires.plainDesc': 'Futuro — a más de un día.',
  'panel.inspector.cookies.columnInfo.expires.sessionDesc':
    'Sin Expires / Max-Age — el navegador la descarta cuando termina la sesión.',
  'panel.inspector.cookies.columnInfo.expires.formatHeading': 'Formato',
  'panel.inspector.cookies.columnInfo.expires.relativeLabel': 'Relativo (predeterminado)',
  'panel.inspector.cookies.columnInfo.expires.relativeDesc':
    '«in 7mo», «30s ago» — relativos a ahora. Pasa el cursor para ver la fecha absoluta.',
  'panel.inspector.cookies.columnInfo.expires.absoluteLabel': 'Absoluto',
  'panel.inspector.cookies.columnInfo.expires.absoluteDesc': 'Fecha UTC. Cámbialo en Vista → Expires.',
  'panel.inspector.cookies.columnInfo.size.summary':
    'Tamaño serializado de la cookie en bytes — la longitud de `name=value`, usada para el total de carga por ' +
    'solicitud.',
  'panel.inspector.cookies.columnInfo.size.description':
    'La mayoría de los servidores e intermediarios limitan el encabezado Cookie combinado a 4 KB. Las cargas ' +
    'sobredimensionadas pueden causar respuestas 4xx / 5xx sin un error claro.',
  'panel.inspector.cookies.columnInfo.sec.title': 'Seguridad (S H L)',
  'panel.inspector.cookies.columnInfo.sec.summary':
    'Tres glifos condensan los atributos Secure / HttpOnly / SameSite en una sola celda. El color lleva el ' +
    'significado.',
  'panel.inspector.cookies.columnInfo.sec.glyphsHeading': 'Glifos',
  'panel.inspector.cookies.columnInfo.sec.sDesc': 'Secure — enviada solo por HTTPS.',
  'panel.inspector.cookies.columnInfo.sec.hDesc': 'HttpOnly — no se puede leer desde JavaScript.',
  'panel.inspector.cookies.columnInfo.sec.lDesc': 'Restricción SameSite (Lax / Strict / None).',
  'panel.inspector.cookies.columnInfo.sec.colorHeading': 'Color',
  'panel.inspector.cookies.columnInfo.sec.green': 'verde',
  'panel.inspector.cookies.columnInfo.sec.greenDesc': 'Activado / estricto — blindado.',
  'panel.inspector.cookies.columnInfo.sec.yellow': 'amarillo',
  'panel.inspector.cookies.columnInfo.sec.yellowDesc': 'Lax — enviada en los GET cross-site de nivel superior.',
  'panel.inspector.cookies.columnInfo.sec.red': 'rojo',
  'panel.inspector.cookies.columnInfo.sec.redDesc':
    'Falta donde se exige (SameSite=None sin Secure, __Host- sin Secure, …) — el navegador la rechazará.',
  'panel.inspector.cookies.columnInfo.sec.gray': 'gris',
  'panel.inspector.cookies.columnInfo.sec.grayDesc': 'Desactivado / sin especificar.',

  // Cookie insights (t-fed `computeCookieInsights`).
  'panel.inspector.cookies.insights.sameSiteNoneNoSecure.title': ({ count }, locale) =>
    plural(locale, Number(count), {
      one: '{count} cookie definida con SameSite=None pero sin Secure',
      many: '{count} cookies definidas con SameSite=None pero sin Secure',
      other: '{count} cookies definidas con SameSite=None pero sin Secure',
    }),
  'panel.inspector.cookies.insights.sameSiteNoneNoSecure.detail':
    'Los navegadores modernos rechazan las cookies SameSite=None que no sean también Secure — no se ' + 'almacenarán.',
  'panel.inspector.cookies.insights.sameSiteNoneNoSecure.action': 'Añadir el atributo Secure',
  'panel.inspector.cookies.insights.hostPrefix.title': 'Prefijo __Host- incumplido en {names}',
  'panel.inspector.cookies.insights.hostPrefix.detail':
    'Las cookies __Host- deben ser Secure, con Path=/ y sin atributo Domain. De lo contrario, los navegadores ' +
    'las rechazan.',
  'panel.inspector.cookies.insights.securePrefix.title': 'Prefijo __Secure- incumplido en {names}',
  'panel.inspector.cookies.insights.securePrefix.detail':
    'Las cookies __Secure- deben llevar el atributo Secure. De lo contrario, los navegadores las rechazan.',
  'panel.inspector.cookies.insights.partitionedNoSecure.title': ({ count }, locale) =>
    plural(locale, Number(count), {
      one: '{count} cookie Partitioned sin Secure',
      many: '{count} cookies Partitioned sin Secure',
      other: '{count} cookies Partitioned sin Secure',
    }),
  'panel.inspector.cookies.insights.partitionedNoSecure.detail': 'Las cookies Partitioned deben ser Secure.',
  'panel.inspector.cookies.insights.setOnHttp.title': 'Cookies definidas por HTTP plano',
  'panel.inspector.cookies.insights.setOnHttp.detail':
    'Cualquiera en el trayecto puede observar y reproducir estas cookies. Usa HTTPS + el atributo Secure.',
  'panel.inspector.cookies.insights.expiredSent.title': ({ count }, locale) =>
    plural(locale, Number(count), {
      one: '{count} cookie caducada que aún se envía',
      many: '{count} cookies caducadas que aún se envían',
      other: '{count} cookies caducadas que aún se envían',
    }),
  'panel.inspector.cookies.insights.expiredSent.detail':
    'Estas cookies tienen una caducidad en el pasado pero la solicitud las llevaba — el tarro las descartará ' +
    'en breve.',
  'panel.inspector.cookies.insights.oversized.title':
    'El encabezado Cookie ocupa {bytes}B (por encima del límite común de 4KB)',
  'panel.inspector.cookies.insights.oversized.detail':
    'Los servidores e intermediarios limitan el tamaño de los encabezados; las cargas Cookie ' +
    'sobredimensionadas pueden causar 4xx / 5xx sin un error claro.',
  'panel.inspector.cookies.insights.thirdPartySet.title': ({ count }, locale) =>
    plural(locale, Number(count), {
      one: '{count} cookie de terceros definida',
      many: '{count} cookies de terceros definidas',
      other: '{count} cookies de terceros definidas',
    }),
  'panel.inspector.cookies.insights.thirdPartySet.titleBy': ({ count, origin }, locale) => {
    const lead = plural(locale, Number(count), {
      one: '{count} cookie de terceros definida por',
      many: '{count} cookies de terceros definidas por',
      other: '{count} cookies de terceros definidas por',
    });
    return `${lead} ${String(origin)}`;
  },
  'panel.inspector.cookies.insights.thirdPartySet.detail':
    'Los navegadores modernos pueden bloquearlas en contextos cross-site salvo que opten por CHIPS mediante ' +
    'el atributo Partitioned.',
} as const satisfies Catalog;
