/**
 * HAR export handlers for the panel — download-to-file and
 * copy-to-clipboard, each in all-rows and single-row form. Serialization
 * itself lives in `har-export.ts`; this hook binds it to the rendered
 * row set and wires the browser download / clipboard plumbing.
 */

import { hostNavigation } from '@openheaders/core/navigation';
import type { Page } from '@openheaders/core/page-stream';
import { useCallback } from 'react';
import type { InspectorRowWithFires } from '../inspector-row-projection';
import { serializeHar, suggestHarFilename } from './har-export';

export interface UseHarExportOptions {
  rows: readonly InspectorRowWithFires[];
  pages: readonly Page[];
}

export interface HarExportApi {
  handleSaveAllAsHar: (sanitize?: boolean) => void;
  handleSaveAsHar: (row: InspectorRowWithFires, sanitize?: boolean) => void;
  handleCopyAllAsHar: (sanitize?: boolean) => Promise<void>;
  handleCopyAsHar: (row: InspectorRowWithFires, sanitize?: boolean) => Promise<void>;
}

export function useHarExport({ rows, pages }: UseHarExportOptions): HarExportApi {
  const downloadHar = useCallback(
    async (subset: readonly InspectorRowWithFires[], filename: string, sanitize: boolean) => {
      // CDP mode: the host's own devtools.network HAR is byte-identical to its
      // export, so prefer it per-entry and for the page block over our CDP
      // synthesis (null in heuristic mode / non-DevTools hosts — export stays
      // as-is).
      const hostHar = (await hostNavigation.getInspectedHar()) ?? undefined;
      // Resolve page anchors from the full row set, not just the exported
      // subset — a single non-document export still needs its page's document.
      const json = serializeHar(
        subset,
        pages,
        sanitize,
        rows.map((r) => r.lifecycle),
        hostHar,
      );
      const blob = new Blob([json], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 0);
    },
    [pages, rows],
  );

  const handleSaveAllAsHar = useCallback(
    (sanitize = false) => {
      void downloadHar(rows, suggestHarFilename(rows), sanitize);
    },
    [rows, downloadHar],
  );

  const handleSaveAsHar = useCallback(
    (row: InspectorRowWithFires, sanitize = false) => {
      const single: readonly InspectorRowWithFires[] = [row];
      void downloadHar(single, suggestHarFilename(single), sanitize);
    },
    [downloadHar],
  );

  const copyHar = useCallback(
    async (subset: readonly InspectorRowWithFires[], sanitize: boolean) => {
      const hostHar = (await hostNavigation.getInspectedHar()) ?? undefined;
      const json = serializeHar(
        subset,
        pages,
        sanitize,
        rows.map((r) => r.lifecycle),
        hostHar,
      );
      try {
        await navigator.clipboard.writeText(json);
      } catch {
        // Best-effort — clipboard may be gated in some DevTools contexts.
      }
    },
    [pages, rows],
  );

  const handleCopyAllAsHar = useCallback((sanitize = false) => copyHar(rows, sanitize), [rows, copyHar]);

  const handleCopyAsHar = useCallback(
    (row: InspectorRowWithFires, sanitize = false) => copyHar([row], sanitize),
    [copyHar],
  );

  return { handleSaveAllAsHar, handleSaveAsHar, handleCopyAllAsHar, handleCopyAsHar };
}
