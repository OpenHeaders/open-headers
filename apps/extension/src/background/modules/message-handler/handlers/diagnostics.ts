/** The diagnostic bundle's system-facts RPC (the error reports plan §4.5). */

import { buildExtensionDiagnosticsFacts } from '../../diagnostics-facts';
import type { HandlerMap } from '../types';

export const diagnosticsHandlers: HandlerMap = {
  diagnosticsFacts: ({ respond }) => {
    void buildExtensionDiagnosticsFacts().then((facts) => respond({ facts }));
    return true;
  },
};
