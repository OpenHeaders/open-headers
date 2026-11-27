//! What a person is asked when a run stops: Windows' own task dialog in
//! front of the installer's window — the run's sentence, with Try again
//! where another try can end otherwise, Show log, and Close.

use std::path::Path;

use windows::Win32::Foundation::{HWND, LPARAM, S_FALSE, S_OK, WPARAM};
use windows::Win32::UI::Controls::{
    TASKDIALOG_BUTTON, TASKDIALOG_FLAGS, TASKDIALOG_NOTIFICATIONS, TASKDIALOGCONFIG, TASKDIALOGCONFIG_0,
    TD_WARNING_ICON, TDCBF_CLOSE_BUTTON, TDF_ALLOW_DIALOG_CANCELLATION, TDF_POSITION_RELATIVE_TO_WINDOW,
    TDN_BUTTON_CLICKED, TaskDialogIndirect,
};
use windows::Win32::UI::Shell::ShellExecuteW;
use windows::Win32::UI::WindowsAndMessaging::{IDCLOSE, SW_SHOWNORMAL};
use windows::core::{HRESULT, HSTRING, PCWSTR, w};

use crate::outcome::Failure;

pub const TITLE: &str = "Open Headers Installer";
const TRY_AGAIN: i32 = 1001;
const SHOW_LOG: i32 = 1002;
/// The dialog's width, in dialog units: wide enough for every sentence it shows.
const WIDTH: u32 = 220;

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Answer {
    TryAgain,
    Close,
}

/// "Show log" opens the log and leaves the dialog where it is; any other button ends it.
unsafe extern "system" fn on_event(
    window: HWND,
    event: TASKDIALOG_NOTIFICATIONS,
    wparam: WPARAM,
    _lparam: LPARAM,
    data: isize,
) -> HRESULT {
    if event != TDN_BUTTON_CLICKED || wparam.0 as i32 != SHOW_LOG {
        return S_OK;
    }
    // `ask` holds the path for as long as its dialog lives.
    let log = unsafe { &*(data as *const HSTRING) };
    unsafe {
        ShellExecuteW(
            Some(window),
            w!("open"),
            log,
            PCWSTR::null(),
            PCWSTR::null(),
            SW_SHOWNORMAL,
        )
    };
    S_FALSE
}

/// Shows why the run stopped, in front of `owner`, and returns when the
/// person has answered. Where Windows cannot show the dialog the answer
/// is Close.
pub fn ask(owner: HWND, failure: Failure, log_path: &Path) -> Answer {
    let title = HSTRING::from(TITLE);
    let sentence = HSTRING::from(failure.sentence());
    let log = HSTRING::from(log_path.as_os_str());
    let again = failure.worth_another_try();
    let buttons: Vec<TASKDIALOG_BUTTON> = [(TRY_AGAIN, w!("Try again")), (SHOW_LOG, w!("Show log"))]
        .into_iter()
        .filter(|(id, _)| again || *id != TRY_AGAIN)
        .map(|(id, label)| TASKDIALOG_BUTTON {
            nButtonID: id,
            pszButtonText: label,
        })
        .collect();

    let config = TASKDIALOGCONFIG {
        cbSize: size_of::<TASKDIALOGCONFIG>() as u32,
        hwndParent: owner,
        dwFlags: TASKDIALOG_FLAGS(TDF_ALLOW_DIALOG_CANCELLATION.0 | TDF_POSITION_RELATIVE_TO_WINDOW.0),
        dwCommonButtons: TDCBF_CLOSE_BUTTON,
        pszWindowTitle: PCWSTR(title.as_ptr()),
        Anonymous1: TASKDIALOGCONFIG_0 {
            pszMainIcon: TD_WARNING_ICON,
        },
        pszContent: PCWSTR(sentence.as_ptr()),
        cButtons: buttons.len() as u32,
        pButtons: buttons.as_ptr(),
        nDefaultButton: if again { TRY_AGAIN } else { IDCLOSE.0 },
        pfCallback: Some(on_event),
        lpCallbackData: (&raw const log) as isize,
        cxWidth: WIDTH,
        ..Default::default()
    };
    let mut pressed = 0i32;
    let shown = unsafe { TaskDialogIndirect(&raw const config, Some(&raw mut pressed), None, None) };
    if shown.is_ok() && pressed == TRY_AGAIN {
        Answer::TryAgain
    } else {
        Answer::Close
    }
}
