/**
 * IPC Channel Contract Definitions
 *
 * Single source of truth for all IPC channels between main ↔ renderer.
 * Both the main process (ipcMain.handle/on) and preload (ipcRenderer.invoke/send)
 * should reference these constants instead of raw strings.
 *
 * Channel categories:
 * - INVOKE: renderer calls, main responds (request/response via ipcMain.handle)
 * - SEND:   renderer fires, main listens (one-way via ipcMain.on)
 * - PUSH:   main fires, renderer listens (one-way via webContents.send)
 */

// ── Invoke channels (renderer → main, with response) ───────────────

export const IPC_INVOKE = {
  // File operations
  OPEN_FILE_DIALOG: 'openFileDialog',
  SAVE_FILE_DIALOG: 'saveFileDialog',
  READ_FILE: 'readFile',
  WRITE_FILE: 'writeFile',
  WATCH_FILE: 'watchFile',
  UNWATCH_FILE: 'unwatchFile',
  OPEN_RECORD_FILE: 'openRecordFile',
  GET_RESOURCE_PATH: 'getResourcePath',
  GET_ENV_VARIABLE: 'getEnvVariable',
  GET_APP_PATH: 'getAppPath',

  // Storage
  SAVE_TO_STORAGE: 'saveToStorage',
  LOAD_FROM_STORAGE: 'loadFromStorage',
  DELETE_FROM_STORAGE: 'deleteFromStorage',
  DELETE_DIRECTORY: 'deleteDirectory',

  // Settings
  SAVE_SETTINGS: 'saveSettings',
  GET_SETTINGS: 'getSettings',
  SET_AUTO_LAUNCH: 'setAutoLaunch',
  OPEN_EXTERNAL: 'openExternal',

  // System
  GET_SYSTEM_TIMEZONE: 'getSystemTimezone',
  CHECK_SCREEN_RECORDING_PERMISSION: 'checkScreenRecordingPermission',
  REQUEST_SCREEN_RECORDING_PERMISSION: 'requestScreenRecordingPermission',
  GET_APP_VERSION: 'getAppVersion',
  SHOW_ITEM_IN_FOLDER: 'showItemInFolder',
  OPEN_APP_PATH: 'openAppPath',

  // Shortcuts
  DISABLE_RECORDING_HOTKEY: 'disableRecordingHotkey',
  ENABLE_RECORDING_HOTKEY: 'enableRecordingHotkey',

  // Network
  CHECK_NETWORK_CONNECTIVITY: 'checkNetworkConnectivity',
  GET_NETWORK_STATE: 'getNetworkState',
  FORCE_NETWORK_CHECK: 'forceNetworkCheck',
  GET_SYSTEM_STATE: 'getSystemState',
  // HTTP request execution (main-process owned)
  HTTP_EXECUTE_REQUEST: 'http:execute-request',
  HTTP_GET_TOTP_COOLDOWN: 'http:get-totp-cooldown',
  HTTP_GENERATE_TOTP_PREVIEW: 'http:generate-totp-preview',

  // Recording
  LOAD_RECORDINGS: 'loadRecordings',
  LOAD_RECORDING: 'loadRecording',
  SAVE_RECORDING: 'saveRecording',
  SAVE_UPLOADED_RECORDING: 'saveUploadedRecording',
  DELETE_RECORDING: 'deleteRecording',
  DOWNLOAD_RECORDING: 'downloadRecording',
  UPDATE_RECORDING_METADATA: 'updateRecordingMetadata',

  // Git
  TEST_GIT_CONNECTION: 'testGitConnection',
  GET_GIT_STATUS: 'getGitStatus',
  INSTALL_GIT: 'installGit',
  SYNC_GIT_WORKSPACE: 'syncGitWorkspace',
  CLEANUP_GIT_REPOSITORY: 'cleanupGitRepository',
  COMMIT_CONFIGURATION: 'commitConfiguration',
  CREATE_BRANCH: 'createBranch',
  CHECK_WRITE_PERMISSIONS: 'checkWritePermissions',

  // CLI API
  CLI_API_STATUS: 'cli-api-status',
  CLI_API_START: 'cli-api-start',
  CLI_API_STOP: 'cli-api-stop',
  CLI_API_GET_LOGS: 'cli-api-get-logs',
  CLI_API_CLEAR_LOGS: 'cli-api-clear-logs',
  CLI_API_REGENERATE_TOKEN: 'cli-api-regenerate-token',

  // Video (handled by VideoExportManager IPC registration)
  CHECK_FFMPEG: 'check-ffmpeg',
  DOWNLOAD_FFMPEG: 'download-ffmpeg',
  CONVERT_VIDEO: 'convert-video',

  // Workspace state (main-process owned)
  WORKSPACE_STATE_INITIALIZE: 'workspace-state:initialize',
  WORKSPACE_STATE_GET_STATE: 'workspace-state:get-state',
  WORKSPACE_STATE_SWITCH_WORKSPACE: 'workspace-state:switch-workspace',
  WORKSPACE_STATE_ADD_COLLECTION: 'workspace-state:add-collection',
  WORKSPACE_STATE_UPDATE_COLLECTION: 'workspace-state:update-collection',
  WORKSPACE_STATE_REMOVE_COLLECTION: 'workspace-state:remove-collection',
  WORKSPACE_STATE_CREATE_WORKSPACE: 'workspace-state:create-workspace',
  WORKSPACE_STATE_UPDATE_WORKSPACE: 'workspace-state:update-workspace',
  WORKSPACE_STATE_DELETE_WORKSPACE: 'workspace-state:delete-workspace',
  WORKSPACE_STATE_COPY_WORKSPACE_DATA: 'workspace-state:copy-workspace-data',
  WORKSPACE_STATE_CREATE_ENVIRONMENT: 'workspace-state:create-environment',
  WORKSPACE_STATE_DELETE_ENVIRONMENT: 'workspace-state:delete-environment',
  WORKSPACE_STATE_SWITCH_ENVIRONMENT: 'workspace-state:switch-environment',
  WORKSPACE_STATE_SET_VARIABLE: 'workspace-state:set-variable',
} as const;

