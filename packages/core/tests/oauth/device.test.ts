/**
 * Device Authorization Grant (RFC 8628) — the parser and the pure poll
 * reducer, every §3.5 branch walked at a pinned clock.
 */

import { describe, expect, it } from 'vitest';
import {
  approvalOf,
  DEVICE_CODE_GRANT_TYPE,
  DEVICE_DEFAULT_INTERVAL_SECONDS,
  deviceVerificationUrl,
  type OAuth2DeviceAuthorization,
  parseDeviceAuthorizationResponse,
  stepDevicePoll,
} from '../../src/oauth';

const NOW = 1_700_000_000_000;

const RESPONSE = {
  device_code: 'dc-secret',
  user_code: 'OHDC-1234',
  verification_uri: 'https://auth.openheaders.io/device',
  verification_uri_complete: 'https://auth.openheaders.io/device?user_code=OHDC-1234',
  expires_in: 600,
  interval: 5,
};

function pending(overrides: Partial<OAuth2DeviceAuthorization> = {}): OAuth2DeviceAuthorization {
  return { ...parseDeviceAuthorizationResponse(RESPONSE, NOW), ...overrides };
}

describe('parseDeviceAuthorizationResponse', () => {
  it('folds the §3.2 response into the pending record with an absolute expiry', () => {
    const parsed = parseDeviceAuthorizationResponse(RESPONSE, NOW);
    expect(parsed).toEqual({
      deviceCode: 'dc-secret',
      userCode: 'OHDC-1234',
      verificationUri: 'https://auth.openheaders.io/device',
      verificationUriComplete: 'https://auth.openheaders.io/device?user_code=OHDC-1234',
      expiresAt: NOW + 600_000,
      intervalSeconds: 5,
    });
  });

  it('defaults a missing interval to five seconds and refuses a non-positive one', () => {
    const { interval: _omit, ...withoutInterval } = RESPONSE;
    expect(parseDeviceAuthorizationResponse(withoutInterval, NOW).intervalSeconds).toBe(
      DEVICE_DEFAULT_INTERVAL_SECONDS,
    );
    expect(parseDeviceAuthorizationResponse({ ...RESPONSE, interval: 0 }, NOW).intervalSeconds).toBe(5);
    expect(parseDeviceAuthorizationResponse({ ...RESPONSE, interval: '10' }, NOW).intervalSeconds).toBe(10);
  });

  it('keeps the complete URI optional', () => {
    const { verification_uri_complete: _omit, ...plain } = RESPONSE;
    const parsed = parseDeviceAuthorizationResponse(plain, NOW);
    expect(parsed.verificationUriComplete).toBeUndefined();
    expect(deviceVerificationUrl(parsed)).toBe('https://auth.openheaders.io/device');
    expect(deviceVerificationUrl(pending())).toBe('https://auth.openheaders.io/device?user_code=OHDC-1234');
  });

  it('names the missing required field', () => {
    expect(() => parseDeviceAuthorizationResponse({ ...RESPONSE, device_code: '' }, NOW)).toThrow(/device_code/);
    expect(() => parseDeviceAuthorizationResponse({ ...RESPONSE, user_code: undefined }, NOW)).toThrow(/user_code/);
    expect(() => parseDeviceAuthorizationResponse({ ...RESPONSE, verification_uri: 7 }, NOW)).toThrow(
      /verification_uri/,
    );
    expect(() => parseDeviceAuthorizationResponse({ ...RESPONSE, expires_in: 'soon' }, NOW)).toThrow(/expires_in/);
  });

  it('approvalOf strips the device code and nothing else', () => {
    const approval = approvalOf(pending());
    expect('deviceCode' in approval).toBe(false);
    expect(approval.userCode).toBe('OHDC-1234');
    expect(approval.expiresAt).toBe(NOW + 600_000);
  });
});

describe('stepDevicePoll', () => {
  it('a 2xx token response is the grant', () => {
    const step = stepDevicePoll(
      pending(),
      { status: 200, json: { access_token: 'at', token_type: 'Bearer', expires_in: 3600, refresh_token: 'rt' } },
      NOW,
    );
    expect(step.kind).toBe('granted');
    if (step.kind !== 'granted') return;
    expect(step.bundle.accessToken).toBe('at');
    expect(step.bundle.refreshToken).toBe('rt');
    expect(step.bundle.issuedAt).toBe(NOW);
    expect(step.bundle.expiresAt).toBe(NOW + 3_600_000);
  });

  it('a 2xx without a token fails the flow by name', () => {
    expect(stepDevicePoll(pending(), { status: 200, json: null }, NOW)).toEqual({
      kind: 'failed',
      message: 'Token endpoint returned non-JSON body',
    });
    expect(stepDevicePoll(pending(), { status: 200, json: { token_type: 'Bearer' } }, NOW)).toMatchObject({
      kind: 'failed',
      message: expect.stringContaining('access_token'),
    });
  });

  it('authorization_pending waits one interval', () => {
    expect(stepDevicePoll(pending(), { status: 400, json: { error: 'authorization_pending' } }, NOW)).toEqual({
      kind: 'wait',
      delayMs: 5000,
      intervalSeconds: 5,
    });
  });

  it('slow_down grows the interval by five seconds and waits the grown interval', () => {
    const step = stepDevicePoll(pending(), { status: 400, json: { error: 'slow_down' } }, NOW);
    expect(step).toEqual({ kind: 'wait', delayMs: 10_000, intervalSeconds: 10 });
    // The host carries the grown interval forward; the next pending
    // answer waits ten seconds, not five.
    const next = stepDevicePoll(
      pending({ intervalSeconds: 10 }),
      { status: 400, json: { error: 'authorization_pending' } },
      NOW,
    );
    expect(next).toEqual({ kind: 'wait', delayMs: 10_000, intervalSeconds: 10 });
  });

  it('a wait that would outlive the device code expires the flow', () => {
    const lastMoment = pending({ expiresAt: NOW + 4000 });
    expect(stepDevicePoll(lastMoment, { status: 400, json: { error: 'authorization_pending' } }, NOW)).toMatchObject({
      kind: 'expired',
    });
    expect(stepDevicePoll(lastMoment, { status: 400, json: { error: 'slow_down' } }, NOW)).toMatchObject({
      kind: 'expired',
    });
  });

  it('access_denied is the refusal, expired_token the expiry, with the provider wording', () => {
    expect(
      stepDevicePoll(
        pending(),
        { status: 400, json: { error: 'access_denied', error_description: 'The user declined' } },
        NOW,
      ),
    ).toEqual({ kind: 'denied', message: 'access_denied: The user declined' });
    expect(stepDevicePoll(pending(), { status: 400, json: { error: 'expired_token' } }, NOW)).toEqual({
      kind: 'expired',
      message: 'expired_token',
    });
  });

  it('any other refusal fails with the status and the provider words', () => {
    expect(
      stepDevicePoll(pending(), { status: 401, json: { error: 'invalid_client', error_description: 'nope' } }, NOW),
    ).toEqual({ kind: 'failed', message: 'Token endpoint returned 401: invalid_client: nope' });
    expect(stepDevicePoll(pending(), { status: 502, json: null }, NOW)).toEqual({
      kind: 'failed',
      message: 'Token endpoint returned 502: HTTP 502',
    });
  });

  it('the grant type constant is the RFC 8628 URN', () => {
    expect(DEVICE_CODE_GRANT_TYPE).toBe('urn:ietf:params:oauth:grant-type:device_code');
  });
});
