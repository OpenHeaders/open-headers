/**
 * Boot-time wiring: register the browser-extension's `chrome.storage`
 * adapter as the global host-storage implementation. Every entry point
 * (background SW, popup, workbench, devtools panel, side panel) imports
 * this module once at startup so any UI code that reads persisted state
 * through `@openheaders/core/storage`'s `hostStorage` proxy lands on
 * the chrome-backed adapter.
 *
 * Other hosts (Electron desktop, web app) ship their own analogous
 * install module that wires a different adapter — the contract on the
 * UI side is identical.
 */

import { setHostStorage } from '@openheaders/core/storage';
import { extensionStorage } from './extension-storage';

setHostStorage(extensionStorage);
