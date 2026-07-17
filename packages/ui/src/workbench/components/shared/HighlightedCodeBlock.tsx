/**
 * HighlightedCodeBlock — fenced-code renderer for markdown previews
 * (the workbench's `renderCodeBlock` for `MarkdownView`).
 *
 * Highlighting reuses Monaco's Monarch tokenizer (`editor.colorize`) —
 * the same engine that colors the editable buffers — so previews match
 * the editors exactly with zero additional parser dependency. The
 * colorized HTML is parsed with an inert `DOMParser` document and
 * re-rendered as React spans: no markup string ever reaches
 * `innerHTML`. Token colors come from Monaco's own theme stylesheet
 * (`.monaco-editor .mtk*`), kept aligned with the app theme via
 * `setTheme`.
 *
 * Fence languages without a registered grammar (bash, python, …)
 * render unhighlighted — still with the copy button and language tag.
 */

import { CheckOutlined, CopyOutlined } from '@ant-design/icons';
import { useUiTheme } from '@openheaders/ui/context';
import { Button, Tooltip } from 'antd';
import * as monacoEdCore from 'monaco-editor/esm/vs/editor/edcore.main';
import type React from 'react';
import { useEffect, useState } from 'react';
import { useT } from '@openheaders/ui/context/LocaleContext';
import '../monaco/bootstrap';

/** Fence info-string → registered Monaco language id. */
const FENCE_TO_MONACO: Record<string, string> = {
  js: 'javascript',
  javascript: 'javascript',
  ts: 'typescript',
  typescript: 'typescript',
  json: 'json',
  css: 'css',
  html: 'html',
  xml: 'xml',
  svg: 'xml',
  md: 'markdown',
  markdown: 'markdown',
};

interface TokenSpan {
  cls: string;
  text: string;
}

/** Re-render Monaco's colorized HTML (`<span class="mtk…">` + `<br/>`)
 *  as structured lines. DOMParser documents are inert — nothing
 *  executes — and only text + class names are read back out. */
function parseColorized(html: string): TokenSpan[][] {
  const doc = new DOMParser().parseFromString(html, 'text/html');
  const lines: TokenSpan[][] = [[]];
  const walk = (node: Node): void => {
    if (node.nodeType === Node.TEXT_NODE) {
      const text = node.textContent;
      if (text) lines[lines.length - 1]?.push({ cls: '', text });
      return;
    }
    if (node instanceof HTMLElement) {
      if (node.tagName === 'BR') {
        lines.push([]);
        return;
      }
      if (node.tagName === 'SPAN' && node.childElementCount === 0) {
        lines[lines.length - 1]?.push({ cls: node.className, text: node.textContent ?? '' });
        return;
      }
    }
    node.childNodes.forEach(walk);
  };
  doc.body.childNodes.forEach(walk);
  return lines;
}

interface HighlightedCodeBlockProps {
  code: string;
  /** Fence language (info string), if any. */
  lang?: string;
}

const HighlightedCodeBlock: React.FC<HighlightedCodeBlockProps> = ({ code, lang }) => {
  const t = useT();
  const { monacoTheme } = useUiTheme();
  const [lines, setLines] = useState<TokenSpan[][] | null>(null);
  const [copied, setCopied] = useState(false);

  const monacoLang = lang ? FENCE_TO_MONACO[lang.toLowerCase()] : undefined;

  useEffect(() => {
    if (!monacoLang) {
      setLines(null);
      return;
    }
    // Align the standalone theme service with the app theme so the
    // `.mtk*` palette matches — same global the mounted editors set.
    monacoEdCore.editor.setTheme(monacoTheme);
    let cancelled = false;
    void monacoEdCore.editor
      .colorize(code, monacoLang, { tabSize: 2 })
      .then((html) => {
        if (!cancelled) setLines(parseColorized(html));
      })
      .catch(() => {
        if (!cancelled) setLines(null);
      });
    return () => {
      cancelled = true;
    };
  }, [code, monacoLang, monacoTheme]);

  const copy = () => {
    void navigator.clipboard.writeText(code).then(() => {
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    });
  };

  return (
    <>
      <code className="monaco-editor oh-markdown-code-body">
        {lines
          ? lines.map((line, li) => (
              // biome-ignore lint/suspicious/noArrayIndexKey: lines are positional and re-render wholesale
              <span key={li} className="oh-markdown-code-line">
                {line.map((tok, ti) => (
                  // biome-ignore lint/suspicious/noArrayIndexKey: tokens are positional and re-render wholesale
                  <span key={ti} className={tok.cls}>
                    {tok.text}
                  </span>
                ))}
                {'\n'}
              </span>
            ))
          : code}
      </code>
      {lang && <span className="oh-markdown-code-lang">{lang}</span>}
      <Tooltip title={copied ? t('workbench.markdown.copied') : t('shared.action.copy')} placement="left">
        <Button
          size="small"
          type="text"
          className="oh-markdown-code-copy"
          aria-label={t('workbench.markdown.copyCode')}
          icon={copied ? <CheckOutlined /> : <CopyOutlined />}
          onClick={copy}
        />
      </Tooltip>
    </>
  );
};

export default HighlightedCodeBlock;
