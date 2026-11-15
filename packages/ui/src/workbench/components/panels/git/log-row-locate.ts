/**
 * log-row-locate — where a commit sits in the list an ask names
 * (`oh.workspaceTree.locateLogRow`), asked by its hash, the start of
 * one, or a ref's name. A bridge that throws reads as the verb's own
 * refusal, so a caller has one answer to take.
 */

import { hostBridge, type WorkspaceTreeLocateLogRowWire } from '@openheaders/core/bridge';
import type { LogRowsAsk } from './log-row-pages';

export async function locateLogRow(ask: LogRowsAsk, target: string): Promise<WorkspaceTreeLocateLogRowWire> {
  try {
    return await hostBridge.call('oh.workspaceTree.locateLogRow', { ...ask, target });
  } catch (fault) {
    return { ok: false, reason: 'log-failed', detail: fault instanceof Error ? fault.message : String(fault) };
  }
}
