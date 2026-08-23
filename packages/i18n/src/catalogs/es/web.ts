/**
 * Web namespace — Spanish. Mirrors `catalogs/en/web.ts` key for key;
 * the 'OpenHeaders' brand, `daemon` (m.), URLs and the `oh-license.`
 * key prefix stay raw. Mints: seat = plaza (f.); email rides raw (m.);
 * pairing = emparejamiento (m.); setup code = código de configuración
 * (m.); reverse proxy = proxy inverso.
 */

import { plural } from '../../runtime';
import type { Catalog } from '../../types';

export const web = {
  'web.gate.titleSignIn': 'Iniciar sesión en este servidor',
  'web.gate.titleSetup': 'Configurar este servidor',
  'web.gate.introSso': 'Inicia sesión con {provider} para entrar en este servidor de OpenHeaders.',
  'web.gate.introPassword': 'Inicia sesión con el email y la contraseña que el admin del servidor definió para ti.',
  'web.gate.introSetup':
    'Nadie ha configurado aún este servidor de OpenHeaders. Crea la primera cuenta: administra el servidor y ' +
    'pasa a ser dueña de todo lo que ya hay en él.',
  'web.gate.introNoLogin':
    'En este servidor ningún navegador puede iniciar sesión: el inicio de sesión único no está configurado y ' +
    'ninguna cuenta tiene contraseña. Pide a quien lo administra que te ponga una.',
  'web.gate.ssoButton': 'Iniciar sesión con {provider}',
  'web.gate.emailPlaceholder': 'Email',
  'web.gate.passwordPlaceholder': 'Contraseña',
  'web.gate.signIn': 'Iniciar sesión',
  'web.gate.setupNamePlaceholder': 'Tu nombre',
  'web.gate.setupConfirmPlaceholder': 'Confirmar contraseña',
  'web.gate.setupPasswordHint':
    'Al menos {min} caracteres. No hay forma de restablecer la contraseña: guárdala en un sitio seguro.',
  'web.gate.setupCodePlaceholder': 'Código de configuración (opcional)',
  'web.gate.setupCodeHint':
    'Solo hace falta cuando este navegador no se ejecuta en el propio servidor. El servidor muestra el código al ' +
    'arrancar, y cada reinicio lo sustituye por uno nuevo.',
  'web.gate.setupSubmit': 'Crear la cuenta',
  'web.gate.setupDoneTitle': 'Este servidor está configurado',
  'web.gate.setupDoneRepair': ({ count }, locale) =>
    plural(locale, Number(count), {
      one:
        'La configuración desemparejó {count} dispositivo, para que no siga administrando este servidor al ' +
        'margen de tu nueva cuenta. Vuelve a emparejarlo desde Ajustes.',
      many:
        'La configuración desemparejó {count} dispositivos, para que no sigan administrando este servidor al ' +
        'margen de tu nueva cuenta. Vuelve a emparejarlos desde Ajustes.',
      other:
        'La configuración desemparejó {count} dispositivos, para que no sigan administrando este servidor al ' +
        'margen de tu nueva cuenta. Vuelve a emparejarlos desde Ajustes.',
    }),
  'web.gate.setupDoneContinue': 'Continuar',
  'web.gate.setupDoneReload': 'Recargar',
  'web.gate.setupErrorDisplayName': 'Escribe el nombre que llevará la cuenta.',
  'web.gate.setupErrorEmail': 'Escribe el email con el que iniciar sesión.',
  'web.gate.setupErrorPasswordShort': 'Usa al menos {min} caracteres.',
  'web.gate.setupErrorPasswordMismatch': 'Las dos contraseñas no coinciden.',
  'web.gate.setupErrorMalformed': 'El servidor no pudo leer el formulario. Recarga la página y vuelve a intentarlo.',
  'web.gate.setupErrorRefused':
    'El servidor rechazó la configuración. Puede que ya esté configurado, o que el código de configuración sea ' +
    'incorrecto o de un arranque anterior: el servidor muestra uno nuevo en cada reinicio.',
  'web.gate.setupErrorSessionRefused':
    'La cuenta se creó, pero esta pestaña no pudo abrir una sesión. Recarga la página e inicia sesión con ella.',
  'web.gate.clientsIntro':
    'Esta pestaña no es el único cliente. La extensión y la aplicación de escritorio llegan a este servidor ' +
    'directamente en',
  'web.gate.clientsExtension': 'Obtener la extensión',
  'web.gate.clientsDesktop': 'Obtener la aplicación de escritorio',
  'web.gate.errorServerOffline': 'El servidor no respondió. Comprueba que está en marcha y vuelve a intentarlo.',
  'web.gate.errorPasswordRefused':
    'No se pudo iniciar sesión. Comprueba el email y la contraseña y vuelve a intentarlo.',
  'web.gate.errorSessionRefused': 'El servidor no aceptó la sesión. Vuelve a intentarlo.',
  'web.gate.seatIntroPrefix':
    '¿Tienes una plaza individual? Pega su clave para iniciar sesión sin esperar una plaza de equipo libre — ' +
    'admite el email con el que se compró. Consigue una en',
  'web.gate.seatIntroSuffix': '.',
  'web.gate.seatKeyPlaceholder': 'Clave de plaza individual (oh-license.…)',
  'web.gate.seatSignIn': 'Iniciar sesión con plaza individual',
  'web.overlay.signingIn': 'Iniciando tu sesión…',
  'web.overlay.takingYouTo': 'Llevándote a {provider}…',
  'web.oidcError.unknownUser':
    'Sesión iniciada, pero este servidor no tiene ningún usuario para tu email. Pide al admin del servidor que te ' +
    'añada.',
  'web.oidcError.userDeactivated':
    'Sesión iniciada, pero tu usuario en este servidor está desactivado. Habla con el admin del servidor.',
  'web.oidcError.emailUnverified':
    'Tu proveedor de identidad indica que el email no está verificado. Verifícalo y vuelve a intentarlo.',
  'web.oidcError.providerUnavailable':
    'No se pudo contactar con el proveedor de identidad. Vuelve a intentarlo en un momento.',
  'web.oidcError.seatLimitReached':
    'Sesión iniciada, pero este servidor no tiene plazas libres para un usuario nuevo. Habla con el admin del ' +
    'servidor — o entra ahora mismo con tu propia plaza individual.',
  'web.oidcError.personalSeatsDisabled':
    'Las plazas individuales están desactivadas en este servidor. Pregunta al admin del servidor por una plaza.',
  'web.oidcError.personalLicenseInvalid':
    'Esa clave de plaza individual no sirve — es inválida, ha caducado o no es una plaza individual. Comprueba ' +
    'la clave y vuelve a intentarlo.',
  'web.oidcError.personalLicenseIdentityMismatch':
    'Esa plaza individual pertenece a otro email. Solo admite la dirección con la que se compró.',
  'web.oidcError.personalLicenseNoIdentity':
    'Tu inicio de sesión no llevaba ningún email que confrontar con la plaza individual. Habla con el admin ' +
    'del servidor.',
  'web.oidcError.failed':
    'El inicio de sesión único falló. Vuelve a intentarlo o pide a quien administra el servidor que revise el ' +
    'proveedor.',
  'web.insecure.title': 'Esta página necesita una conexión segura',
  'web.insecure.intro':
    'Esta pestaña ejecuta todo el Workbench, no una vista ligera del servidor, así que tiene que generar una ' +
    'identidad para este dispositivo — algo que los navegadores solo permiten en un origen seguro.',
  'web.insecure.optionLocal': 'En el propio servidor:',
  'web.insecure.optionTls': 'Desde aquí por HTTPS — pon delante un proxy inverso que termine TLS.',
  'web.insecure.optionClients':
    'Desde aquí sin TLS — la extensión y la aplicación de escritorio se conectan directamente a',
} as const satisfies Catalog;
