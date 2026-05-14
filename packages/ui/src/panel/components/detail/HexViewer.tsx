import { useCallback, useLayoutEffect, useMemo, useRef, useState } from 'react';

interface HexViewerProps {
  data: Uint8Array;
}

const BYTES_PER_ROW = 16;
const ROW_HEIGHT = 20;
const OVERSCAN = 10;

function toHex(byte: number): string {
  return byte.toString(16).padStart(2, '0').toUpperCase();
}

function toAscii(byte: number): string {
  return byte >= 0x20 && byte <= 0x7e ? String.fromCharCode(byte) : '.';
}

function formatOffset(offset: number): string {
  return offset.toString(16).padStart(8, '0');
}

export default function HexViewer({ data }: HexViewerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [scrollTop, setScrollTop] = useState(0);
  const [viewHeight, setViewHeight] = useState(0);

  const totalRows = Math.ceil(data.length / BYTES_PER_ROW);
  const totalHeight = totalRows * ROW_HEIGHT;

  useLayoutEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      const h = entries[0]?.contentRect.height;
      if (h != null) setViewHeight(h);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const handleScroll = useCallback(() => {
    const el = containerRef.current;
    if (el) setScrollTop(el.scrollTop);
  }, []);

  const { startRow, endRow } = useMemo(() => {
    const start = Math.max(0, Math.floor(scrollTop / ROW_HEIGHT) - OVERSCAN);
    const visibleCount = Math.ceil(viewHeight / ROW_HEIGHT);
    const end = Math.min(totalRows, start + visibleCount + OVERSCAN * 2);
    return { startRow: start, endRow: end };
  }, [scrollTop, viewHeight, totalRows]);

  const rows = useMemo(() => {
    const result: Array<{ offset: number; hex: string; ascii: string }> = [];
    for (let row = startRow; row < endRow; row++) {
      const byteOffset = row * BYTES_PER_ROW;
      const slice = data.subarray(byteOffset, byteOffset + BYTES_PER_ROW);
      let hex = '';
      let ascii = '';
      for (let j = 0; j < BYTES_PER_ROW; j++) {
        if (j < slice.length) {
          hex += `${toHex(slice[j])} `;
          ascii += toAscii(slice[j]);
        } else {
          hex += '   ';
          ascii += ' ';
        }
      }
      result.push({ offset: byteOffset, hex, ascii });
    }
    return result;
  }, [data, startRow, endRow]);

  return (
    <div className="dt-hex-viewer" ref={containerRef} onScroll={handleScroll}>
      <div style={{ height: totalHeight, position: 'relative' }}>
        <div style={{ position: 'absolute', top: startRow * ROW_HEIGHT, left: 0, right: 0 }}>
          {rows.map((row) => (
            <div key={row.offset} className="dt-hex-row" style={{ height: ROW_HEIGHT }}>
              <span className="dt-hex-offset">{formatOffset(row.offset)}</span>
              <span className="dt-hex-bytes">{row.hex}</span>
              <span className="dt-hex-ascii">{row.ascii}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
