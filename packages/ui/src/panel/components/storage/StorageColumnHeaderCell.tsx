/**
 * One column-header cell for the Storage tool window's grids — the
 * network table's header vocabulary (`.dt-col-header-cell` divider +
 * `.dt-col-sort` label) applied to the storage grids so every table in
 * the panel reads the same. The storage grids don't sort, so the label
 * button renders disabled (the Messages frame grid's idiom for its
 * non-sortable columns); the hover-revealed `(i)` slot carries the
 * grid's per-column info popover.
 */

import type { ReactNode } from 'react';

interface StorageColumnHeaderCellProps {
  label: string;
  /** The column's `(i)` info trigger element. */
  info: ReactNode;
}

export function StorageColumnHeaderCell({ label, info }: StorageColumnHeaderCellProps) {
  return (
    <div className="dt-col-header-cell" role="columnheader">
      {info}
      <button type="button" className="dt-col-sort" disabled>
        {label}
      </button>
    </div>
  );
}
