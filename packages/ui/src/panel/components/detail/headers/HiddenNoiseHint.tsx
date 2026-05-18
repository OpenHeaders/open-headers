import { Popover } from 'antd';
import type { AnnotatedHeader } from '../../../data/header-attribution';
import type { HeaderRowMeta } from '../../../data/header-filter';

export type RowItem = { row: AnnotatedHeader; meta: HeaderRowMeta; originalIndex: number };

/** Hint below a header section showing how many noise rows the
 *  `Hide noise` toggle is currently hiding. Hover opens a popover
 *  listing the actual names so the user never has to guess. */
export function HiddenNoiseHint({ items }: { items: readonly RowItem[] }) {
  return (
    <Popover
      trigger="hover"
      mouseEnterDelay={0.05}
      content={
        <div className="dt-header-noise-list">
          {items.map(({ row }) => (
            <code key={row.name} className="dt-header-noise-name">
              {row.name}
            </code>
          ))}
        </div>
      }
    >
      <div className="dt-header-noise-hint dt-col-muted">
        {items.length} noise header{items.length === 1 ? '' : 's'} hidden — hover for names
      </div>
    </Popover>
  );
}
