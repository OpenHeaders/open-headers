import { describe, expect, it } from 'vitest';
import {
  deleteOAuthToken,
  type MutatorContext,
  OAUTH_BUNDLE_ENTITY_TYPE,
  OAUTH_BUNDLE_ID,
  OAUTH_BUNDLE_MUTATOR_VERSION,
  OAUTH_CONFIGS_PATH,
  OAUTH_REFRESH_ERRORS_PATH,
  OAUTH_TOKENS_PATH,
  recordOAuthRefreshError,
  setOAuthToken,
} from '../../../../src/sync';

const ctx = (overrides: Partial<MutatorContext> = {}): MutatorContext => ({
  workspaceId: 'ws-1',
  hlc: { physicalMs: 1_000, logical: 0, nodeId: 'node-x' },
  surfaceId: 'workbench',
  deviceId: 'device-a',
  ...overrides,
});

const bundle = (over: Record<string, unknown> = {}) => ({
  accessToken: 'at',
  refreshToken: 'rt',
  expiresAt: 9_999_999,
  ...over,
});

const config = (over: Record<string, unknown> = {}) => ({
  type: 'oauth2',
  credentialRef: 'cred-1',
  tokenEndpoint: 'https://oauth.openheaders.io/token',
  clientId: 'client',
  clientSecret: 'secret',
  scopes: ['read'],
  ...over,
});

describe('setOAuthToken', () => {
  it('emits addToSet(tokens) + removeFromSet(refreshErrors) under one batchId when no config supplied', () => {
    const intent = setOAuthToken(ctx(), { credentialRef: 'cred-1', bundle: bundle() });
    expect(intent.batch.mutations).toHaveLength(2);
    expect(intent.batch.mutations[0].mutatorVersion).toBe(OAUTH_BUNDLE_MUTATOR_VERSION);
    expect(intent.batch.mutations[0].body).toMatchObject({
      kind: 'addToSet',
      type: OAUTH_BUNDLE_ENTITY_TYPE,
      id: OAUTH_BUNDLE_ID,
      path: OAUTH_TOKENS_PATH,
      itemId: 'cred-1',
      item: { accessToken: 'at', refreshToken: 'rt' },
    });
    expect(intent.batch.mutations[1].body).toMatchObject({
      kind: 'removeFromSet',
      path: OAUTH_REFRESH_ERRORS_PATH,
      itemId: 'cred-1',
    });
    expect(intent.sideEffects).toEqual([]);
  });

  it('appends an addToSet(configs) when a config sidecar is supplied', () => {
    const intent = setOAuthToken(ctx(), {
      credentialRef: 'cred-1',
      bundle: bundle(),
      config: config(),
    });
    expect(intent.batch.mutations).toHaveLength(3);
    expect(intent.batch.mutations[2].body).toMatchObject({
      kind: 'addToSet',
      path: OAUTH_CONFIGS_PATH,
      itemId: 'cred-1',
      item: { credentialRef: 'cred-1', tokenEndpoint: 'https://oauth.openheaders.io/token' },
    });
  });

  it('shares a batchId across mutations when ctx.batchId is set', () => {
    const c = ctx({ batchId: 'batch-shared' });
    const intent = setOAuthToken(c, { credentialRef: 'cred-1', bundle: bundle(), config: config() });
    expect(intent.batch.batchId).toBe('batch-shared');
  });
});

describe('deleteOAuthToken', () => {
  it('emits three removeFromSet entries (tokens + configs + refreshErrors) atomically', () => {
    const intent = deleteOAuthToken(ctx(), { credentialRef: 'cred-1' });
    expect(intent.batch.mutations).toHaveLength(3);
    const paths = intent.batch.mutations.map((m) => (m.body as { path: string }).path);
    expect(paths).toEqual([OAUTH_TOKENS_PATH, OAUTH_CONFIGS_PATH, OAUTH_REFRESH_ERRORS_PATH]);
    for (const m of intent.batch.mutations) {
      expect(m.body).toMatchObject({
        kind: 'removeFromSet',
        type: OAUTH_BUNDLE_ENTITY_TYPE,
        id: OAUTH_BUNDLE_ID,
        itemId: 'cred-1',
      });
    }
    expect(intent.sideEffects).toEqual([]);
  });
});

describe('recordOAuthRefreshError', () => {
  it('emits addToSet(refreshErrors) only — leaves tokens + configs intact', () => {
    const intent = recordOAuthRefreshError(ctx(), {
      credentialRef: 'cred-1',
      errorState: { consecutiveFailures: 2, lastErrorAt: 100, lastErrorMessage: 'boom' },
    });
    expect(intent.batch.mutations).toHaveLength(1);
    expect(intent.batch.mutations[0].body).toMatchObject({
      kind: 'addToSet',
      type: OAUTH_BUNDLE_ENTITY_TYPE,
      path: OAUTH_REFRESH_ERRORS_PATH,
      itemId: 'cred-1',
      item: { consecutiveFailures: 2 },
    });
    expect(intent.sideEffects).toEqual([]);
  });
});
