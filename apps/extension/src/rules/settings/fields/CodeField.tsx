/**
 * CodeField — wraps the shared CodeEditor for settings with a code
 * payload (JSON, JavaScript, CSS).
 *
 * Maintains a local draft and commits on blur so highlighting doesn't
 * thrash the store on every keystroke. `regex` and `plaintext` fall
 * back to the javascript highlighter — good enough for now; a dedicated
 * regex tokenizer can land later without touching any caller.
 */

import type React from 'react';
import { useCallback, useEffect, useState } from 'react';
import CodeEditor from '../../components/CodeEditor';
import { useUntypedSetting } from '../hooks';
import type { SettingDef } from '../types';
import FieldRow from './FieldRow';

interface CodeFieldProps {
  def: SettingDef;
}

type SupportedLanguage = 'javascript' | 'css' | 'json';

function resolveLanguage(lang?: string): SupportedLanguage {
  if (lang === 'json' || lang === 'javascript' || lang === 'css') return lang;
  return 'javascript';
}

const CodeField: React.FC<CodeFieldProps> = ({ def }) => {
  const [storeValue, setStoreValue] = useUntypedSetting(def.key);
  const persisted = typeof storeValue === 'string' ? storeValue : '';
  const [draft, setDraft] = useState(persisted);

  useEffect(() => {
    setDraft(persisted);
  }, [persisted]);

  const commit = useCallback(() => {
    if (draft !== persisted) setStoreValue(draft);
  }, [draft, persisted, setStoreValue]);

  return (
    <FieldRow
      settingKey={def.key}
      label={def.label}
      description={def.description}
      experimental={def.experimental}
      requiresConnection={def.requiresConnection}
      block
    >
      {/* biome-ignore lint/a11y/noStaticElementInteractions: onBlur captures descendant blur to persist draft */}
      <div onBlur={commit}>
        <CodeEditor value={draft} onChange={setDraft} language={resolveLanguage(def.language)} minHeight={160} />
      </div>
    </FieldRow>
  );
};

export default CodeField;
