//! The installer on Windows: what the run asks of the PC, and the two
//! ways it runs — beside its window, or silently.

mod checks;
mod dialog;
mod hash;
mod http;
mod package;
mod paint;
mod trust;
mod window;

use std::panic::{AssertUnwindSafe, catch_unwind};
use std::path::{Path, PathBuf};
use std::sync::Arc;
use std::time::Duration;

use windows::Win32::System::Com::{COINIT_APARTMENTTHREADED, COINIT_MULTITHREADED, CoInitializeEx};

use crate::RELEASE_VERSION;
use crate::args::{self, Args};
use crate::cleanup;
use crate::feed::Channel;
use crate::flow::{self, Carry, Done, Plan, Signer, System, Unfit, Unwatched, Watcher};
use crate::log::{LOG_FILE_NAME, Log};
use crate::outcome::{EXIT_INSTALLED, Failure, Stop};
use crate::pointer::Arch;
use crate::transfer::Transport;

/// The folder under the user's temp folder a download is kept in while the run lasts.
const DOWNLOAD_DIR_NAME: &str = "OpenHeaders-Installer";

fn download_dir() -> PathBuf {
    std::env::temp_dir().join(DOWNLOAD_DIR_NAME)
}

struct Pc {
    http: http::WinHttp,
}

impl System for Pc {
    fn fitness(&self) -> Result<(), Unfit> {
        checks::fitness()
    }
    fn arch(&self) -> Option<Arch> {
        checks::arch()
    }
    fn installed_version(&self) -> Result<Option<String>, String> {
        package::installed_version()
    }
    fn transport(&self) -> &dyn Transport {
        &self.http
    }
    fn pause(&self, milliseconds: u64) {
        std::thread::sleep(Duration::from_millis(milliseconds));
    }
    fn download_dir(&self) -> PathBuf {
        download_dir()
    }
    fn sha256_hex(&self, file: &Path) -> Result<String, String> {
        hash::sha256_hex(file)
    }
    fn own_signer(&self) -> Result<Option<Signer>, String> {
        let own = std::env::current_exe().map_err(|error| format!("cannot name the installer's own file: {error}"))?;
        trust::signer_of(&own)
    }
    fn package_signer(&self, file: &Path) -> Result<Signer, String> {
        trust::signer_of(file)?.ok_or_else(|| "the package carries no signature".to_string())
    }
    fn install(&self, file: &Path, on_percent: &mut dyn FnMut(u32)) -> Result<(), String> {
        package::install(file, on_percent)
    }
    fn open_app(&self) -> Result<(), String> {
        package::open_app()
    }
}

/// One run of the install, on the calling thread. A panic is a run that
/// stopped, never a window left with nothing behind it.
fn attempt(plan: &Plan, watcher: &dyn Watcher, log: &Log, carry: &mut Carry) -> Result<Done, Stop> {
    let result = catch_unwind(AssertUnwindSafe(|| {
        let http = http::WinHttp::open(&format!("OpenHeaders-Installer/{RELEASE_VERSION}"))
            .map_err(|error| Stop::new(Failure::Unexpected, error))?;
        flow::run(plan, &Pc { http }, watcher, log, carry)
    }))
    .unwrap_or_else(|_| Err(Stop::new(Failure::Unexpected, "the run panicked")));
    match &result {
        Ok(done) => log.line(&format!("done: {done:?}")),
        Err(stop) => log.line(&format!("stopped: {:?} — {}", stop.failure, stop.detail)),
    }
    result
}

fn exit_code_of(result: &Result<Done, Stop>) -> i32 {
    match result {
        Ok(_) => EXIT_INSTALLED,
        Err(stop) => stop.failure.exit_code(),
    }
}

fn plan_of(args: &Args) -> Plan {
    Plan {
        channel: args.channel.unwrap_or(Channel::of_release(RELEASE_VERSION)),
        package: args.package.clone(),
        open_app: !args.no_launch,
    }
}

fn watched(plan: Plan, log: Arc<Log>) -> i32 {
    // The window's thread opens the log from the stop dialog's button: the shell wants a single-threaded apartment there.
    let _ = unsafe { CoInitializeEx(None, COINIT_APARTMENTTHREADED) };
    let log_path = log.path().to_path_buf();
    window::run(&log_path, move |window| {
        let _ = unsafe { CoInitializeEx(None, COINIT_MULTITHREADED) };
        let mut carry = Carry::default();
        loop {
            let result = attempt(&plan, window, &log, &mut carry);
            match &result {
                Err(stop)
                    if stop.failure != Failure::Cancelled
                        && window.stopped(stop.failure) == dialog::Answer::TryAgain =>
                {
                    log.line("trying again");
                }
                _ => return exit_code_of(&result),
            }
        }
    })
}

pub fn run() -> i32 {
    let parsed = args::parse(std::env::args().skip(1));
    let log_path = match &parsed {
        Ok(Args { log: Some(path), .. }) => path.clone(),
        _ => std::env::temp_dir().join(LOG_FILE_NAME),
    };
    let log = Arc::new(Log::create(&log_path));
    log.line(&format!(
        "OpenHeaders-Installer {RELEASE_VERSION} ({})",
        std::env::consts::ARCH
    ));
    let args = match parsed {
        Ok(args) => args,
        Err(why) => {
            log.line(&format!("stopped: {:?} — {why}", Failure::BadSwitches));
            return Failure::BadSwitches.exit_code();
        }
    };
    let plan = plan_of(&args);
    log.line(&format!(
        "channel {}, {}, {}, {}",
        plan.channel.name(),
        if args.silent { "silent" } else { "with its window" },
        match &plan.package {
            Some(file) => format!("from the file {}", file.display()),
            None => "from the feed".to_string(),
        },
        if plan.open_app {
            "opens the app"
        } else {
            "does not open the app"
        },
    ));

    let code = if args.silent {
        let _ = unsafe { CoInitializeEx(None, COINIT_MULTITHREADED) };
        exit_code_of(&attempt(&plan, &Unwatched, &log, &mut Carry::default()))
    } else {
        watched(plan, log.clone())
    };
    cleanup::remove_download_dir(
        &download_dir(),
        cleanup::TRIES,
        &|milliseconds| std::thread::sleep(Duration::from_millis(milliseconds)),
        &|text| log.line(text),
    );
    log.line(&format!("exit code {code}"));
    code
}
