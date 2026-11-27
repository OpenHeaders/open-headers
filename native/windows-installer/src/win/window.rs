//! The window a person watches: the app's mark and name, one line, a
//! thin bar. It has no title bar and no button, and is moved by its
//! body; Esc, or closing it from the taskbar, cancels the run for as
//! long as a cancel is taken.
//!
//! The window owns the thread that shows it. The install runs on a
//! thread of its own and tells the window what to show by posting it
//! messages; when a run stops, the window's thread asks the person
//! (`dialog`) and hands the answer back.

use core::ffi::c_void;
use std::cell::{Cell, RefCell};
use std::panic::{AssertUnwindSafe, catch_unwind};
use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicBool, AtomicIsize, Ordering};
use std::sync::{Arc, Condvar, Mutex};
use std::thread;

use windows::Win32::Foundation::{HINSTANCE, HWND, LPARAM, LRESULT, POINT, RECT, WPARAM};
use windows::Win32::Graphics::Dwm::{DWMWA_WINDOW_CORNER_PREFERENCE, DWMWCP_ROUND, DwmSetWindowAttribute};
use windows::Win32::Graphics::Gdi::{
    BeginPaint, EndPaint, GetMonitorInfoW, InvalidateRect, MONITOR_DEFAULTTOPRIMARY, MONITORINFO, MonitorFromPoint,
    PAINTSTRUCT,
};
use windows::Win32::System::LibraryLoader::GetModuleHandleW;
use windows::Win32::UI::HiDpi::GetDpiForWindow;
use windows::Win32::UI::Input::KeyboardAndMouse::VK_ESCAPE;
use windows::Win32::UI::WindowsAndMessaging::{
    CREATESTRUCTW, CreateWindowExW, DefWindowProcW, DestroyWindow, DispatchMessageW, GWLP_USERDATA, GetCursorPos,
    GetMessageW, GetSystemMetrics, GetWindowLongPtrW, HICON, HTCAPTION, IDC_ARROW, IMAGE_ICON, KillTimer,
    LR_DEFAULTCOLOR, LoadCursorW, LoadImageW, MSG, PostMessageW, PostQuitMessage, RegisterClassExW, SM_CXICON,
    SM_CXSMICON, SM_CYICON, SM_CYSMICON, SW_SHOWNORMAL, SWP_NOACTIVATE, SWP_NOZORDER, SYSTEM_METRICS_INDEX,
    SetForegroundWindow, SetTimer, SetWindowLongPtrW, SetWindowPos, ShowWindow, TranslateMessage, WM_APP, WM_CLOSE,
    WM_DESTROY, WM_DPICHANGED, WM_ERASEBKGND, WM_KEYDOWN, WM_NCCREATE, WM_NCHITTEST, WM_PAINT, WM_SETTINGCHANGE,
    WM_SYSCOLORCHANGE, WM_THEMECHANGED, WM_TIMER, WNDCLASSEXW, WS_EX_APPWINDOW, WS_MINIMIZEBOX, WS_POPUP, WS_SYSMENU,
};
use windows::core::{HSTRING, PCWSTR, w};

use super::dialog::{self, Answer};
use super::paint::{self, Look, Painter, Palette};
use crate::flow::{Progress, Stage, Watcher};
use crate::outcome::Failure;
use crate::view::{self, Bar, Layout, Shown};

const CLASS: PCWSTR = w!("OpenHeadersInstaller");
/// The program's icon among its resources (`PROGRAM_ICON_ID` in `build.rs`).
const ICON_ID: usize = 1;

/// The run's state changed: draw it.
const WM_REFRESH: u32 = WM_APP + 1;
/// The run stopped: ask the person.
const WM_STOPPED: u32 = WM_APP + 2;
/// The run is over: the window goes.
const WM_DONE: u32 = WM_APP + 3;

const RUNNER_TIMER: usize = 1;
const RUNNER_TICK_MS: u32 = 30;

#[derive(Clone, Copy)]
struct Seen {
    stage: Stage,
    progress: Progress,
}

const AT_THE_START: Seen = Seen {
    stage: Stage::Checking,
    progress: Progress::Unknown,
};

/// What the window's thread and the install's thread both hold.
struct Shared {
    /// The window's handle; 0 before it is up and after it is gone.
    window: AtomicIsize,
    seen: Mutex<Seen>,
    cancel: AtomicBool,
    /// A stop the person has not been asked about yet.
    stopped: Mutex<Option<Failure>>,
    answer: Mutex<Option<Answer>>,
    answered: Condvar,
    log_path: PathBuf,
}

