//! Other programs: one that is waited for, one that is started and left
//! to itself.

use std::os::windows::io::{AsRawHandle, FromRawHandle, OwnedHandle};
use std::path::Path;
use std::process::{Command, Stdio};

use windows::Win32::Foundation::{HANDLE, HANDLE_FLAG_INHERIT, HANDLE_FLAGS, SetHandleInformation, WAIT_OBJECT_0};
use windows::Win32::System::Threading::{INFINITE, OpenProcess, PROCESS_SYNCHRONIZE, WaitForSingleObject};

/// A running process, held to be waited for. Taken while the process is
/// known to run: Windows hands a process id to another once its process ended.
pub fn open_to_wait(pid: u32) -> Result<OwnedHandle, String> {
    let process = unsafe { OpenProcess(PROCESS_SYNCHRONIZE, false, pid) }
        .map_err(|error| format!("0x{:08X} {}", error.code().0 as u32, error.message()))?;
    Ok(unsafe { OwnedHandle::from_raw_handle(process.0) })
}

/// Whether the process ended within this long.
pub fn ended_within(process: &impl AsRawHandle, milliseconds: u64) -> bool {
    let wait = u32::try_from(milliseconds).unwrap_or(INFINITE - 1).min(INFINITE - 1);
    let waited = unsafe { WaitForSingleObject(HANDLE(process.as_raw_handle()), wait) };
    waited == WAIT_OBJECT_0
}

/// Keeps a handle this program was handed from the programs it starts:
/// Windows passes every handle marked for it on to a new process, which
/// then holds it open for as long as it runs. A handle that is not there
/// has nothing to keep.
pub fn keep_to_self(handle: &impl AsRawHandle) {
    let _ = unsafe { SetHandleInformation(HANDLE(handle.as_raw_handle()), HANDLE_FLAG_INHERIT.0, HANDLE_FLAGS(0)) };
}

/// A program to start with none of this one's standard handles.
pub fn apart(program: &Path) -> Command {
    let mut command = Command::new(program);
    command.stdin(Stdio::null()).stdout(Stdio::null()).stderr(Stdio::null());
    command
}
