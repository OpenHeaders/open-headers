//! The window a person watches: Windows' own task dialog — one line, a
//! bar, Cancel; and when a run stops, its sentence with Try again, Show
//! log and Close.
//!
//! The dialog owns the thread that shows it. The install runs on a
//! thread of its own, started once the dialog is up, and tells the
//! dialog what to show by sending it messages.

use core::ffi::c_void;
use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicBool, AtomicIsize, Ordering};
use std::sync::{Arc, Condvar, Mutex};
use std::thread::{self, JoinHandle};

use windows::Win32::Foundation::{HWND, LPARAM, S_FALSE, S_OK, WPARAM};
use windows::Win32::UI::Controls::{
    TASKDIALOG_BUTTON, TASKDIALOG_COMMON_BUTTON_FLAGS, TASKDIALOG_FLAGS, TASKDIALOG_MESSAGES, TASKDIALOG_NOTIFICATIONS,
    TASKDIALOGCONFIG, TASKDIALOGCONFIG_0, TD_WARNING_ICON, TDCBF_CANCEL_BUTTON, TDCBF_CLOSE_BUTTON, TDE_CONTENT,
    TDF_ALLOW_DIALOG_CANCELLATION, TDF_SHOW_PROGRESS_BAR, TDM_CLICK_BUTTON, TDM_ENABLE_BUTTON, TDM_NAVIGATE_PAGE,
    TDM_SET_ELEMENT_TEXT, TDM_SET_MARQUEE_PROGRESS_BAR, TDM_SET_PROGRESS_BAR_MARQUEE, TDM_SET_PROGRESS_BAR_POS,
    TDM_UPDATE_ELEMENT_TEXT, TDN_BUTTON_CLICKED, TDN_CREATED, TaskDialogIndirect,
};
use windows::Win32::UI::Shell::ShellExecuteW;
use windows::Win32::UI::WindowsAndMessaging::{IDCANCEL, IDCLOSE, SW_SHOWNORMAL, SendMessageW};
use windows::core::{HRESULT, HSTRING, PCWSTR, w};

use crate::flow::{Stage, Watcher};
use crate::outcome::Failure;

const TITLE: &str = "OpenHeaders Installer";
const TRY_AGAIN: i32 = 1001;
const SHOW_LOG: i32 = 1002;
/// The dialog's width, in dialog units: wide enough for every line it shows.
const WIDTH: u32 = 220;

#[derive(Clone, Copy, PartialEq, Eq)]
enum Page {
    Progress,
    Stopped(Failure),
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Answer {
    TryAgain,
    Close,
}

/// What a page's configuration points at, kept until the next page.
struct Kept {
    _text: Vec<Vec<u16>>,
    _buttons: Vec<TASKDIALOG_BUTTON>,
}

// The pointers inside lead to the buffers beside them, which no thread reads through this value.
unsafe impl Send for Kept {}

type Work = Box<dyn FnOnce(&Window) -> i32 + Send>;

struct Shared {
    /// The dialog's window handle; 0 before it is up and after it is gone.
    window: AtomicIsize,
    page: Mutex<Page>,
    stage: Mutex<Stage>,
    cancel: AtomicBool,
    closing: AtomicBool,
    marquee: AtomicBool,
    answer: Mutex<Option<Answer>>,
    answered: Condvar,
    kept: Mutex<Option<Kept>>,
    log_path: PathBuf,
    work: Mutex<Option<Work>>,
    worker: Mutex<Option<JoinHandle<i32>>>,
}

fn wide(text: &str) -> Vec<u16> {
    text.encode_utf16().chain(std::iter::once(0)).collect()
}

impl Shared {
    fn hwnd(&self) -> HWND {
        HWND(self.window.load(Ordering::SeqCst) as *mut c_void)
    }

    fn send(&self, message: TASKDIALOG_MESSAGES, wparam: usize, lparam: isize) {
        let window = self.hwnd();
        if !window.0.is_null() {
            unsafe { SendMessageW(window, message.0 as u32, Some(WPARAM(wparam)), Some(LPARAM(lparam))) };
        }
    }

    /// The dialog's one line. `relayout` when the dialog may have to grow for it.
    fn say(&self, text: &str, relayout: bool) {
        let text = wide(text);
        let message = if relayout {
            TDM_SET_ELEMENT_TEXT
        } else {
            TDM_UPDATE_ELEMENT_TEXT
        };
        self.send(message, TDE_CONTENT.0 as usize, text.as_ptr() as isize);
    }

    fn give(&self, answer: Answer) {
        if let Ok(mut held) = self.answer.lock() {
            *held = Some(answer);
            self.answered.notify_all();
        }
    }