// ── Send channels (renderer → main, fire-and-forget) ───────────────

export const IPC_SEND = {
  // Updates
  CHECK_FOR_UPDATES: 'check-for-updates',
  INSTALL_UPDATE: 'install-update',

  // Window management
  SHOW_MAIN_WINDOW: 'showMainWindow',
  HIDE_MAIN_WINDOW: 'hideMainWindow',
  MINIMIZE_WINDOW: 'minimizeWindow',
  MAXIMIZE_WINDOW: 'maximizeWindow',
  CLOSE_WINDOW: 'closeWindow',
  QUIT_APP: 'quitApp',
  RESTART_APP: 'restartApp',

  // Renderer lifecycle
  GET_STARTUP_DATA: 'get-startup-data',
  RENDERER_READY: 'renderer-ready',
} as const;

// ── Push channels (main → renderer, via webContents.send) ──────────

export const IPC_PUSH = {
  // Navigation
  NAVIGATE_TO: 'navigate-to',
  TRIGGER_UPDATE_CHECK: 'trigger-update-check',

  // App visibility
  SHOW_APP: 'showApp',
  HIDE_APP: 'hideApp',

  // Network
  NETWORK_STATE_CHANGED: 'network-state-changed',
  NETWORK_STATE_SYNC: 'network-state-sync',
  NETWORK_CHANGE: 'network-change',

  // System
  SYSTEM_SUSPEND: 'system-suspend',
  SYSTEM_RESUME: 'system-resume',

  // Recording
  RECORDING_RECEIVED: 'recording-received',
  RECORDING_PROGRESS: 'recording-progress',
  RECORDING_PROCESSING: 'recording-processing',
  RECORDING_DELETED: 'recording-deleted',
  RECORDING_METADATA_UPDATED: 'recording-metadata-updated',

  // Video
  START_VIDEO_RECORDING: 'start-video-recording',
  STOP_VIDEO_RECORDING: 'stop-video-recording',
  VIDEO_CONVERSION_PROGRESS: 'video-conversion-progress',
  FFMPEG_DOWNLOAD_PROGRESS: 'ffmpeg-download-progress',

  // WebSocket
  WS_CONNECTION_STATUS_CHANGED: 'ws-connection-status-changed',

  // Git
  GIT_CONNECTION_PROGRESS: 'git-connection-progress',
  GIT_COMMIT_PROGRESS: 'git-commit-progress',

  // Protocol / CLI
  PROCESS_TEAM_WORKSPACE_INVITE: 'process-team-workspace-invite',
  PROCESS_ENVIRONMENT_CONFIG_IMPORT: 'process-environment-config-import',
  SHOW_ERROR_MESSAGE: 'show-error-message',
  CLI_WORKSPACE_JOINED: 'cli-workspace-joined',
  ENVIRONMENTS_STRUCTURE_CHANGED: 'environments-structure-changed',

  // Workspace data
  WORKSPACE_DATA_UPDATED: 'workspace-data-updated',
  SYNC_STATUS_UPDATED: 'sync-status-updated',

  // Settings (main → renderer, after any mutation from any source)
  SETTINGS_CHANGED: 'settings-changed',

  // Workspace state (main → renderer)
  WORKSPACE_STATE_PATCH: 'workspace:state-patch',
  WORKSPACE_SWITCH_PROGRESS: 'workspace:switch-progress',
} as const;

// ── Type helpers ────────────────────────────────────────────────────
