/**
 * Read-only Monaco diff for a two-sided response override — original
 * (what the server sent) on the left, modified (what Open Headers served
 * to the page) on the right. Both sides are pretty-printed first when
 * the language is known, so the diff shows semantic changes rather
 * than formatting noise (servers often ship minified bodies while the
 * override is hand-formatted).
 */

import { DiffEditor } from '@monaco-editor/react';
import { useTheme } from '@openheaders/ui/context';
import { useEffect, useState } from 'react';
// Side-effect import: kicks Monaco's bootstrap at module load.
import '@openheaders/ui/workbench/components/monaco/bootstrap';
import { canPrettyPrint, detectLanguage } from '../../data/mime';
import { prettyPrintCode } from './pretty-print';
import Skeleton from './Skeleton';

interface DiffBodyViewProps {
  /** The server's untouched body. */
  original: string;
  /** The body the page actually received (post-rule). */
  modified: string;
  /** MIME driving syntax highlight + pretty-print eligibility. */
  declaredMime: string;
}

export default function DiffBodyView({ original, modified, declaredMime }: DiffBodyViewProps) {
  const { monacoTheme } = useTheme();
  const lang = detectLanguage(declaredMime);
  const shouldFormat = lang !== null && canPrettyPrint(declaredMime);
  const [pretty, setPretty] = useState<{ original: string; modified: string } | null>(null);

  useEffect(() => {
    if (!shouldFormat || !lang) {
      setPretty(null);
      return;
    }
    let cancelled = false;
    Promise.all([prettyPrintCode(original, lang), prettyPrintCode(modified, lang)]).then(([o, a]) => {
      if (!cancelled) setPretty({ original: o, modified: a });
    });
    return () => {
      cancelled = true;
    };
  }, [shouldFormat, lang, original, modified]);

  // Hold the skeleton until both sides are formatted — diffing the raw
  // text first would flash a noise-heavy diff, then reflow.
  if (shouldFormat && pretty === null) return <Skeleton />;

  return (
    <div className="dt-codemirror-wrap">
      <DiffEditor
        height="100%"
        language={lang ?? 'plaintext'}
        theme={monacoTheme}
        original={pretty?.original ?? original}
        modified={pretty?.modified ?? modified}
        options={{
          readOnly: true,
          renderSideBySide: true,
          minimap: { enabled: false },
          wordWrap: 'on',
          automaticLayout: true,
          scrollBeyondLastLine: false,
          renderLineHighlight: 'none',
          hideUnchangedRegions: { enabled: true },
          find: { addExtraSpaceOnTop: false },
          hover: { above: false },
        }}
      />
    </div>
  );
}
