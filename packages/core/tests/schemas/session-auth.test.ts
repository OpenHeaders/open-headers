/**
 * The session kinds' own-auth schemas — the request defines any type
 * its kind can carry. Pins:
 *   - each schema admits exactly its kind's mask plus `inherit`, and
 *     refuses a type outside it by the discriminant;
 *   - the mask and the schema read the same list (one source);
 *   - `authFitsKind` narrows the shared form's output to the kind.
 */

import * as v from 'valibot';
import { describe, expect, it } from 'vitest';
import { authFitsKind, authMaskFor } from '../../src/auth-inheritance';
import {
  GRPC_AUTH_TYPES,
  GrpcAuthSchema,
  HTTP_AUTH_TYPES,
  MQTT_AUTH_TYPES,
  MqttAuthSchema,
  WEBSOCKET_AUTH_TYPES,
  WebSocketAuthSchema,
} from '../../src/schemas';
import type { AuthConfig, ConcreteAuthConfig, GrpcAuth, MqttAuth, WebSocketAuth } from '../../src/types';

const SAMPLES: { [T in ConcreteAuthConfig['type']]: Extract<ConcreteAuthConfig, { type: T }> } = {
  none: { type: 'none' },
  basic: { type: 'basic', username: 'john.doe', password: 'secret' },
  bearer: { type: 'bearer', token: 't' },
  'api-key': { type: 'api-key', key: 'X-Api-Key', value: 'v', in: 'header' },
  oauth2: {
    type: 'oauth2',
    credentialRef: 'oauth2-cred-abc12345',
    flow: 'client-credentials',
    tokenEndpoint: 'https://idp.openheaders.io/token',
    clientId: 'client',
    scopes: [],
  },
  'aws-sigv4': { type: 'aws-sigv4', accessKeyId: 'a', secretAccessKey: 's', service: '', region: '', addTo: 'query' },
  edgegrid: { type: 'edgegrid', clientToken: 'c', accessToken: 'a', clientSecret: 's' },
  asap: { type: 'asap', algorithm: 'RS256', issuer: 'i', audience: 'a', keyId: 'k', privateKey: 'p' },
  digest: { type: 'digest', username: 'john.doe', password: 'secret' },
  oauth1: {
    type: 'oauth1',
    consumerKey: 'k',
    consumerSecret: 's',
    signatureMethod: 'HMAC-SHA1',
    paramsLocation: 'header',
  },
  hawk: { type: 'hawk', authId: 'i', authKey: 'k', algorithm: 'sha256' },
  jwt: { type: 'jwt', algorithm: 'HS256', secret: 's', privateKey: '', payload: '{}', addTo: 'header' },
  'http-signature': {
    type: 'http-signature',
    algorithm: 'hmac-sha256',
    privateKey: '',
    secret: 's',
    components: '@method @target-uri',
  },
};

const KINDS = [
  { kind: 'websocket', schema: WebSocketAuthSchema, types: WEBSOCKET_AUTH_TYPES },
  { kind: 'grpc', schema: GrpcAuthSchema, types: GRPC_AUTH_TYPES },
  { kind: 'mqtt', schema: MqttAuthSchema, types: MQTT_AUTH_TYPES },
] as const;

describe('the session kinds’ own-auth schemas', () => {
  it.each(KINDS)('$kind admits exactly its mask plus inherit', ({ kind, schema, types }) => {
    expect([...authMaskFor(kind)].sort()).toEqual([...types].sort());
    for (const type of HTTP_AUTH_TYPES) {
      const result = v.safeParse(schema, SAMPLES[type]);
      expect(result.success, `${kind} ${type}`).toBe(authMaskFor(kind).has(type));
    }
    expect(v.safeParse(schema, { type: 'inherit' }).success).toBe(true);
    expect(v.safeParse(schema, { type: 'inherit', authUid: 'entry001' }).success).toBe(true);
  });

  it('the HTTP list is every concrete type', () => {
    expect([...HTTP_AUTH_TYPES].sort()).toEqual(Object.keys(SAMPLES).sort());
  });

  it('the inferred types are the exact subsets', () => {
    const ws: WebSocketAuth = SAMPLES.oauth2;
    const grpc: GrpcAuth = SAMPLES.jwt;
    const mqtt: MqttAuth = SAMPLES.basic;
    // @ts-expect-error — digest is outside every session mask.
    const refusedWs: WebSocketAuth = SAMPLES.digest;
    // @ts-expect-error — the AWS signature never rides a gRPC call.
    const refusedGrpc: GrpcAuth = SAMPLES['aws-sigv4'];
    // @ts-expect-error — MQTT carries the CONNECT pair alone.
    const refusedMqtt: MqttAuth = SAMPLES.bearer;
    const wide: AuthConfig[] = [ws, grpc, mqtt, refusedWs, refusedGrpc, refusedMqtt];
    expect(wide).toHaveLength(6);
  });
});

describe('authFitsKind', () => {
  it('admits inherit and the masked types, refuses the rest', () => {
    expect(authFitsKind('grpc', { type: 'inherit' })).toBe(true);
    expect(authFitsKind('grpc', SAMPLES.oauth2)).toBe(true);
    expect(authFitsKind('grpc', SAMPLES['aws-sigv4'])).toBe(false);
    expect(authFitsKind('websocket', SAMPLES['aws-sigv4'])).toBe(true);
    expect(authFitsKind('mqtt', SAMPLES.bearer)).toBe(false);
    expect(authFitsKind('http', SAMPLES.digest)).toBe(true);
  });

  it('narrows to the kind’s own type', () => {
    const next: ConcreteAuthConfig = SAMPLES.jwt;
    let stored: GrpcAuth = { type: 'none' };
    if (authFitsKind('grpc', next)) stored = next;
    expect(stored.type).toBe('jwt');
  });
});