impl Shared {
    fn hwnd(&self) -> HWND {
        HWND(self.window.load(Ordering::SeqCst) as *mut c_void)
    }

    fn post(&self, message: u32) {
        let window = self.hwnd();
        if !window.0.is_null() {
            let _ = unsafe { PostMessageW(Some(window), message, WPARAM(0), LPARAM(0)) };
        }
    }

    fn shown(&self) -> Shown {
        let seen = self.seen.lock().map(|seen| *seen).unwrap_or(AT_THE_START);
        view::shown(seen.stage, seen.progress, self.cancel.load(Ordering::SeqCst))
    }

    fn see(&self, change: impl FnOnce(&mut Seen)) {
        if let Ok(mut seen) = self.seen.lock() {
            change(&mut seen);
        }
        self.post(WM_REFRESH);
    }

    fn give(&self, answer: Answer) {
        if let Ok(mut held) = self.answer.lock() {
            *held = Some(answer);
            self.answered.notify_all();
        }
    }
}

/// What the window's own thread alone touches. A message can arrive
/// while another is being answered, so every part changes in place.
struct Face {
    shared: Arc<Shared>,
    painter: RefCell<Painter>,
    layout: Cell<Layout>,
    palette: Cell<Palette>,
    /// Windows gives the window no edge of its own.
    framed: Cell<bool>,
    tick: Cell<u32>,
    /// The timer that moves the bar's running piece is on.
    running: Cell<bool>,
}

fn redraw(window: HWND) {
    let _ = unsafe { InvalidateRect(Some(window), None, false) };
}

impl Face {
    fn rescale(&self, dpi: u32) {
        self.layout.set(view::layout(dpi));
        self.painter.borrow_mut().rescale(dpi);
    }

    /// The bar's running piece moves only while the bar shows one.
    fn keep_time(&self, window: HWND, wanted: bool) {
        if wanted == self.running.replace(wanted) {
            return;
        }
        unsafe {
            if wanted {
                SetTimer(Some(window), RUNNER_TIMER, RUNNER_TICK_MS, None);
            } else {
                let _ = KillTimer(Some(window), RUNNER_TIMER);
            }
        }
    }

    fn refresh(&self, window: HWND) {
        self.keep_time(window, self.shared.shown().bar == Bar::Running);
        redraw(window);
    }

    /// The person asks the run to end. Not taken once Windows has the package.
    fn ask_to_cancel(&self, window: HWND) {
        if self.shared.shown().takes_cancel {
            self.shared.cancel.store(true, Ordering::SeqCst);
            self.refresh(window);
        }
    }

    fn paint(&self, window: HWND) {
        let mut paint = PAINTSTRUCT::default();
        let target = unsafe { BeginPaint(window, &raw mut paint) };
        let look = Look {
            palette: self.palette.get(),
            tick: self.tick.get(),
            framed: self.framed.get(),
        };
        self.painter
            .borrow()
            .draw(target, &self.layout.get(), &self.shared.shown(), look);
        let _ = unsafe { EndPaint(window, &raw const paint) };
    }

    /// The run stopped: the person is asked in front of the window, and the run gets the answer.
    fn ask(&self, window: HWND) {
        let failure = self.shared.stopped.lock().ok().and_then(|mut stopped| stopped.take());
        let Some(failure) = failure else { return };
        self.keep_time(window, false);
        let answer = dialog::ask(window, failure, &self.shared.log_path);
        if answer == Answer::TryAgain {
            self.shared.cancel.store(false, Ordering::SeqCst);
            if let Ok(mut seen) = self.shared.seen.lock() {
                *seen = AT_THE_START;
            }
            self.refresh(window);
        }
        self.shared.give(answer);
    }

