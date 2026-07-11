/**
 * Two-step destructive icon button for the Storage tool window's
 * destructive gestures (store clear, database/cache delete, cache-entry
 * delete) — the first click arms, swapping the icon for an explicit red
 * confirm label (the ClearAllButton idiom); the second commits, blur
 * disarms.
 */

import { useState } from 'react';

export function ArmedIconButton({
  icon,
  title,
  confirmTitle,
  confirmLabel = 'Confirm delete?',
  ariaLabel,
  onConfirm,
}: {
  icon: React.ReactNode;
  title: string;
  confirmTitle: string;
  /** Armed-state text shown in place of the icon. */
  confirmLabel?: string;
  ariaLabel: string;
  onConfirm: () => void;
}) {
  const [armed, setArmed] = useState(false);
  return (
    <button
      type="button"
      className={`dt-storage-action${armed ? ' dt-storage-action--armed' : ''}`}
      title={armed ? confirmTitle : title}
      aria-label={armed ? `${ariaLabel} — click again to confirm` : ariaLabel}
      onClick={() => {
        if (!armed) {
          setArmed(true);
          return;
        }
        setArmed(false);
        onConfirm();
      }}
      onBlur={() => setArmed(false)}
    >
      {armed ? confirmLabel : icon}
    </button>
  );
}
