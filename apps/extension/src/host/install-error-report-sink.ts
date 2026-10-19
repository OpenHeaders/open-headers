/**
 * Boot-time wiring: the error funnel's report sink — every funnelled
 * failure in this document rides the chrome-messaging bridge to the
 * service worker's report channel as one `errorReportRecord` call. A
 * page never dials; the worker converts with its own-origin test and
 * owns the transport. Every UI entry (popup, workbench, devtools
 * panel, side panel) imports this once after the bridge install.
 */

import { installErrorReportSink } from '@openheaders/ui/shared/error-funnel';

installErrorReportSink();
