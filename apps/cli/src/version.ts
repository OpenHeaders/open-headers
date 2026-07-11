/** Build-time version stamp; `dev` when running unbundled (tests, tsx). */

declare const __CLI_VERSION__: string | undefined;

export const CLI_VERSION: string = typeof __CLI_VERSION__ === 'string' ? __CLI_VERSION__ : 'dev';
