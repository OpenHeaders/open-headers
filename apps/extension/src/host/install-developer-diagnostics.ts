/**
 * Boot-time wiring: the developer diagnostics (the dev crash commands)
 * exist only on a development install — unpacked on Chromium, a
 * temporary add-on on Firefox. `management.getSelf` needs no permission
 * on any engine; a store install never answers `development`. The
 * answer is asynchronous, so the palette section appears once it lands.
 */

import { installDeveloperDiagnostics } from '@openheaders/ui/workbench/developer-diagnostics';
import { getBrowserAPI } from '@/types/browser';

void getBrowserAPI()
  .management?.getSelf?.()
  .then((self) => {
    if (self?.installType === 'development') installDeveloperDiagnostics();
  })
  .catch(() => undefined);
