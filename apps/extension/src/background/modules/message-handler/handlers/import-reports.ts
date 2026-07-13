/** Import-report persistence RPCs. */

import type { ImportReport } from '@openheaders/core/import';
import {
  clearImportReports,
  findImportReportBySourceHash,
  listImportReports,
  recordImportReport,
} from '@openheaders/oracle/entity/import-reports-store';
import type { HandlerMap } from '../types';

export const importReportHandlers: HandlerMap = {
  recordImportReport: ({ message, respond }) => {
    const report = message.report as ImportReport;
    recordImportReport(report)
      .then(() => respond({ success: true }))
      .catch((err: Error) => respond({ success: false, error: err.message }));
    return true;
  },

  listImportReports: ({ message, respond }) => {
    const workspaceId = typeof message.workspaceId === 'string' ? message.workspaceId : undefined;
    listImportReports(workspaceId)
      .then((reports) => respond({ reports }))
      .catch((err: Error) => respond({ reports: [], error: err.message }));
    return true;
  },

  clearImportReports: ({ respond }) => {
    clearImportReports()
      .then(() => respond({ success: true }))
      .catch((err: Error) => respond({ success: false, error: err.message }));
    return true;
  },

  findImportReportBySourceHash: ({ message, respond }) => {
    const hash = (message.sourceHash as string | undefined) ?? '';
    findImportReportBySourceHash(hash)
      .then((report) => respond({ report }))
      .catch((err: Error) => respond({ report: null, error: err.message }));
    return true;
  },
};
