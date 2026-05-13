/**
 * @openheaders/ui — shared React UI for the OpenHeaders platform.
 *
 * Use subpath imports. The root barrel is intentionally empty; the
 * substantive surfaces live under:
 *
 *   import { Workbench } from '@openheaders/ui/workbench'
 *   import { Panel } from '@openheaders/ui/panel'
 *   import { PopupShell } from '@openheaders/ui/popup'
 *   import { ... } from '@openheaders/ui/shared/<subdir>'
 *
 * Host apps supply transports + value-import implementations via React
 * context at their mount point.
 */
export {};
