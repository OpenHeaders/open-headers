/**
 * Two-step destructive icon button for the Storage tool window's bulk
 * gestures (store clear, database/cache delete) — first click arms
 * (red), second commits, blur disarms. Per-record deletes stay
 * single-click; only bulk destruction earns the extra step.
 */

import { useState } from 'react';

export function ArmedIconButton({
  icon,
  title,
  confirmTitle,
  ariaLabel,
  onConfirm,
}: {
  icon: React.ReactNode;
  title: string;
  confirmTitle: string;
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
      {icon}
    </button>
  );
}
