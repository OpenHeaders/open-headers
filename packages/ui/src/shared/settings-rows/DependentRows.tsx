/**
 * Indented block of rows that only apply while a parent knob is on —
 * the IDE settings idiom where a toggle's sub-settings sit one level
 * in beneath it, so the dependency reads from the geometry alone. The
 * rows keep the family's `label · (i) · control` anatomy and the
 * control column's right edge; only the label column moves in.
 */

import type React from 'react';
import { DEPENDENT_ROWS_INDENT } from './constants';

const DependentRows: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div style={{ display: 'flex', flexDirection: 'column', gap: 4, paddingLeft: DEPENDENT_ROWS_INDENT }}>{children}</div>
);

export default DependentRows;
