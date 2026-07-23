/**
 * Minimal ambient surface for `bun:ffi` — the compiled binary always
 * runs under Bun, but the package typechecks against @types/node, which
 * knows nothing of Bun's builtin modules. Only the members
 * `win32-image-name.ts` touches are declared.
 */
declare module 'bun:ffi' {
  export type Pointer = number | bigint;
  export function ptr(view: ArrayBufferView): Pointer;
  export function dlopen(
    name: string,
    symbols: Record<string, { readonly args: readonly string[]; readonly returns: string }>,
  ): {
    readonly symbols: Record<string, (...args: ReadonlyArray<number | bigint | Pointer>) => number | bigint>;
    close(): void;
  };
}
