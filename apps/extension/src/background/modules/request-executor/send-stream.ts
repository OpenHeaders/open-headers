/**
 * Live plumbing for interactive sends — the browser SW's wiring of the
 * host-neutral registry + flush-batched frame emitter in
 * `@openheaders/oracle/live/request-exec/send-stream`: the registry is
 * shared verbatim (the `abortRequestSend` handler stops sends the
 * executor registered), and the emitter's frames ride this host's
 * chrome-runtime broadcast.
 */

import {
  createStreamEmitter as createStreamEmitterCore,
  type StreamEmitter,
} from '@openheaders/oracle/live/request-exec/send-stream';
import { broadcast } from '@utils/bridge';

export { registerActiveSend, stopActiveSend } from '@openheaders/oracle/live/request-exec/send-stream';
export type { StreamEmitter };

export function createStreamEmitter(sendId: string): StreamEmitter {
  return createStreamEmitterCore(sendId, (event) => broadcast('requestStreamEvent', event));
}
