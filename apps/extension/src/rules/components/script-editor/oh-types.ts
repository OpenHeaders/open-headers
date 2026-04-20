/**
 * Ambient type declarations for the script sandbox's `oh.*` API,
 * fed to Monaco's TypeScript language service via
 * `monaco.languages.typescript.javascriptDefaults.addExtraLib(...)`.
 *
 * The runtime surface is defined by `apps/extension/src/offscreen/sandbox.ts`
 * — this file MUST stay in sync with it. No implementation here, only
 * types, because Monaco just needs shape information for completions,
 * hovers, and error squigglies.
 */

export const OH_AMBIENT_DTS = `
declare const oh: {
  /**
   * The outgoing request. Mutable in pre-request scripts (use
   * \`oh.setUrl\` / \`oh.setHeader\` / \`oh.setMethod\` / \`oh.setBody\`
   * to edit); read-only in post-response scripts.
   */
  readonly request: {
    readonly method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE' | 'HEAD' | 'OPTIONS';
    readonly url: string;
    readonly headers: ReadonlyArray<{ key: string; value: string }>;
    readonly params: ReadonlyArray<{ key: string; value: string }>;
    readonly body: {
      readonly type: 'none' | 'json' | 'xml' | 'graphql' | 'form' | 'multipart' | 'text';
      readonly content?: string;
      readonly multipartParts?: ReadonlyArray<unknown>;
    };
  };

  /**
   * The incoming response. Only populated in post-response scripts;
   * \`undefined\` during pre-request runs.
   */
  readonly response?: {
    readonly status: number;
    readonly statusText: string;
    readonly url: string;
    readonly headers: ReadonlyArray<{ key: string; value: string }>;
    readonly body: string;
    readonly durationMs: number;
  };

  /**
   * Read / write to the workspace variable scope. \`get\` walks the
   * full 4-scope chain (vault > env > collection > workspace) and
   * returns the resolved value; \`set\` writes to the workspace scope.
   */
  readonly variables: {
    get(name: string): Promise<string | null>;
    set(name: string, value: string): Promise<void>;
  };

  /**
   * Read-only access to vault secrets. Works for both named vault
   * keys and OAuth credential references — the latter returns the
   * current access token (refreshed if expired).
   */
  readonly vault: {
    get(ref: string): Promise<string | null>;
  };

  /**
   * Fire an ad-hoc HTTP request through the executor. Respects the
   * workspace's host-access, cookie-jar, and proxy settings.
   */
  sendRequest(request: {
    method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE' | 'HEAD' | 'OPTIONS';
    url: string;
    headers?: Array<{ key: string; value: string }>;
    params?: Array<{ key: string; value: string }>;
    body?: {
      type: 'none' | 'json' | 'xml' | 'graphql' | 'form' | 'multipart' | 'text';
      content?: string;
    };
  }): Promise<{
    status: number;
    statusText: string;
    url: string;
    headers: Array<{ key: string; value: string }>;
    body: string;
    durationMs: number;
  }>;

  /**
   * Register an assertion. The callback runs synchronously — throw
   * (or call \`oh.expect(...).toBe(...)\`) to fail. Both pass and
   * fail outcomes surface in the response panel's "Assertions" tab.
   */
  test(name: string, fn: () => void | Promise<void>): Promise<void>;

  /**
   * Chai-ish assertion builder. Each matcher throws a descriptive
   * Error on mismatch — the enclosing \`oh.test\` catches it and
   * records the failure.
   */
  expect(actual: unknown): {
    /** Strict equality (\`===\`). */
    toBe(expected: unknown): void;
    /** Recursive structural equality for plain objects + arrays. */
    toEqual(expected: unknown): void;
    /** Truthy check. */
    toBeTruthy(): void;
    /** Falsy check. */
    toBeFalsy(): void;
    /** Substring match (requires a string receiver). */
    toContain(expected: string): void;
    /** Asserts \`response.status === expected\`. */
    toHaveStatus(expected: number): void;
  };

  // ── Pre-request mutators (no-op in post-response scripts) ───────
  setUrl(url: string): void;
  setMethod(method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE' | 'HEAD' | 'OPTIONS'): void;
  setHeader(key: string, value: string): void;
  removeHeader(key: string): void;
  setBody(body: {
    type: 'none' | 'json' | 'xml' | 'graphql' | 'form' | 'multipart' | 'text';
    content?: string;
  }): void;
};
`;
