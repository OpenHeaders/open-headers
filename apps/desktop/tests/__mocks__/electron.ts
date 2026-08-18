// Mock electron module for testing outside Electron runtime

export const app = {
  getPath: (_name: string) => `/tmp/open-headers-test/${_name}`,
  getName: () => 'OpenHeaders',
  getVersion: () => '0.0.0-test',
  getLocale: () => 'en-US',
  setName: () => {},
  quit: () => {},
  relaunch: () => {},
  disableHardwareAcceleration: () => {},
  requestSingleInstanceLock: () => true,
  whenReady: () => Promise.resolve(),
  on: () => {},
  commandLine: { appendSwitch: () => {} },
};

export const ipcMain = { handle: () => {}, on: () => {}, once: () => {} };
export const ipcRenderer = { invoke: () => Promise.resolve(), on: () => {}, send: () => {} };
export const contextBridge = { exposeInMainWorld: () => {} };
export function BrowserWindow() {}
BrowserWindow.getFocusedWindow = () => null;
BrowserWindow.getAllWindows = () => [];
export const Menu = { buildFromTemplate: () => {}, setApplicationMenu: () => {} };
export const nativeImage = {
  createFromPath: () => ({ setTemplateImage: () => {} }),
  createFromNamedImage: () => ({ resize: () => ({ setTemplateImage: () => {} }) }),
};
export const shell = { openExternal: () => {}, showItemInFolder: () => {} };
export const dialog = {
  showOpenDialog: () => Promise.resolve({}),
  showSaveDialog: () => Promise.resolve({}),
  showMessageBox: () => Promise.resolve({ response: 0 }),
  showErrorBox: () => {},
};
export const desktopCapturer = { getSources: () => Promise.resolve([]) };
export const screen = { getAllDisplays: () => [] };

/** One mutable partition singleton: tests reach it via
 *  `session.fromPartition(...)` and steer `resolveProxyAnswer` /
 *  inspect the last `setProxy` config. */
export const sessionPartitionMock = {
  proxyConfig: undefined as unknown,
  resolveProxyAnswer: 'DIRECT',
  setProxy(config: unknown): Promise<void> {
    this.proxyConfig = config;
    return Promise.resolve();
  },
  resolveProxy(_url: string): Promise<string> {
    return Promise.resolve(this.resolveProxyAnswer);
  },
};
export const session = {
  fromPartition: (_name: string) => sessionPartitionMock,
  defaultSession: {
    setPermissionRequestHandler: () => {},
    setPermissionCheckHandler: () => {},
  },
};

export default {
  app,
  ipcMain,
  ipcRenderer,
  contextBridge,
  BrowserWindow,
  Menu,
  nativeImage,
  shell,
  dialog,
  desktopCapturer,
  screen,
  session,
};
