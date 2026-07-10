/**
 * useJwtEditAction — per-field wiring for the JWT editor. Detects
 * whether the field's value holds a JWT (optionally `Bearer `-prefixed)
 * and, when it does, hands the caller the TemplateInput rail props plus
 * the mounted modal. TemplateInput itself stays presentation-only —
 * detection and modal state live here, at the caller.
 */

import type React from 'react';
import { lazy, Suspense, useCallback, useMemo, useState } from 'react';
import { detectValueType } from './detect';

// Lazy so the modal (Monaco via the shared CodeEditor) stays out of
// every TemplateInput caller's bundle; it loads on first edit-icon
// click — same treatment as the panel's Monaco-backed surfaces.
const JWTEditorModalLazy = lazy(() => import('./JWTEditorModal'));

export interface JwtEditActionResult {
  /** Spread onto the TemplateInput. Empty when the value is not a JWT,
   *  so the rail shows no edit icon. */
  jwtEditProps: { onValueEdit: () => void; editTooltip: string } | Record<string, never>;
  /** Render alongside the field (always safe — mounts nothing until
   *  the icon is clicked, and `null` when the value is not a JWT). */
  jwtModal: React.ReactNode;
}

export function useJwtEditAction(
  value: string | undefined,
  onChange: (next: string) => void,
): JwtEditActionResult {
  const [open, setOpen] = useState(false);
  const detected = useMemo(() => detectValueType(value), [value]);
  const jwt = detected?.type === 'jwt' ? detected : null;

  const openModal = useCallback(() => setOpen(true), []);
  const closeModal = useCallback(() => setOpen(false), []);
  const handleSave = useCallback(
    (nextToken: string) => {
      // Restore whatever preceded the token (e.g. `Bearer `).
      onChange(`${jwt?.prefix ?? ''}${nextToken}`);
      setOpen(false);
    },
    [onChange, jwt?.prefix],
  );

  return {
    jwtEditProps: jwt ? { onValueEdit: openModal, editTooltip: 'Edit as JWT' } : {},
    jwtModal:
      jwt && open ? (
        <Suspense fallback={null}>
          <JWTEditorModalLazy open={open} token={jwt.token} onSave={handleSave} onCancel={closeModal} />
        </Suspense>
      ) : null,
  };
}
