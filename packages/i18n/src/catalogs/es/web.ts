/**
 * Web namespace — Spanish. Mirrors `catalogs/en/web.ts` key for key;
 * the 'OpenHeaders' brand, `daemon` (m.), the `ohd show-token`
 * command, URLs and the `oh-license.` key prefix stay raw. Mints:
 * seat = plaza (f.); email rides raw (m.); pairing token = token de
 * emparejamiento; reverse proxy = proxy inverso (quoted README
 * section titles stay raw English).
 */

import type { Catalog } from '../../types';

export const web = {
  'web.gate.titleSignIn': 'Iniciar sesión en este servidor',
  'web.gate.titlePair': 'Emparejar con este servidor',
  'web.gate.introSso': 'Inicia sesión con {provider} o pega abajo un token de emparejamiento.',
  'web.gate.introPassword':
    'Inicia sesión con el email y la contraseña que el admin del servidor definió para ti, o pega abajo un token ' +
    'de emparejamiento.',
  'web.gate.introTokenPrefix':
    'Este servidor de OpenHeaders exige un token de emparejamiento. Genera uno en la máquina que lo ejecuta con',
  'web.gate.introTokenSuffix': 'y pégalo abajo.',
  'web.gate.ssoButton': 'Iniciar sesión con {provider}',
  'web.gate.or': 'o',
  'web.gate.emailPlaceholder': 'Email',
  'web.gate.passwordPlaceholder': 'Contraseña',
  'web.gate.signIn': 'Iniciar sesión',
  'web.gate.tokenPlaceholder': 'Token de emparejamiento',
  'web.gate.connect': 'Conectar',
  'web.gate.workLocally': 'Omitir — trabajar en local',
  'web.gate.errorTokenRejected': 'El servidor rechazó este token. Compruébalo y vuelve a intentarlo.',
  'web.gate.errorTokenOffline': 'El servidor no respondió. Comprueba que está en marcha y vuelve a intentarlo.',
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
    'El inicio de sesión único falló. Vuelve a intentarlo o conéctate con un token de emparejamiento.',
  'web.insecure.title': 'Esta página necesita una conexión segura',
  'web.insecure.intro':
    'El Workbench de OpenHeaders guarda todos sus datos en este perfil del navegador y necesita las API de ' +
    'criptografía del navegador, disponibles solo en orígenes seguros.',
  'web.insecure.waysIn': 'Ábrela de una de estas formas:',
  'web.insecure.httpsPrefix':
    'Por HTTPS — pon el servidor detrás de un proxy inverso TLS (consulta «Behind a reverse proxy» en el README ' +
    'del servidor) y abre',
  'web.insecure.httpsSuffix': '.',
  'web.insecure.loopbackPrefix': 'En la propia máquina del servidor en',
  'web.insecure.loopbackSuffix': '.',
} as const satisfies Catalog;
