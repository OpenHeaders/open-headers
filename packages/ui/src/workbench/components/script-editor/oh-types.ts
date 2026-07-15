/**
 * Ambient type declarations for the script sandbox's `oh.*` API,
 * fed to Monaco's TypeScript language service via
 * `monaco.languages.typescript.javascriptDefaults.addExtraLib(...)`.
 *
 * The runtime surface is defined by `apps/extension/src/offscreen/sandbox.ts`
 * — this file MUST stay in sync with it. No implementation here, only
 * types, because Monaco just needs shape information for completions,
 * hovers, and error squigglies.
 *
 * The surface is split into NAMED interfaces (`OpenHeaders`,
 * `OhRequest`, `OhResponse`, …) rather than an inline anonymous type
 * so the completion popup renders `const oh: OpenHeaders` instead of
 * unfurling the full object literal.
 */

export const OH_AMBIENT_DTS = `
type OhHttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE' | 'HEAD' | 'OPTIONS';

interface OhHeader { key: string; value: string; }
interface OhParam { key: string; value: string; }

interface OhFormField {
  readonly key: string;
  readonly value: string;
  readonly description?: string;
  readonly enabled?: boolean;
}

interface OhMultipartTextPart {
  readonly kind: 'text';
  readonly name: string;
  readonly value: string;
  readonly description?: string;
  readonly enabled?: boolean;
}

interface OhMultipartFilePart {
  readonly kind: 'file';
  readonly name: string;
  readonly fileRefs: ReadonlyArray<unknown>;
  readonly description?: string;
  readonly enabled?: boolean;
}

type OhMultipartPart = OhMultipartTextPart | OhMultipartFilePart;

type OhRequestBody =
  | { readonly type: 'none' }
  | { readonly type: 'json'; readonly content: string }
  | { readonly type: 'xml'; readonly content: string }
  | { readonly type: 'text'; readonly content: string; readonly rawFormat?: 'text' | 'javascript' | 'html' }
  | { readonly type: 'form'; readonly formParts: ReadonlyArray<OhFormField> }
  | { readonly type: 'multipart'; readonly multipartParts: ReadonlyArray<OhMultipartPart> }
  | { readonly type: 'graphql'; readonly content: string; readonly graphqlVariables?: string };

/** The outgoing request. Mutable in pre-request scripts via
 *  \`oh.setUrl\` / \`oh.setHeader\` / \`oh.setMethod\` / \`oh.setBody\`;
 *  read-only in post-response scripts. */
interface OhRequest {
  readonly method: OhHttpMethod;
  readonly url: string;
  readonly headers: ReadonlyArray<OhHeader>;
  readonly params: ReadonlyArray<OhParam>;
  readonly body: OhRequestBody;
}

/** The incoming response. Populated only in post-response scripts;
 *  \`undefined\` during pre-request runs. */
interface OhResponse {
  readonly status: number;
  readonly statusText: string;
  readonly url: string;
  readonly headers: ReadonlyArray<OhHeader>;
  /** Response body. UTF-8 text verbatim; a binary payload arrives
   *  base64-encoded with \`bodyEncoding\` set — lossless either way. */
  readonly body: string;
  /** \`'base64'\` when \`body\` carries base64-encoded bytes (the payload
   *  is not UTF-8 text). Absent = text. Check before \`JSON.parse\`;
   *  decode with \`atob(oh.response.body)\` when you want the bytes. */
  readonly bodyEncoding?: 'base64';
  readonly durationMs: number;
}

/** Read / write to the workspace variable scope. \`get\` walks the full
 *  4-scope chain (vault > env > collection > workspace) and returns the
 *  resolved value; \`set\` writes to the workspace scope. */
interface OhVariables {
  get(name: string): Promise<string | null>;
  set(name: string, value: string): Promise<void>;
}

/** Read-only access to vault secrets. Works for both named vault keys
 *  and OAuth credential references — the latter returns the current
 *  access token (refreshed if expired). */
interface OhVault {
  get(ref: string): Promise<string | null>;
}

/** Chai-ish assertion builder. Each matcher throws a descriptive
 *  Error on mismatch — the enclosing \`oh.test\` catches it and records
 *  the failure. */
interface OhExpectation {
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
}

type OhAdHocRequestBody =
  | { type: 'none' }
  | { type: 'json'; content: string }
  | { type: 'xml'; content: string }
  | { type: 'text'; content: string; rawFormat?: 'text' | 'javascript' | 'html' }
  | { type: 'form'; formParts: Array<OhFormField> }
  | { type: 'multipart'; multipartParts: Array<OhMultipartPart> }
  | { type: 'graphql'; content: string; graphqlVariables?: string };

interface OhAdHocRequest {
  method: OhHttpMethod;
  url: string;
  headers?: Array<OhHeader>;
  params?: Array<OhParam>;
  body?: OhAdHocRequestBody;
}

interface OhAdHocResponse {
  status: number;
  statusText: string;
  url: string;
  headers: Array<OhHeader>;
  /** UTF-8 text verbatim, or base64 when \`bodyEncoding\` is set. */
  body: string;
  /** \`'base64'\` when \`body\` carries base64-encoded bytes (the payload
   *  is not UTF-8 text). Absent = text. */
  bodyEncoding?: 'base64';
  durationMs: number;
}

type OhBodyInit = OhAdHocRequestBody;

/**
 * The \`oh\` global exposed inside pre-request + post-response scripts.
 * Same name in both.
 */
interface OpenHeaders {
  readonly request: OhRequest;
  readonly response?: OhResponse;
  readonly variables: OhVariables;
  readonly vault: OhVault;

  /** Load a workspace script package by name (synchronous). Returns the
   *  package's \`module.exports\`. Packages come from the Package
   *  Library and cannot require other packages. */
  require(name: string): any;

  /** Fire an ad-hoc HTTP request through the executor. Respects the
   *  workspace's host-access, cookie-jar, and proxy settings. */
  sendRequest(request: OhAdHocRequest): Promise<OhAdHocResponse>;

  /** Register an assertion. The callback runs synchronously — throw
   *  (or call \`oh.expect(...).toBe(...)\`) to fail. Both pass and fail
   *  outcomes surface in the response panel's "Assertions" tab. */
  test(name: string, fn: () => void | Promise<void>): Promise<void>;

  expect(actual: unknown): OhExpectation;

  // ── Pre-request mutators (no-op in post-response scripts) ───────
  setUrl(url: string): void;
  setMethod(method: OhHttpMethod): void;
  setHeader(key: string, value: string): void;
  removeHeader(key: string): void;
  /** Query-param keys are case-sensitive (unlike header names) —
   *  replaces the first row with that exact key, else appends. */
  setQueryParam(key: string, value: string): void;
  removeQueryParam(key: string): void;
  setBody(body: OhBodyInit): void;
}

declare const oh: OpenHeaders;
`;