    /// A button was pressed. `S_FALSE` keeps the dialog open.
    fn pressed(&self, button: i32) -> HRESULT {
        if self.closing.load(Ordering::SeqCst) {
            return S_OK;
        }
        let page = self.page.lock().map(|page| *page).unwrap_or(Page::Progress);
        match (page, button) {
            (Page::Progress, _) => {
                // The run ends itself at its next look; the dialog stays until it has.
                if !self.cancel.swap(true, Ordering::SeqCst) {
                    self.send(TDM_ENABLE_BUTTON, IDCANCEL.0 as usize, 0);
                    self.say("Cancelling…", true);
                }
                S_FALSE
            }
            (Page::Stopped(_), TRY_AGAIN) => {
                self.give(Answer::TryAgain);
                S_FALSE
            }
            (Page::Stopped(_), SHOW_LOG) => {
                let log = HSTRING::from(self.log_path.as_os_str());
                unsafe {
                    ShellExecuteW(
                        Some(self.hwnd()),
                        w!("open"),
                        &log,
                        PCWSTR::null(),
                        PCWSTR::null(),
                        SW_SHOWNORMAL,
                    )
                };
                S_FALSE
            }
            (Page::Stopped(_), _) => {
                self.give(Answer::Close);
                S_OK
            }
        }
    }
}

/// A page's configuration, and what its pointers lead to.
fn page_config(shared: &Shared, page: Page) -> (TASKDIALOGCONFIG, Kept) {
    let title = wide(TITLE);
    let (line, flags, common, labels, default) = match page {
        Page::Progress => (
            Stage::Checking.words(None),
            TDF_SHOW_PROGRESS_BAR.0 | TDF_ALLOW_DIALOG_CANCELLATION.0,
            TDCBF_CANCEL_BUTTON,
            Vec::new(),
            IDCANCEL.0,
        ),
        Page::Stopped(failure) => {
            let mut labels = vec![(SHOW_LOG, wide("Show log"))];
            if failure.worth_another_try() {
                labels.insert(0, (TRY_AGAIN, wide("Try again")));
            }
            let default = if failure.worth_another_try() {
                TRY_AGAIN
            } else {
                IDCLOSE.0
            };
            (
                failure.sentence().to_string(),
                TDF_ALLOW_DIALOG_CANCELLATION.0,
                TDCBF_CLOSE_BUTTON,
                labels,
                default,
            )
        }
    };
    let line = wide(&line);
    let buttons: Vec<TASKDIALOG_BUTTON> = labels
        .iter()
        .map(|(id, label)| TASKDIALOG_BUTTON {
            nButtonID: *id,
            pszButtonText: PCWSTR(label.as_ptr()),
        })
        .collect();

    let mut config = TASKDIALOGCONFIG {
        cbSize: size_of::<TASKDIALOGCONFIG>() as u32,
        dwFlags: TASKDIALOG_FLAGS(flags),
        dwCommonButtons: TASKDIALOG_COMMON_BUTTON_FLAGS(common.0),
        pszWindowTitle: PCWSTR(title.as_ptr()),
        pszContent: PCWSTR(line.as_ptr()),
        cButtons: buttons.len() as u32,
        pButtons: if buttons.is_empty() {
            std::ptr::null()
        } else {
            buttons.as_ptr()
        },
        nDefaultButton: default,
        pfCallback: Some(on_event),
        lpCallbackData: std::ptr::from_ref(shared) as isize,
        cxWidth: WIDTH,
        ..Default::default()
    };
    if matches!(page, Page::Stopped(_)) {
        config.Anonymous1 = TASKDIALOGCONFIG_0 {
            pszMainIcon: TD_WARNING_ICON,
        };
    }
    let mut text: Vec<Vec<u16>> = labels.into_iter().map(|(_, label)| label).collect();
    text.push(title);
    text.push(line);
    (
        config,
        Kept {
            _text: text,
            _buttons: buttons,
        },
    )
}

unsafe extern "system" fn on_event(
    window: HWND,
    event: TASKDIALOG_NOTIFICATIONS,
    wparam: WPARAM,
    _lparam: LPARAM,
    data: isize,
) -> HRESULT {
    let pointer = data as *const Shared;
    // The dialog's creator holds the value for as long as the dialog lives.
    let shared = unsafe { &*pointer };
    match event {
        TDN_CREATED => {
            shared.window.store(window.0 as isize, Ordering::SeqCst);
            let work = shared.work.lock().ok().and_then(|mut work| work.take());
            if let Some(work) = work {
                let for_worker = unsafe {
                    Arc::increment_strong_count(pointer);
                    Arc::from_raw(pointer)
                };
                let worker = thread::spawn(move || work(&Window { shared: for_worker }));
                if let Ok(mut held) = shared.worker.lock() {
                    *held = Some(worker);
                }
            }
            S_OK
        }
        TDN_BUTTON_CLICKED => shared.pressed(wparam.0 as i32),
        _ => S_OK,
    }
}

/// The dialog, as the install's thread sees it.
pub struct Window {
    shared: Arc<Shared>,
}

impl Window {
    fn show(&self, page: Page) {
        if let Ok(mut current) = self.shared.page.lock() {
            *current = page;
        }
        let (config, kept) = page_config(&self.shared, page);
        self.shared.send(TDM_NAVIGATE_PAGE, 0, (&raw const config) as isize);
        if let Ok(mut held) = self.shared.kept.lock() {
            *held = Some(kept);
        }
    }

