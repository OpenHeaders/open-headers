/**
 * Renders a string with all case-insensitive substring occurrences of
 * `query` wrapped in `<mark class="dt-search-highlight">`. Used in
 * detail-view panes (Payload, headers) to mirror what the search
 * engine matched on.
 *
 * Plain substring only — regex mode is intentionally not supported
 * here because these views don't have access to the full FilterConfig
 * and keeping them in step with the engine's regex semantics would
 * require threading config down everywhere. Chrome's own panels do
 * the same simplification.
 */

interface HighlightedTextProps {
  text: string;
  query?: string;
}

export function HighlightedText({ text, query }: HighlightedTextProps) {
  if (!query) return <>{text}</>;
  const lower = text.toLowerCase();
  const needle = query.toLowerCase();
  if (needle.length === 0) return <>{text}</>;

  const parts: Array<{ text: string; hl: boolean }> = [];
  let pos = 0;
  while (pos < text.length) {
    const idx = lower.indexOf(needle, pos);
    if (idx === -1) {
      parts.push({ text: text.slice(pos), hl: false });
      break;
    }
    if (idx > pos) parts.push({ text: text.slice(pos, idx), hl: false });
    parts.push({ text: text.slice(idx, idx + needle.length), hl: true });
    pos = idx + needle.length;
  }
  if (parts.length === 0) return <>{text}</>;

  return (
    <>
      {parts.map((p, i) =>
        p.hl ? (
          <mark key={i} className="dt-search-highlight">
            {p.text}
          </mark>
        ) : (
          <span key={i}>{p.text}</span>
        ),
      )}
    </>
  );
}
