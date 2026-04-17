/**
 * Unified text-body renderer. Used by both `ResponseBodyView` (for its
 * text branch) and `PayloadView` (for the request body). One owner
 * for the entire text-rendering pipeline:
 *
 *   - `useSniffedContent` tracks declared-vs-overridden mime
 *   - `detectLanguage` / `canPrettyPrint` drive CodeMirror + Prettier
 *   - Prettier runs asynchronously when pretty-print is on
 *   - CodeMirror handles syntax highlighting, theme, and search
 *   - `TextBodyToolbar` shows pretty-print + sniffer + cursor info
 *
 * Before this component existed the logic was duplicated across the
 * two callers — one using Prettier + CodeMirror, the other doing
 * `JSON.stringify` in-line. Now there's one path.
 */

import { lazy, Suspense, useCallback, useEffect, useState } from 'react';
import { canPrettyPrint, detectLanguage } from '../../data/mime';
import { useSniffedContent } from '../../data/use-sniffed-content';
import { prettyPrintCode } from './pretty-print';
import Skeleton from './Skeleton';
import TextBodyToolbar from './TextBodyToolbar';

const CodeMirrorViewer = lazy(() => import('./CodeMirrorViewer'));

interface TextBodyViewerProps {
  /** Raw body text as the server delivered it. */
  text: string;
  /** MIME the server declared. Used as the starting point for the
   *  sniffer; may be generic (text/plain, octet-stream, empty). */
  declaredMime: string;
  /** Active search query; passed through to CodeMirror for inline
   *  highlighting + scroll-to-Nth-match. */
  searchQuery?: string;
  /** 0-based index of the specific match the user clicked. */
  searchMatchIndex?: number;
}

export default function TextBodyViewer({ text, declaredMime, searchQuery, searchMatchIndex }: TextBodyViewerProps) {
  const sniffed = useSniffedContent(text, declaredMime);
  const lang = detectLanguage(sniffed.effectiveMime);
  const showPrettyPrint = canPrettyPrint(sniffed.effectiveMime);

  // Pretty-print defaults ON when we have a language to format, so
  // users don't have to hunt for the toggle for the common case.
  const [prettyPrint, setPrettyPrint] = useState(showPrettyPrint);
  const [formattedText, setFormattedText] = useState<string | null>(null);
  const [formatting, setFormatting] = useState(false);
  const [cursorInfo, setCursorInfo] = useState<string | null>(null);

  // When an override changes the effective mime (and hence language),
  // re-enable pretty-print so the newly-recognised content gets
  // formatted. Turning it OFF on "revert" is handled by the same
  // effect: `showPrettyPrint` flips to false if we drop to a plain
  // mime, which deactivates the toggle in the toolbar.
  useEffect(() => {
    if (showPrettyPrint) setPrettyPrint(true);
    else setPrettyPrint(false);
  }, [showPrettyPrint]);

  const togglePrettyPrint = useCallback(() => setPrettyPrint((p) => !p), []);
  const handleCursorChange = useCallback(
    (line: number, col: number) => setCursorInfo(`Line ${line}, Column ${col}`),
    [],
  );

  useEffect(() => {
    if (!prettyPrint || !lang || !text) {
      setFormattedText(null);
      setFormatting(false);
      return;
    }
    let cancelled = false;
    setFormatting(true);
    prettyPrintCode(text, lang).then((result) => {
      if (!cancelled) {
        setFormattedText(result);
        setFormatting(false);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [prettyPrint, lang, text]);

  // While Prettier is running on an already-known-language body, show
  // a skeleton — prevents a flash of unformatted content.
  if (prettyPrint && formatting) {
    return (
      <div className="dt-response-view">
        <div className="dt-response-view-content">
          <Skeleton />
        </div>
        <TextBodyToolbar
          prettyPrint={showPrettyPrint ? prettyPrint : undefined}
          onTogglePrettyPrint={showPrettyPrint ? togglePrettyPrint : undefined}
          suggestedFormat={sniffed.suggestion}
          override={sniffed.override}
          onApplyOverride={sniffed.applyOverride}
          onClearOverride={sniffed.clearOverride}
        />
      </div>
    );
  }

  const displayText = prettyPrint && formattedText ? formattedText : text;
  const lineInfo = cursorInfo ?? `${displayText.split('\n').length} lines`;

  const content = lang ? (
    <Suspense fallback={<Skeleton />}>
      <CodeMirrorViewer
        value={displayText}
        language={lang}
        onCursorChange={handleCursorChange}
        searchQuery={searchQuery || undefined}
        searchMatchIndex={searchMatchIndex}
      />
    </Suspense>
  ) : (
    <pre className="dt-body-pre">{displayText}</pre>
  );

  return (
    <div className="dt-response-view">
      <div className="dt-response-view-content">{content}</div>
      <TextBodyToolbar
        prettyPrint={showPrettyPrint ? prettyPrint : undefined}
        onTogglePrettyPrint={showPrettyPrint ? togglePrettyPrint : undefined}
        lineInfo={lineInfo}
        suggestedFormat={sniffed.suggestion}
        override={sniffed.override}
        onApplyOverride={sniffed.applyOverride}
        onClearOverride={sniffed.clearOverride}
      />
    </div>
  );
}
