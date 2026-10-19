/**
 * Boot-time wiring: the developer diagnostics (the dev crash commands)
 * exist only where Electron reports the app unpackaged — `desktop dev`
 * and the unpackaged e2e build. A packaged app never calls this.
 */

import { installDeveloperDiagnostics } from '@openheaders/ui/workbench/developer-diagnostics';

if (!window.oh.startupData.isPackaged) installDeveloperDiagnostics();
