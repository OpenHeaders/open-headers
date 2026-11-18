/**
 * MenuCornerMark — the small triangle in the lower right corner of an
 * icon button that opens a menu of options (the reference's mark for
 * "more behind this"). The button is its positioning box and gives it
 * its colour.
 */

import type React from 'react';

const EXTENT = 4;

const MenuCornerMark: React.FC<{ testid: string }> = ({ testid }) => (
  <svg
    aria-hidden
    viewBox="0 0 4 4"
    width={EXTENT}
    height={EXTENT}
    style={{ position: 'absolute', right: 2, bottom: 2 }}
    data-testid={testid}
  >
    <path d="M4 0v4H0z" fill="currentColor" />
  </svg>
);

export default MenuCornerMark;
