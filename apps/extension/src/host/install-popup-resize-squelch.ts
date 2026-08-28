/**
 * Popup-only: the action popup is the one surface whose window fires
 * size-less `resize` events (see `popup-resize-squelch.ts`). The side
 * panel and the workbench resize for real and do not import this.
 */

import { installPopupResizeSquelch } from './popup-resize-squelch';

installPopupResizeSquelch(window);
