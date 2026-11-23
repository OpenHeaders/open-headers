/**
 * The host end of one renderer lifeline — the {@link IncomingLifelinePort}
 * an acceptor is handed. Transport-free: frames travel down through the
 * injected `post`, and the port registry feeds renderer frames and the
 * disconnect in through `fireMessage` / `fireDisconnect`.
 */

import type { IncomingLifelinePort } from '@openheaders/core/awareness';
import { hostLogger as logger } from '@openheaders/core/logger';

const SCOPE = 'IpcLifelineServer';

type MessageHandler = (message: unknown) => void;
type DisconnectHandler = (info: { errorMessage?: string }) => void;

export class ManagedIncomingPort implements IncomingLifelinePort {
  private readonly messageHandlers = new Set<MessageHandler>();
  private readonly disconnectHandlers = new Set<DisconnectHandler>();
  private disconnected = false;

  constructor(
    readonly name: string,
    private readonly post: (message: unknown) => void,
  ) {}

  /** Host→renderer frame. Dropped once the port has disconnected. */
  postMessage(message: unknown): void {
    if (this.disconnected) return;
    this.post(message);
  }

  onMessage<T = unknown>(handler: (message: T) => void): void {
    this.messageHandlers.add(handler as MessageHandler);
  }

  onDisconnect(handler: DisconnectHandler): void {
    this.disconnectHandlers.add(handler);
  }

  /** Deliver a frame the renderer streamed up this port. */
  fireMessage(message: unknown): void {
    if (this.disconnected) return;
    for (const handler of this.messageHandlers) {
      try {
        handler(message);
      } catch (err) {
        logger.warn(SCOPE, `port "${this.name}": onMessage handler threw`, err);
      }
    }
  }

  /** Deliver the disconnect. Idempotent. */
  fireDisconnect(info: { errorMessage?: string }): void {
    if (this.disconnected) return;
    this.disconnected = true;
    for (const handler of this.disconnectHandlers) {
      try {
        handler(info);
      } catch (err) {
        logger.warn(SCOPE, `port "${this.name}": onDisconnect handler threw`, err);
      }
    }
  }
}
