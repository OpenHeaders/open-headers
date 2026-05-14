/**
 * Boot-time wiring: register the browser-extension's chrome-messaging
 * adapter as the global host-bridge implementation. Every entry point
 * (background SW, popup, workbench, devtools panel, side panel) imports
 * this module once at startup so any UI code that talks to the host
 * through `@openheaders/core/bridge`'s `hostBridge` proxy lands on the
 * chrome-backed transport.
 *
 * Other hosts (Electron desktop, web app) ship their own analogous
 * install module that wires a different transport — the contract on the
 * UI side is identical.
 */

import { setHostBridge } from '@openheaders/core/bridge';
import { chromeBridge } from '@/utils/bridge';

setHostBridge(chromeBridge);
