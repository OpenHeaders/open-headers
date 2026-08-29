/**
 * Shared request-kind menu definitions — the four protocols the API
 * Requests family can author, in one canonical order, so no surface
 * has to pick a default kind on the user's behalf.
 *
 * Two vocabularies, each set by the gesture that carries it:
 *
 *   - `buildRequestKindMenuItems` — the destination-less create menus
 *     ("New Request ▸ HTTP"), every kind offered.
 *   - `requestKindAddMenuItems` — the kinds a known container can add:
 *     under "Add Request ▸" on its `+` menu, flat behind the "Add
 *     request" button an empty container or overview offers.
 *
 * Both draw the same row: the code badge the sidebar leaf / tab will
 * show, then the protocol's short name — the parent (or the button)
 * already said "request".
 */

import type { MessageKey } from '@openheaders/i18n';
import type { Translate } from '@openheaders/ui/context/LocaleContext';
import type { ItemType } from 'antd/es/menu/interface';
import { codeBadge } from './components/shared/code-badge';

/** Protocol flavors offered by every context-less request create. */
export type RequestKind = 'http' | 'grpc' | 'websocket' | 'socketio' | 'mqtt';

export interface RequestKindMenuItem {
  key: RequestKind;
  /** Badge text — the tag the sidebar leaf / tab carries for this kind. */
  code: string;
  labelKey: MessageKey;
}

/** All request kinds with their menu metadata. Array order is the
 *  definitive display order across every request create menu. */
export const ALL_REQUEST_KINDS: RequestKindMenuItem[] = [
  { key: 'http', code: 'HTTP', labelKey: 'shared.requestKinds.http.label' },
  { key: 'grpc', code: 'gRPC', labelKey: 'shared.requestKinds.grpc.label' },
  { key: 'websocket', code: 'WS', labelKey: 'shared.requestKinds.websocket.label' },
  { key: 'socketio', code: 'S.IO', labelKey: 'shared.requestKinds.socketio.label' },
  { key: 'mqtt', code: 'MQTT', labelKey: 'shared.requestKinds.mqtt.label' },
];

/** The four-character kind codes sit tighter than the rule codes. */
const REQUEST_KIND_BADGE_WIDTH = 36;

/**
 * Build Ant Design menu items for the destination-less create menus.
 */
export function buildRequestKindMenuItems(onClick: (kind: RequestKind) => void, t: Translate) {
  return ALL_REQUEST_KINDS.map((rk) => ({
    key: rk.key,
    icon: codeBadge(rk.code, REQUEST_KIND_BADGE_WIDTH),
    label: t(rk.labelKey),
    onClick: () => onClick(rk.key),
  }));
}

export interface RequestKindAddMenuOptions {
  /** Requests side — single "Add Request" item. */
  onAddRequest?: () => void;
  /** Requests side — "Add gRPC Request" item (sibling entity kind). */
  onAddGrpcRequest?: () => void;
  /** Requests side — "Add WebSocket Request" item (session-shaped
   *  sibling entity kind, raw flavor). */
  onAddWebSocketRequest?: () => void;
  /** Requests side — "Add Socket.IO Request" item (same entity kind,
   *  socketio flavor — the two-entry family anatomy). */
  onAddSocketIoRequest?: () => void;
  /** Requests side — "Add MQTT Request" item (pub/sub session-shaped
   *  sibling entity kind). */
  onAddMqttRequest?: () => void;
}

/**
 * The protocol rows a request container can add — the four kinds in
 * their canonical order. Shared by a container's `+` menu and by the
 * "Add request" buttons an empty container offers (sidebar placeholder,
 * overview tabs), so no surface silently picks HTTP on the user's
 * behalf.
 */
export function requestKindAddMenuItems(
  { onAddRequest, onAddGrpcRequest, onAddWebSocketRequest, onAddSocketIoRequest, onAddMqttRequest }: RequestKindAddMenuOptions,
  t: Translate,
): ItemType[] {
  const handlers: Partial<Record<RequestKind, () => void>> = {
    http: onAddRequest,
    grpc: onAddGrpcRequest,
    websocket: onAddWebSocketRequest,
    socketio: onAddSocketIoRequest,
    mqtt: onAddMqttRequest,
  };
  const items: ItemType[] = [];
  for (const rk of ALL_REQUEST_KINDS) {
    const onClick = handlers[rk.key];
    if (!onClick) continue;
    items.push({
      key: `add-${rk.key}-request`,
      icon: codeBadge(rk.code, REQUEST_KIND_BADGE_WIDTH),
      label: t(rk.labelKey),
      onClick,
    });
  }
  return items;
}