    /// Answers a message; `None` leaves it to Windows.
    fn answer(&self, window: HWND, message: u32, wparam: WPARAM, lparam: LPARAM) -> Option<isize> {
        match message {
            WM_ERASEBKGND => Some(1),
            WM_PAINT => {
                self.paint(window);
                Some(0)
            }
            // The window is moved by its body, all of it.
            WM_NCHITTEST => Some(HTCAPTION as isize),
            WM_KEYDOWN if wparam.0 == usize::from(VK_ESCAPE.0) => {
                self.ask_to_cancel(window);
                Some(0)
            }
            // Closed from the taskbar or the keyboard: a cancel like any other. The window goes when the run has ended.
            WM_CLOSE => {
                self.ask_to_cancel(window);
                Some(0)
            }
            WM_TIMER => {
                self.tick.set(self.tick.get().wrapping_add(1));
                redraw(window);
                Some(0)
            }
            WM_REFRESH => {
                self.refresh(window);
                Some(0)
            }
            WM_STOPPED => {
                self.ask(window);
                Some(0)
            }
            WM_DONE => {
                let _ = unsafe { DestroyWindow(window) };
                Some(0)
            }
            WM_DESTROY => {
                self.keep_time(window, false);
                unsafe { PostQuitMessage(0) };
                Some(0)
            }
            // Moved to a screen of another scaling: Windows says where the window goes, the layout how large it is.
            WM_DPICHANGED => {
                self.rescale((wparam.0 & 0xFFFF) as u32);
                let layout = self.layout.get();
                let place = unsafe { *(lparam.0 as *const RECT) };
                let _ = unsafe {
                    SetWindowPos(
                        window,
                        None,
                        place.left,
                        place.top,
                        layout.width,
                        layout.height,
                        SWP_NOZORDER | SWP_NOACTIVATE,
                    )
                };
                redraw(window);
                Some(0)
            }
            WM_SETTINGCHANGE | WM_SYSCOLORCHANGE | WM_THEMECHANGED => {
                self.palette.set(paint::palette());
                redraw(window);
                None
            }
            _ => None,
        }
    }
}

unsafe extern "system" fn on_message(window: HWND, message: u32, wparam: WPARAM, lparam: LPARAM) -> LRESULT {
    if message == WM_NCCREATE {
        let create = lparam.0 as *const CREATESTRUCTW;
        unsafe { SetWindowLongPtrW(window, GWLP_USERDATA, (*create).lpCreateParams as isize) };
    }
    let face = unsafe { GetWindowLongPtrW(window, GWLP_USERDATA) } as *const Face;
    // `run` holds the value for as long as the window lives.
    let answered = unsafe { face.as_ref() }.and_then(|face| face.answer(window, message, wparam, lparam));
    match answered {
        Some(result) => LRESULT(result),
        None => unsafe { DefWindowProcW(window, message, wparam, lparam) },
    }
}

fn program_icon(instance: HINSTANCE, width: SYSTEM_METRICS_INDEX, height: SYSTEM_METRICS_INDEX) -> HICON {
    let loaded = unsafe {
        LoadImageW(
            Some(instance),
            PCWSTR(ICON_ID as *const u16),
            IMAGE_ICON,
            GetSystemMetrics(width),
            GetSystemMetrics(height),
            LR_DEFAULTCOLOR,
        )
    };
    loaded.map(|icon| HICON(icon.0)).unwrap_or_default()
}

/// Makes the window, in the middle of the screen the pointer is on, not yet shown.
fn create(face: &Face) -> Option<HWND> {
    let instance: HINSTANCE = unsafe { GetModuleHandleW(None) }.ok()?.into();
    let class = WNDCLASSEXW {
        cbSize: size_of::<WNDCLASSEXW>() as u32,
        lpfnWndProc: Some(on_message),
        hInstance: instance,
        hIcon: program_icon(instance, SM_CXICON, SM_CYICON),
        hIconSm: program_icon(instance, SM_CXSMICON, SM_CYSMICON),
        hCursor: unsafe { LoadCursorW(None, IDC_ARROW) }.unwrap_or_default(),
        lpszClassName: CLASS,
        ..Default::default()
    };
    if unsafe { RegisterClassExW(&raw const class) } == 0 {
        return None;
    }

    let mut pointer = POINT::default();
    let _ = unsafe { GetCursorPos(&raw mut pointer) };
    let mut screen = MONITORINFO {
        cbSize: size_of::<MONITORINFO>() as u32,
        ..Default::default()
    };
    if !unsafe { GetMonitorInfoW(MonitorFromPoint(pointer, MONITOR_DEFAULTTOPRIMARY), &raw mut screen) }.as_bool() {
        return None;
    }
    let room = screen.rcWork;

    // Made with no size on that screen, so Windows can say the screen's scaling before anything is laid out.
    let window = unsafe {
        CreateWindowExW(
            WS_EX_APPWINDOW,
            CLASS,
            &HSTRING::from(dialog::TITLE),
            WS_POPUP | WS_SYSMENU | WS_MINIMIZEBOX,
            room.left,
            room.top,
            0,
            0,
            None,
            None,
            Some(instance),
            Some(std::ptr::from_ref(face).cast::<c_void>()),
        )
    }
    .ok()?;
    face.rescale(unsafe { GetDpiForWindow(window) });
    let layout = face.layout.get();
    let _ = unsafe {
        SetWindowPos(
            window,
            None,
            room.left + (room.right - room.left - layout.width) / 2,
            room.top + (room.bottom - room.top - layout.height) / 2,
            layout.width,
            layout.height,
            SWP_NOZORDER | SWP_NOACTIVATE,
        )
    };

    // Windows 11 rounds the corners and draws the edge; a Windows that does not gets a drawn edge.
    let round = DWMWCP_ROUND;
    let rounded = unsafe {
        DwmSetWindowAttribute(
            window,
            DWMWA_WINDOW_CORNER_PREFERENCE,
            (&raw const round).cast::<c_void>(),
            size_of_val(&round) as u32,
        )
    };
    face.framed.set(rounded.is_err());
    Some(window)
}

