/**
 * The globals a script can reach in every runtime — declared for
 * Monaco's TypeScript service beside the `oh.*` ambient, with the
 * ECMAScript lib alone underneath (no browser lib: the Scripts tab
 * would otherwise offer `window`'s hundreds of handlers that no
 * runtime of ours provides, and a `console.table` the capturing
 * console does not have).
 *
 * The surface is the intersection of the five runtimes (the desktop's
 * sandboxed page and Developer worker, the daemon's permission fork,
 * the extension's and the served tab's sandbox iframes): the script
 * console the runner injects, the timers, the base64 pair, the text
 * codecs, the URL pair, Web Crypto, `structuredClone`,
 * `queueMicrotask` and `performance.now`. Nothing a single host adds
 * (`fetch`, `Buffer`, `process`, `require`) — `oh.sendRequest` is the
 * sanctioned egress. The catalog test typechecks every shipped
 * snippet against this file, so the promise and the snippets never
 * drift.
 */

export const SANDBOX_GLOBALS_DTS = `
/** The console a script writes to — captured into the run's log,
 *  one entry per call, shown in the Console view. */
interface OhConsole {
  log(...args: unknown[]): void;
  info(...args: unknown[]): void;
  warn(...args: unknown[]): void;
  error(...args: unknown[]): void;
  debug(...args: unknown[]): void;
}
declare const console: OhConsole;

declare function setTimeout(handler: () => void, timeout?: number): number;
declare function clearTimeout(id: number | undefined): void;
declare function setInterval(handler: () => void, timeout?: number): number;
declare function clearInterval(id: number | undefined): void;
declare function queueMicrotask(callback: () => void): void;
declare function structuredClone<T>(value: T): T;

/** Base64 text → the bytes as a binary string. */
declare function atob(data: string): string;
/** A binary string → base64 text. */
declare function btoa(data: string): string;

type BufferSource = ArrayBufferView | ArrayBuffer;

declare class TextEncoder {
  readonly encoding: 'utf-8';
  encode(input?: string): Uint8Array;
}

declare class TextDecoder {
  constructor(label?: string, options?: { fatal?: boolean; ignoreBOM?: boolean });
  readonly encoding: string;
  decode(input?: BufferSource): string;
}

declare class URLSearchParams {
  constructor(init?: string | Record<string, string> | Array<[string, string]> | URLSearchParams);
  readonly size: number;
  append(name: string, value: string): void;
  delete(name: string, value?: string): void;
  get(name: string): string | null;
  getAll(name: string): string[];
  has(name: string, value?: string): boolean;
  set(name: string, value: string): void;
  sort(): void;
  forEach(callback: (value: string, key: string, parent: URLSearchParams) => void): void;
  keys(): IterableIterator<string>;
  values(): IterableIterator<string>;
  entries(): IterableIterator<[string, string]>;
  toString(): string;
  [Symbol.iterator](): IterableIterator<[string, string]>;
}

declare class URL {
  constructor(url: string, base?: string | URL);
  static canParse(url: string, base?: string | URL): boolean;
  static parse(url: string, base?: string | URL): URL | null;
  hash: string;
  host: string;
  hostname: string;
  href: string;
  readonly origin: string;
  password: string;
  pathname: string;
  port: string;
  protocol: string;
  search: string;
  readonly searchParams: URLSearchParams;
  username: string;
  toString(): string;
  toJSON(): string;
}

type OhCryptoAlgorithm = string | { name: string; [parameter: string]: unknown };

interface CryptoKey {
  readonly algorithm: { name: string };
  readonly extractable: boolean;
  readonly type: 'public' | 'private' | 'secret';
  readonly usages: string[];
}

interface CryptoKeyPair {
  publicKey: CryptoKey;
  privateKey: CryptoKey;
}

/** Web Crypto — the same API in every runtime. */
interface SubtleCrypto {
  digest(algorithm: OhCryptoAlgorithm, data: BufferSource): Promise<ArrayBuffer>;
  encrypt(algorithm: OhCryptoAlgorithm, key: CryptoKey, data: BufferSource): Promise<ArrayBuffer>;
  decrypt(algorithm: OhCryptoAlgorithm, key: CryptoKey, data: BufferSource): Promise<ArrayBuffer>;
  sign(algorithm: OhCryptoAlgorithm, key: CryptoKey, data: BufferSource): Promise<ArrayBuffer>;
  verify(algorithm: OhCryptoAlgorithm, key: CryptoKey, signature: BufferSource, data: BufferSource): Promise<boolean>;
  generateKey(algorithm: OhCryptoAlgorithm, extractable: boolean, keyUsages: string[]): Promise<CryptoKey | CryptoKeyPair>;
  importKey(
    format: 'raw' | 'pkcs8' | 'spki' | 'jwk',
    keyData: BufferSource | Record<string, unknown>,
    algorithm: OhCryptoAlgorithm,
    extractable: boolean,
    keyUsages: string[],
  ): Promise<CryptoKey>;
  exportKey(format: 'raw' | 'pkcs8' | 'spki' | 'jwk', key: CryptoKey): Promise<ArrayBuffer | Record<string, unknown>>;
  deriveBits(algorithm: OhCryptoAlgorithm, baseKey: CryptoKey, length: number): Promise<ArrayBuffer>;
  deriveKey(
    algorithm: OhCryptoAlgorithm,
    baseKey: CryptoKey,
    derivedKeyType: OhCryptoAlgorithm,
    extractable: boolean,
    keyUsages: string[],
  ): Promise<CryptoKey>;
}

interface Crypto {
  readonly subtle: SubtleCrypto;
  getRandomValues<T extends ArrayBufferView>(array: T): T;
  randomUUID(): string;
}
declare const crypto: Crypto;

declare const performance: {
  /** Milliseconds since the runtime started, sub-millisecond precision. */
  now(): number;
  readonly timeOrigin: number;
};
`;
