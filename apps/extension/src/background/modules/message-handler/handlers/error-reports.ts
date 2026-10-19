/** Crash-and-error-report RPCs — the UI documents' funnel entries and the inspector's "Error reports" section. */

import type { ErrorReportWireEntry } from '@openheaders/core/bridge';
import { readErrorReportSnapshot, recordErrorReportEntry } from '../../error-reports';
import type { HandlerMap } from '../types';

export const errorReportHandlers: HandlerMap = {
  errorReportRecord: ({ message, respond }) => {
    recordErrorReportEntry(message.entry as ErrorReportWireEntry);
    respond({ success: true });
  },

  errorReportRead: ({ respond }) => {
    void readErrorReportSnapshot().then(respond);
    return true;
  },
};
