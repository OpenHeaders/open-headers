/**
 * Valibot schemas for the session script slot record
 * (`@openheaders/core/scripts` — `ScriptSlotRecord`): one optional
 * string per kind, keyed by the kind itself. A container carries the
 * whole record; a session request carries its own kind's keys only.
 * The record never serializes into a manifest — every key fans out to
 * its `<kind>.js` sibling (invariant #9, two-file scripts) — so the
 * schemas gate the sync write and the in-memory shape alone. The
 * literal objects keep the static key types; `tests/schemas` pins each
 * one's keys against the kind lists.
 */

import * as v from 'valibot';

const slot = v.optional(v.string());

export const GrpcScriptSlotsSchema = v.object({
  'grpc-before-invoke': slot,
  'grpc-on-message': slot,
  'grpc-after-response': slot,
});

export const WsScriptSlotsSchema = v.object({
  'ws-before-connect': slot,
  'ws-before-send': slot,
  'ws-on-message': slot,
  'ws-after-close': slot,
});

export const MqttScriptSlotsSchema = v.object({
  'mqtt-before-connect': slot,
  'mqtt-before-publish': slot,
  'mqtt-on-message': slot,
  'mqtt-after-close': slot,
});

/** Every session kind — the container's record. */
export const SessionScriptSlotsSchema = v.object({
  ...GrpcScriptSlotsSchema.entries,
  ...WsScriptSlotsSchema.entries,
  ...MqttScriptSlotsSchema.entries,
});
