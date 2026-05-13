/**
 * Desktop renderer — rewrite in progress.
 *
 * Placeholder mount so electron-vite produces a valid renderer bundle
 * and `pnpm turbo typecheck` succeeds against `src/renderer/tsconfig.json`.
 * The rewrite will replace this with the shared UI shell.
 */

import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

const root = document.getElementById('root');
if (root) {
  createRoot(root).render(
    <StrictMode>
      <main style={{ fontFamily: 'system-ui, sans-serif', padding: '2rem' }}>
        <h1>Open Headers</h1>
        <p>Desktop app rewrite in progress.</p>
      </main>
    </StrictMode>,
  );
}