    /// Shows why the run stopped and waits for the person's answer. On
    /// "Try again" the dialog is back on its bar when this returns.
    pub fn stopped(&self, failure: Failure) -> Answer {
        if self.shared.hwnd().0.is_null() {
            return Answer::Close;
        }
        if let Ok(mut held) = self.shared.answer.lock() {
            *held = None;
        }
        self.show(Page::Stopped(failure));
        let answer = match self.shared.answer.lock() {
            Ok(mut held) => loop {
                if let Some(answer) = held.take() {
                    break answer;
                }
                held = match self.shared.answered.wait(held) {
                    Ok(held) => held,
                    Err(_) => break Answer::Close,
                };
            },
            Err(_) => Answer::Close,
        };
        if answer == Answer::TryAgain {
            self.shared.marquee.store(false, Ordering::SeqCst);
            self.show(Page::Progress);
        }
        answer
    }

    /// Takes the dialog down: the run is over and there is nothing left to say.
    pub fn close(&self) {
        self.shared.closing.store(true, Ordering::SeqCst);
        self.shared.send(TDM_ENABLE_BUTTON, IDCANCEL.0 as usize, 1);
        self.shared.send(TDM_CLICK_BUTTON, IDCANCEL.0 as usize, 0);
    }
}

impl Watcher for Window {
    fn stage(&self, stage: Stage) {
        if let Ok(mut current) = self.shared.stage.lock() {
            *current = stage;
        }
        if self.shared.cancel.load(Ordering::SeqCst) {
            return;
        }
        self.shared.say(&stage.words(None), true);
        self.shared.send(
            TDM_ENABLE_BUTTON,
            IDCANCEL.0 as usize,
            isize::from(stage.takes_cancel()),
        );
    }

    fn percent(&self, percent: Option<u32>) {
        let shared = &self.shared;
        match percent {
            Some(percent) => {
                if shared.marquee.swap(false, Ordering::SeqCst) {
                    shared.send(TDM_SET_PROGRESS_BAR_MARQUEE, 0, 0);
                    shared.send(TDM_SET_MARQUEE_PROGRESS_BAR, 0, 0);
                }
                shared.send(TDM_SET_PROGRESS_BAR_POS, percent as usize, 0);
                if !shared.cancel.load(Ordering::SeqCst) {
                    let stage = shared.stage.lock().map(|stage| *stage).unwrap_or(Stage::Checking);
                    shared.say(&stage.words(Some(percent)), false);
                }
            }
            None => {
                if !shared.marquee.swap(true, Ordering::SeqCst) {
                    shared.send(TDM_SET_MARQUEE_PROGRESS_BAR, 1, 0);
                    shared.send(TDM_SET_PROGRESS_BAR_MARQUEE, 1, 0);
                }
            }
        }
    }

    fn cancelled(&self) -> bool {
        self.shared.cancel.load(Ordering::SeqCst)
    }
}

/// Shows the dialog and runs `work` beside it; returns what `work`
/// returned once the dialog is gone. Where Windows cannot show the
/// dialog, `work` still runs, with a window that shows nothing.
pub fn run(log_path: &Path, work: impl FnOnce(&Window) -> i32 + Send + 'static) -> i32 {
    let shared = Arc::new(Shared {
        window: AtomicIsize::new(0),
        page: Mutex::new(Page::Progress),
        stage: Mutex::new(Stage::Checking),
        cancel: AtomicBool::new(false),
        closing: AtomicBool::new(false),
        marquee: AtomicBool::new(false),
        answer: Mutex::new(None),
        answered: Condvar::new(),
        kept: Mutex::new(None),
        log_path: log_path.to_path_buf(),
        work: Mutex::new(Some(Box::new(work))),
        worker: Mutex::new(None),
    });
    let (config, kept) = page_config(&shared, Page::Progress);
    let _ = unsafe { TaskDialogIndirect(&raw const config, None, None, None) };
    drop(kept);
    shared.window.store(0, Ordering::SeqCst);

    let worker = shared.worker.lock().ok().and_then(|mut worker| worker.take());
    match worker {
        Some(worker) => worker.join().unwrap_or(Failure::Unexpected.exit_code()),
        None => {
            let work = shared.work.lock().ok().and_then(|mut work| work.take());
            match work {
                Some(work) => work(&Window { shared: shared.clone() }),
                None => Failure::Unexpected.exit_code(),
            }
        }
    }
}
