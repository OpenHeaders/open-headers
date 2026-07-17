/**
 * The `react/jsx-runtime-actual` specifier is a build-time alias to
 * React's real jsx-runtime module (see `vite.config.ts`) — the
 * strip-testid shim imports through it to avoid resolving itself.
 */
declare module 'react/jsx-runtime-actual' {
  export * from 'react/jsx-runtime';
}
