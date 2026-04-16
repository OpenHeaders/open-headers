/**
 * shell-event-bus — workspace.html re-export from the shared module.
 */

export type { ShellEventBus, ShellEventBusHandle } from '@/shared/dock-layout';
export {
  createShellEventBus,
  ShellEventBusContext,
  useShellClickCapture,
  useShellFocusIn,
  useShellFocusOut,
  useShellKeyDown,
} from '@/shared/dock-layout';