/// The window, as the install's thread sees it.
pub struct Window {
    shared: Arc<Shared>,
}

impl Window {
    /// Has the person asked why the run stopped and waits for the answer.
    /// On "Try again" the window is back at its start when this returns.
    pub fn stopped(&self, failure: Failure) -> Answer {
        if self.shared.hwnd().0.is_null() {
            return Answer::Close;
        }
        if let Ok(mut held) = self.shared.answer.lock() {
            *held = None;
        }
        if let Ok(mut stopped) = self.shared.stopped.lock() {
            *stopped = Some(failure);
        }
        self.shared.post(WM_STOPPED);
        match self.shared.answer.lock() {
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
        }
    }
}

impl Watcher for Window {
    fn stage(&self, stage: Stage) {
        // A stage starts with nothing counted.
        self.shared.see(|seen| {
            *seen = Seen {
                stage,
                progress: Progress::Unknown,
            }
        });
    }

    fn progress(&self, progress: Progress) {
        self.shared.see(|seen| seen.progress = progress);
    }

    fn cancelled(&self) -> bool {
        self.shared.cancel.load(Ordering::SeqCst)
    }
}

/// Shows the window and runs `work` beside it; the window goes when
/// `work` has returned, and this returns what `work` returned. Where
/// Windows cannot show the window, `work` still runs, watched by nobody.
pub fn run(log_path: &Path, work: impl FnOnce(&Window) -> i32 + Send + 'static) -> i32 {
    let shared = Arc::new(Shared {
        window: AtomicIsize::new(0),
        seen: Mutex::new(AT_THE_START),
        cancel: AtomicBool::new(false),
        stopped: Mutex::new(None),
        answer: Mutex::new(None),
        answered: Condvar::new(),
        log_path: log_path.to_path_buf(),
    });
    let face = Box::new(Face {
        shared: shared.clone(),
        painter: RefCell::new(Painter::new()),
        layout: Cell::new(view::layout(view::BASE_DPI)),
        palette: Cell::new(paint::palette()),
        framed: Cell::new(false),
        tick: Cell::new(0),
        running: Cell::new(false),
    });
    let Some(window) = create(&face) else {
        return work(&Window { shared });
    };
    shared.window.store(window.0 as isize, Ordering::SeqCst);
    unsafe {
        let _ = ShowWindow(window, SW_SHOWNORMAL);
        let _ = SetForegroundWindow(window);
    }
    face.refresh(window);

    let watched = Window { shared: shared.clone() };
    let worker = thread::spawn(move || {
        let code = catch_unwind(AssertUnwindSafe(|| work(&watched))).unwrap_or(Failure::Unexpected.exit_code());
        // However the run ended, the window does not outlive it.
        watched.shared.post(WM_DONE);
        code
    });

    let mut message = MSG::default();
    while unsafe { GetMessageW(&raw mut message, None, 0, 0) }.0 > 0 {
        unsafe {
            let _ = TranslateMessage(&raw const message);
            DispatchMessageW(&raw const message);
        }
    }
    shared.window.store(0, Ordering::SeqCst);
    drop(face);
    worker.join().unwrap_or(Failure::Unexpected.exit_code())
}
