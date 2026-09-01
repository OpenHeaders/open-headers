/**
 * `/api/echo` auth assertions shared by the request e2e specs — one
 * reading of the reflection's `auth` / `headers` / `query` blocks per
 * expected-wire kind (`playground/scripts/auth-type-suite.ts`), so the
 * RPC and DOM layers assert the same vocabulary.
 */

import { expect } from '@playwright/test';
import type { ExpectedAuthWire } from '../../../../../playground/scripts/auth-type-suite';

/** The auth-bearing slice of the `/api/echo` reflection (`playground/server/api-echo.ts`). */
export interface EchoAuthResponse {
  headers: Record<string, string | string[] | undefined>;
  query: Record<string, string | string[]>;
  auth:
    | { kind: 'none' }
    | { kind: 'basic'; username: string; password: string }
    | { kind: 'bearer'; token: string }
    | { kind: 'scheme'; scheme: string; token: string };
}

const JWT_COMPACT = /^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/;

export function assertEchoAuth(echo: EchoAuthResponse, expected: ExpectedAuthWire): void {
  switch (expected.kind) {
    case 'none':
      expect(echo.auth.kind).toBe('none');
      break;
    case 'basic':
      expect(echo.auth).toMatchObject({ kind: 'basic', username: expected.username, password: expected.password });
      break;
    case 'bearer':
      expect(echo.auth).toMatchObject({ kind: 'bearer', token: expected.token });
      break;
    case 'header':
      // api-key in a header — no Authorization, the key rides its own header.
      expect(echo.auth.kind).toBe('none');
      expect(echo.headers[expected.name]).toBe(expected.value);
      break;
    case 'query':
      // api-key in the query string / oauth2 sendAs:query.
      expect(echo.query[expected.name]).toBe(expected.value);
      break;
    case 'scheme':
      expect(echo.auth).toMatchObject({ kind: 'scheme', scheme: expected.scheme });
      break;
    case 'bearer-jwt':
      expect(echo.auth.kind).toBe('bearer');
      expect((echo.auth as { token: string }).token).toMatch(JWT_COMPACT);
      break;
  }
}
