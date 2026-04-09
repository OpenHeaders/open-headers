/**
 * CodeEditor — lightweight syntax-highlighted code editor.
 *
 * Uses react-simple-code-editor (3KB) + Prism.js (15KB) for
 * syntax highlighting without the weight of Monaco or CodeMirror.
 *
 * Reusable across: MockRuleFields (dynamic JS), InjectRuleFields (JS/CSS),
 * and any future code input needs.
 */

import Prism from 'prismjs';
import Editor from 'react-simple-code-editor';
import 'prismjs/components/prism-javascript';
import 'prismjs/components/prism-css';
import 'prismjs/components/prism-json';
import 'prismjs/themes/prism-tomorrow.css';
import { theme } from 'antd';
import type React from 'react';

interface CodeEditorProps {
  value?: string;
  onChange?: (value: string) => void;
  language?: 'javascript' | 'css' | 'json';
  placeholder?: string;
  minHeight?: number;
  readOnly?: boolean;
}

const CodeEditor: React.FC<CodeEditorProps> = ({
  value = '',
  onChange,
  language = 'javascript',
  placeholder,
  minHeight = 200,
  readOnly = false,
}) => {
  const { token } = theme.useToken();

  const highlight = (code: string) => {
    const grammar = Prism.languages[language];
    if (!grammar) return code;
    return Prism.highlight(code, grammar, language);
  };

  return (
    <div
      style={{
        border: `1px solid ${token.colorBorder}`,
        borderRadius: 6,
        overflow: 'hidden',
        background: '#1e1e1e',
        position: 'relative',
      }}
    >
      {!value && placeholder && (
        <div
          style={{
            position: 'absolute',
            top: 10,
            left: 12,
            color: 'rgba(255,255,255,0.2)',
            fontFamily: "'JetBrains Mono', 'Fira Code', 'Consolas', monospace",
            fontSize: 13,
            lineHeight: 1.5,
            pointerEvents: 'none',
            whiteSpace: 'pre',
            zIndex: 0,
          }}
        >
          {placeholder}
        </div>
      )}
      <Editor
        value={value}
        onValueChange={(code) => onChange?.(code)}
        highlight={highlight}
        padding={10}
        readOnly={readOnly}
        style={{
          fontFamily: "'JetBrains Mono', 'Fira Code', 'Consolas', monospace",
          fontSize: 13,
          lineHeight: 1.5,
          minHeight,
          color: '#d4d4d4',
          caretColor: '#d4d4d4',
        }}
        textareaClassName="code-editor-textarea"
      />
    </div>
  );
};

export default CodeEditor;
