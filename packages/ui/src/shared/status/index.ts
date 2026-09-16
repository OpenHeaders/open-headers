export type { AddonsPillProps } from './AddonsPill';
export { AddonsPill } from './AddonsPill';
export type { DesktopCompanion, DesktopCompanionState } from './companion-rows';
export {
  CompanionStatusRows,
  DesktopConnectAction,
  DesktopDownloadAction,
  DesktopOpenAppAction,
  deriveDesktopCompanionState,
  desktopCompanionRunsRequests,
  useDesktopCompanion,
} from './companion-rows';
export { productStatusExtras, productStatusInlineActions } from './product-extras';
export type { StatusPillDensity, StatusPillProps } from './StatusPill';
export { STATUS_DOCS_SECTION_ID, STATUS_TAG_WIDTH, StatusPill } from './StatusPill';
export type { ReportInput } from './store';
export {
  __resetForTests as __resetStatusForTests,
  clearStatus,
  getStatusSnapshot,
  report,
  subscribe,
} from './store';
export type { StatusEntry, StatusLevel, StatusListener, StatusSnapshot, StatusSubsystem } from './types';
export { SUBSYSTEM_LABELS, worstLevel } from './types';
