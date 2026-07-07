/**
 * DismissLayer — outside-click + Esc dismissal wrapper for popovers
 * mounted directly (context-menu flows), where no hover-popover host
 * owns the lifecycle. Ant overlay layers (dropdown / tooltip / select /
 * message) portal outside the subtree, so clicks there count as inside.
 */

import type React from 'react';
import { useEffect, useRef } from 'react';

const DismissLayer: React.FC<{ onClose: () => void; children: React.ReactNode }> = ({ onClose, children }) => {
  const ref = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    const handleMouseDown = (e: MouseEvent) => {
      const target = e.target as Node;
      if (ref.current?.contains(target)) return;
      if (
        target instanceof Element &&
        target.closest('.ant-dropdown, .ant-tooltip, .ant-select-dropdown, .ant-message')
      ) {
        return;
      }
      onClose();
    };
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('mousedown', handleMouseDown, true);
    document.addEventListener('keydown', handleKey);
    return () => {
      document.removeEventListener('mousedown', handleMouseDown, true);
      document.removeEventListener('keydown', handleKey);
    };
  }, [onClose]);
  return <div ref={ref}>{children}</div>;
};

export default DismissLayer;
