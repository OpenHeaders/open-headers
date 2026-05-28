/**
 * Default `openheaders://` deep-link consumer. Logs every URL via
 * `hostLogger` so the round-trip is observable in `main.log` end-to-end
 * even before the invite / env-import flows ship.
 *
 * Real consumers (invite redemption, environment import, workspace
 * deep-link) will register additional `oh.protocol.onUrl` handlers as
 * those flows land — `ipcRenderer.on` is additive, so the log line
 * stays in place as a backstop.
 */

import { hostLogger } from '@openheaders/core/logger';

window.oh.protocol.onUrl((url) => {
  hostLogger.info('protocol', 'received deep link:', url);
});
