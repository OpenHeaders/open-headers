/**
 * The two request create menus share one row vocabulary: a code badge
 * then the protocol's short name (HTTP / gRPC / WebSocket / Socket.IO /
 * MQTT). The panel's `+` offers them under New Request ▸, a container's
 * `+` under Add Request ▸ beside Add Folder, and the flat list behind
 * an "Add request" button lists the same rows in the same order.
 */

import { DEFAULT_LOCALE, getTranslator } from '@openheaders/i18n';
import { buildRequestImportMenuItems } from '@openheaders/ui/workbench/components/sidebar/build-sidebar-menus';
import { containerAddMenuItems } from '@openheaders/ui/workbench/components/sidebar/menus';
import { buildRequestKindMenuItems, requestKindAddMenuItems } from '@openheaders/ui/workbench/request-kind-menu';
import type { ItemType } from 'antd/es/menu/interface';
import { describe, expect, it } from 'vitest';

const t = getTranslator(DEFAULT_LOCALE);

function labelOf(item: ItemType): string {
  return item && 'label' in item && typeof item.label === 'string' ? item.label : '';
}
function childrenOf(item: ItemType): ItemType[] {
  return item && 'children' in item && Array.isArray(item.children) ? item.children : [];
}

const SHORT = ['HTTP', 'gRPC', 'WebSocket', 'Socket.IO', 'MQTT'];

describe('request create menus', () => {
  it('New Request ▸ lists the five kinds by short name', () => {
    const items = buildRequestKindMenuItems(() => undefined, t);
    expect(items.map(labelOf)).toEqual(SHORT);
  });

  it('the panel + nests the kinds under New Request', () => {
    const items = buildRequestImportMenuItems(
      { createNewRequestCollection: async () => undefined, onCreateRequestOfKind: () => undefined },
      t,
    );
    const newRequest = items.find((i) => i && i.key === 'new-request');
    expect(newRequest && labelOf(newRequest)).toBe('New Request');
    expect(newRequest ? childrenOf(newRequest).map(labelOf) : []).toEqual(SHORT);
  });

  it('a container + nests the offered kinds under Add Request, then Add Folder', () => {
    const items = containerAddMenuItems(
      {
        onAddRequest: () => undefined,
        onAddGrpcRequest: () => undefined,
        onAddWebSocketRequest: () => undefined,
        onAddSocketIoRequest: () => undefined,
        onAddMqttRequest: () => undefined,
        onAddFolder: () => undefined,
      },
      t,
    );
    expect(items.map(labelOf)).toEqual(['Add Request', 'Add Folder']);
    expect(childrenOf(items[0]).map(labelOf)).toEqual(SHORT);
  });

  it('the flat add list keeps the canonical order and skips kinds with no handler', () => {
    const items = requestKindAddMenuItems({ onAddRequest: () => undefined, onAddMqttRequest: () => undefined }, t);
    expect(items.map(labelOf)).toEqual(['HTTP', 'MQTT']);
    expect(items.map((i) => (i ? i.key : null))).toEqual(['add-http-request', 'add-mqtt-request']);
  });
});
