/**
 * Shared contract for the message-handler dispatch table.
 *
 * Every non-rule-CRUD RPC from an extension surface (popup, sidepanel,
 * workbench, devtools panel) resolves to one {@link MessageHandler} keyed
 * by `message.type` in the registry. The router (`index.ts`) owns the early
 * branches (script-host, sync-RPC passthrough) and the unknown/`proxy-*`
 * fallthrough; everything else is a table entry.
 */

import type { MessageHandlerContext, SendResponse } from '@/types/browser';

export interface HandlerArgs {
  /** Raw message payload. Handlers cast their own fields. */
  message: Record<string, unknown>;
  /** Runtime sender — tab/window context for tab-scoped RPCs. */
  sender: chrome.runtime.MessageSender;
  /** Channel-safe response sink (swallows "channel closed" errors). */
  respond: SendResponse;
  /** Background services threaded from the SW boot wiring. */
  ctx: MessageHandlerContext;
}

/**
 * A domain handler. Return `true` to keep the message channel open for an
 * async `respond` (the `chrome.runtime.onMessage` contract); return nothing
 * when the reply was already sent synchronously. The `void` arm mirrors that
 * listener contract — a synchronous handler simply falls off the end.
 */
// biome-ignore lint/suspicious/noConfusingVoidType: the void arm mirrors the chrome.runtime.onMessage listener return contract (sync handlers fall off the end).
export type MessageHandler = (args: HandlerArgs) => boolean | void;

/** Maps a `message.type` to its handler. */
export type HandlerMap = Record<string, MessageHandler>;
