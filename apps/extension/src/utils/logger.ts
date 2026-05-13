/**
 * Logger re-export — the actual logger lives in @openheaders/core/utils.
 * This shim keeps the extension's 77 internal `@utils/logger` consumers
 * working without a sweeping codemod.
 */

export { isValidLogLevel, logger, type LogLevel } from '@openheaders/core/utils';
