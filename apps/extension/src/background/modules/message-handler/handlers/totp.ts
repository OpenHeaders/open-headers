/**
 * The `oh.totp.*` routes on the browser host — the page realm's live
 * sessions gating and recording TOTP usage through THIS worker's
 * cooldown store, the one the HTTP sends ride (one truth per browser
 * profile). The partition key is the session's workspace, else the
 * runtime-Active one; the refusal sentence is the oracle's, so a
 * session and a send refuse in the same words.
 */

import type { BridgeRpcRequest, BridgeRpcResponse } from '@openheaders/core/bridge';
import type { TotpUsage } from '@openheaders/core/totp';
import { recordTotpUsages, totpCooldownRefusal } from '@openheaders/oracle/live/request-exec/totp-usage';
import { getActiveWorkspaceId } from '../../workspace/workspace-store';
import type { HandlerMap } from '../types';

function usagesOf(message: Record<string, unknown>): TotpUsage[] {
  return Array.isArray(message.usages) ? (message.usages as TotpUsage[]) : [];
}

function workspaceKeyOf(message: Record<string, unknown>): string {
  const pinned = (message as Partial<BridgeRpcRequest<'oh.totp.checkCooldown'>>).workspaceId;
  return typeof pinned === 'string' && pinned !== '' ? pinned : getActiveWorkspaceId();
}

export const totpHandlers: HandlerMap = {
  'oh.totp.checkCooldown': ({ message, respond }) => {
    const usages = usagesOf(message);
    const answer: BridgeRpcResponse<'oh.totp.checkCooldown'> = {
      refusal: usages.length === 0 ? null : totpCooldownRefusal(workspaceKeyOf(message), usages),
    };
    respond(answer);
  },
  'oh.totp.recordUsage': ({ message, respond }) => {
    const usages = usagesOf(message);
    if (usages.length > 0) recordTotpUsages(workspaceKeyOf(message), usages);
    const answer: BridgeRpcResponse<'oh.totp.recordUsage'> = { ok: true };
    respond(answer);
  },
};
