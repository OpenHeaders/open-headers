/**
 * ImportTextContext — hands the shell's text-import routing (detect the
 * pasted content's format and open the matching stage-2 import modal
 * pre-filled, same hand-off the import hub uses) to deep workbench
 * components without threading a prop through every layer. Lets the
 * URL bar hijack a pasted curl command into the curl import flow.
 *
 * Mounted by the workbench shell. Consumers receive `null` when no
 * shell provides the action (other surfaces, tests) and should let the
 * paste proceed as plain text instead.
 */

import { createContext, useContext } from 'react';
import type React from 'react';

export type ImportText = (text: string) => void;

const ImportTextContext = createContext<ImportText | null>(null);

export const ImportTextProvider: React.FC<{
  importText: ImportText;
  children: React.ReactNode;
}> = ({ importText, children }) => <ImportTextContext.Provider value={importText}>{children}</ImportTextContext.Provider>;

export function useImportText(): ImportText | null {
  return useContext(ImportTextContext);
}
