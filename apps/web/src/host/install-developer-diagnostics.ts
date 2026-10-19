/**
 * Boot-time wiring: the developer diagnostics (the dev crash commands)
 * exist only under Vite's dev server; a built web app never calls this.
 */

import { installDeveloperDiagnostics } from '@openheaders/ui/workbench/developer-diagnostics';

if (import.meta.env.DEV) installDeveloperDiagnostics();
