/**
 * Table-cell adapter that drops the shared {@link ValueExpander} readout
 * into a second `<tr>` spanning all columns when a cookie row is
 * expanded. The decode / Decoded-Raw-toggle logic lives in the shared
 * component; this only supplies the cookies-table wrapper.
 */

import type { ValueIntrospection } from '../../../data/value-introspect';
import { ValueExpander } from '../ValueExpander';

export function CookieValueExpander({
  introspection,
  columnSpan,
}: {
  introspection: ValueIntrospection;
  columnSpan: number;
}) {
  return (
    <tr className="dt-cookie-expand-row">
      <td colSpan={columnSpan} className="dt-cookie-expand-cell">
        <ValueExpander introspection={introspection} />
      </td>
    </tr>
  );
}
