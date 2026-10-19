/**
 * Boot-time wiring: the error funnel's report sink — every funnelled
 * failure in this renderer rides the IPC bridge to main's report
 * channel as one `errorReportRecord` call. The renderer never dials;
 * main converts with its own-origin test and owns the transport.
 */

import { installErrorReportSink } from '@openheaders/ui/shared/error-funnel';

installErrorReportSink();
