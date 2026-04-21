/**
 * Settings UI barrel — heavy React components that render the settings
 * screen. Kept separate from the core barrel (./index) so lightweight
 * consumers (popup, sidepanel, panel, ThemeContext) can import the
 * provider/hooks/store without dragging the settings UI — and, via
 * SettingRow → CodeField → CodeEditor, Monaco — into their bundle.
 */

export { default as SettingsModal } from './components/SettingsModal';
export { default as SettingsShell } from './components/SettingsShell';
export { default as SettingsTab } from './components/SettingsTab';
