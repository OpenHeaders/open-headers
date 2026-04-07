/**
 * WebSocket Rule Handler (v5 stub)
 * Broadcasts V5 rules to connected browser extensions and handles toggle/delete messages.
 * Will be expanded when the extension protocol is updated for v5 rule format.
 */

import type { V5 } from '@openheaders/core/types';
import WS from 'ws';
import mainLogger from '@/utils/mainLogger';

const { createLogger } = mainLogger;
const log = createLogger('WSRuleHandler');

export interface RuleClientSender {
  sendRulesToClient(ws: WS): Promise<void>;
}

interface RuleHandlerDeps {
  rules: V5.Rule[];
  _broadcastToAll(message: string): number;
}

class WSRuleHandler implements RuleClientSender {
  private wsService: RuleHandlerDeps;

  constructor(wsService: RuleHandlerDeps) {
    this.wsService = wsService;
  }

  updateRules(rules: V5.Rule[]): void {
    this.wsService.rules = rules;
    this.broadcastRules();
  }

  broadcastRules(): void {
    const message = JSON.stringify({
      type: 'rulesUpdate',
      rules: this.wsService.rules,
    });
    const count = this.wsService._broadcastToAll(message);
    log.info(`Broadcast ${this.wsService.rules.length} rules to ${count} client(s)`);
  }

  async sendRulesToClient(ws: WS): Promise<void> {
    if (ws.readyState !== WS.OPEN) return;
    const message = JSON.stringify({
      type: 'rulesUpdate',
      rules: this.wsService.rules,
    });
    ws.send(message);
    log.info(`Sent ${this.wsService.rules.length} rules to client`);
  }

  async handleToggleRule(ruleId: string | number, enabled: boolean): Promise<void> {
    log.info(`Toggle rule ${ruleId} to ${enabled} — not yet implemented for v5`);
  }

  async handleToggleAllRules(ruleIds: string[], enabled: boolean): Promise<void> {
    log.info(`Toggle ${ruleIds.length} rules to ${enabled} — not yet implemented for v5`);
  }

  async handleDeleteRule(ruleId: string | number): Promise<boolean> {
    log.info(`Delete rule ${ruleId} — not yet implemented for v5`);
    return false;
  }
}

export { WSRuleHandler };
