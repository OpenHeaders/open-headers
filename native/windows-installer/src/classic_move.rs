//! A move: the package takes a classic install's place.
//!
//! The classic app starts this installer from a copy outside its install
//! folder, naming its own program, its process, its uninstaller and the
//! place of its request note, over a pipe. The installer puts the package
//! on the PC as any run does and asks it whether it starts; says
//! [`READY_WORD`]; the app writes the note, answers [`GO_WORD`] and quits
//! through its own lifecycle; the installer waits for that process, runs
//! the classic uninstaller in its move mode and reads how it ended. Gone:
//! the package is started to take the data in. Refused: the note and the
//! package are taken away again and the classic app is started. A move
//! that stops is said on the pipe too ([`STOPPED_WORD`]), for an app that
//! still runs.
//!
//! It is the installer that reads the uninstaller's answer because no
//! process of the classic install is alive when its uninstaller ends.
//!
//! Three things hold on every path. Only a package this run installed is
//! removed. The data folder is not touched, but for the note of a move
//! that is given up. Nothing of the app's is closed: it quits by itself,
//! and is waited for.

use std::path::{Path, PathBuf};

use crate::flow::{self, Carry, Done, Plan, Progress, Stage, System, Watcher};
use crate::log::Log;
use crate::outcome::{Failure, Stop};

/// What the installer says on the pipe once the package passed its check.
pub const READY_WORD: &str = "ready";
/// What the app answers once its request note is written, before it quits.
pub const GO_WORD: &str = "go";
/// What the installer says, with its exit code, when a move stops.
pub const STOPPED_WORD: &str = "stopped";

/// The package's app, as a program outside the package starts it, and the
/// two switches a move starts it with. All three are the package's own and
/// permanent (`apps/desktop/src/main/bootstrap/package-aliases.ts`,
/// `package-start-check.ts`, `data-folder-move.ts`).
pub const PACKAGE_APP_ALIAS: &str = "openheaders.exe";
pub const CHECK_PACKAGE_START_SWITCH: &str = "--check-package-start";
pub const FINISH_MOVE_SWITCH: &str = "--finish-move-to-package";

/// The check ends itself after half of this.
const CHECK_WAIT_MS: u64 = 60_000;
const WORD_WAIT_MS: u64 = 30_000;
/// The app forces its own exit 22 seconds after it began to quit.
const APP_WAIT_MS: u64 = 45_000;

/// The classic install a move takes the place of, as its app names it.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct ClassicInstall {
    /// The app's program, started again when the move is put back.
    pub app: PathBuf,
    /// The running app's process.
    pub app_pid: u32,
    /// The uninstaller, in the install folder.
    pub uninstaller: PathBuf,
    /// The request note the app writes into its data folder.
    pub note: PathBuf,
}

/// Where Windows keeps this user's alias of the package's app.
pub fn package_app_alias(local_app_data: &Path) -> PathBuf {
    local_app_data
        .join("Microsoft")
        .join("WindowsApps")
        .join(PACKAGE_APP_ALIAS)
}

/// What the uninstaller is started with, as the builder's own installer
/// starts an old one, and the move switch: silent, the data kept, update
/// mode. The install folder comes last and bare, spaces and all — the
/// uninstaller reads the rest of the line as the folder, and with it runs
/// in place and is waited for.
pub fn uninstaller_arguments(install_dir: &Path) -> String {
    format!(
        "/S /KEEP_APP_DATA /currentuser --updated --move-to-package _?={}",
        install_dir.display()
    )
}

/// Whether a line read from the pipe is the app's go.
pub fn is_go(line: &str) -> bool {
    line.trim() == GO_WORD
}

/// The line that tells the app a move stopped, and how the installer ends.
pub fn stopped_line(exit_code: i32) -> String {
    format!("{STOPPED_WORD} {exit_code}")
}

/// The classic install's side of a move.
pub trait Classic {
    fn say_ready(&self) -> Result<(), String>;
    /// Waits this long for the app's go; the error says what came instead.
    fn hear_go(&self, within_ms: u64) -> Result<(), String>;
    /// Whether the app's process ended within this long.
    fn app_gone(&self, within_ms: u64) -> bool;
    /// Runs the uninstaller in its move mode and waits for it: how it ended.
    fn uninstall(&self) -> Result<i32, String>;
    /// Takes the request note away. A note that was never written is no error.
    fn remove_note(&self) -> Result<(), String>;
    fn start_app(&self) -> Result<(), String>;
}

fn begin(watcher: &dyn Watcher, stage: Stage) {
    watcher.stage(stage);
    watcher.progress(Progress::Unknown);
}

/// Undoes a move that stops once Windows has the package: the note the
/// app may have written, when it was told, and the package.
fn put_back(system: &dyn System, told: Option<&dyn Classic>, watcher: &dyn Watcher, log: &Log) {
    begin(watcher, Stage::PuttingBack);
    if let Some(classic) = told {
        match classic.remove_note() {
            Ok(()) => log.line("the request note is gone"),
            Err(why) => log.line(&format!("the request note could not be removed: {why}")),
        }
    }
    match system.remove_package() {
        Ok(()) => log.line("the package was removed again"),
        Err(why) => log.line(&format!(
            "the package could not be removed and is left installed: {why}"
        )),
    }
}

pub fn run(
    plan: &Plan,
    system: &dyn System,
    classic: &dyn Classic,
    watcher: &dyn Watcher,
    log: &Log,
    carry: &mut Carry,
) -> Result<Done, Stop> {
    if let Some(version) = flow::survey(system, watcher)? {
        return Err(Stop::new(
            Failure::PackagePresent,
            format!("a package is installed already ({version}): a move removes only one it installed"),
        ));
    }
    flow::place(plan, system, watcher, log, carry)?;

    begin(watcher, Stage::CheckingPackage);
    let failed = match system.check_package_start(CHECK_WAIT_MS) {
        Ok(0) => None,
        Ok(code) => Some(format!("the package answered its start check with {code}")),
        Err(why) => Some(format!("the package's start check did not run: {why}")),
    };
    if let Some(detail) = failed {
        put_back(system, None, watcher, log);
        return Err(Stop::new(Failure::PackageCheck, detail));
    }
    log.line("the package answered its start check with 0");

    begin(watcher, Stage::ClosingApp);
    if let Err(why) = classic.say_ready().and_then(|()| classic.hear_go(WORD_WAIT_MS)) {
        put_back(system, Some(classic), watcher, log);
        return Err(Stop::new(Failure::AppStayed, format!("the app did not say go: {why}")));
    }
    log.line("the app said go");
    if !classic.app_gone(APP_WAIT_MS) {
        put_back(system, Some(classic), watcher, log);
        return Err(Stop::new(
            Failure::AppStayed,
            format!("the app's process was still there after {} s", APP_WAIT_MS / 1000),
        ));
    }
    log.line("the app's process ended");

    begin(watcher, Stage::RemovingClassic);
    let refused = match classic.uninstall() {
        Ok(0) => None,
        Ok(code) => Some(format!("the classic uninstaller ended with {code}")),
        Err(why) => Some(format!("the classic uninstaller did not run: {why}")),
    };
    if let Some(detail) = refused {
        put_back(system, Some(classic), watcher, log);
        match classic.start_app() {
            Ok(()) => log.line("the classic app was started again"),
            Err(why) => log.line(&format!("the classic app could not be started again: {why}")),
        }
        return Err(Stop::new(Failure::ClassicRemains, detail));
    }
    log.line("the classic install is gone");

    begin(watcher, Stage::Opening);
    system
        .finish_move()
        .map_err(|error| Stop::new(Failure::NotOpened, error))?;
    log.line("the package was started to take the data in");
    Ok(Done::Moved)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::flow::testing::{PACKAGE, Pc, Seen, plan};
    use crate::transfer::testing::{Answer, FakeHost};
    use std::cell::RefCell;

    /// The classic install's side, answering from what a test set. What
    /// is asked of it lands in the PC's own list, so one list holds the order.
    struct Side<'a> {
        calls: &'a RefCell<Vec<String>>,
        ready: Result<(), String>,
        go: Result<(), String>,
        gone: bool,
        uninstall: Result<i32, String>,
        note: Result<(), String>,
        start: Result<(), String>,
    }

    impl<'a> Side<'a> {
        fn of(pc: &'a Pc) -> Side<'a> {
            Side {
                calls: &pc.calls,
                ready: Ok(()),
                go: Ok(()),
                gone: true,
                uninstall: Ok(0),
                note: Ok(()),
                start: Ok(()),
            }
        }

        fn asked(&self, what: &str) {
            self.calls.borrow_mut().push(what.to_string());
        }
    }

    impl Classic for Side<'_> {
        fn say_ready(&self) -> Result<(), String> {
            self.asked("say ready");
            self.ready.clone()
        }
        fn hear_go(&self, _within_ms: u64) -> Result<(), String> {
            self.asked("hear go");
            self.go.clone()
        }
        fn app_gone(&self, _within_ms: u64) -> bool {
            self.asked("wait for the app");
            self.gone
        }
        fn uninstall(&self) -> Result<i32, String> {
            self.asked("uninstall");
            self.uninstall.clone()
        }
        fn remove_note(&self) -> Result<(), String> {
            self.asked("remove note");
            self.note.clone()
        }
        fn start_app(&self) -> Result<(), String> {
            self.asked("start app");
            self.start.clone()
        }
    }

    const INSTALLED: [&str; 4] = ["hash", "signer", "install", "check"];

    fn go(pc: &Pc, side: &Side, seen: &Seen) -> Result<Done, Stop> {
        let log = Log::create(&pc.dir.join("move.log"));
        run(&plan(), pc, side, seen, &log, &mut Carry::default())
    }

    fn calls_after_the_check(pc: &Pc) -> Vec<String> {
        let calls = pc.calls();
        assert_eq!(calls[..INSTALLED.len()], INSTALLED);
        calls[INSTALLED.len()..].to_vec()
    }

    #[test]
    fn a_move_installs_checks_tells_the_app_uninstalls_and_starts_the_package() {
        let pc = Pc::new("move");
        let seen = Seen::default();
        assert_eq!(go(&pc, &Side::of(&pc), &seen), Ok(Done::Moved));
        assert_eq!(
            calls_after_the_check(&pc),
            ["say ready", "hear go", "wait for the app", "uninstall", "finish"]
        );
        assert_eq!(
            *seen.stages.borrow(),
            [
                Stage::Checking,
                Stage::Downloading,
                Stage::Verifying,
                Stage::Installing,
                Stage::CheckingPackage,
                Stage::ClosingApp,
                Stage::RemovingClassic,
                Stage::Opening
            ]
        );
        assert_eq!(
            std::fs::read(pc.installed_from.borrow().clone().unwrap()).unwrap(),
            PACKAGE
        );
    }

    #[test]
    fn a_package_installed_already_is_never_a_moves_to_remove() {
        let mut pc = Pc::new("move-present");
        pc.installed = Some("2026.11.3.10".to_string());
        let stop = go(&pc, &Side::of(&pc), &Seen::default()).unwrap_err();
        assert_eq!(stop.failure, Failure::PackagePresent);
        assert!(pc.calls().is_empty() && pc.feed.pointer.asked.borrow().is_empty());
    }

    #[test]
    fn a_stop_before_windows_has_the_package_leaves_the_app_untold_and_puts_nothing_back() {
        let mut no_download = Pc::new("move-download");
        no_download.feed.package = FakeHost::new(
            PACKAGE,
            vec![Answer::Unreachable, Answer::Unreachable, Answer::Unreachable],
        );
        let stop = go(&no_download, &Side::of(&no_download), &Seen::default()).unwrap_err();
        assert_eq!(stop.failure, Failure::Download);
        assert!(no_download.calls().is_empty());

        let mut other_signer = Pc::new("move-signer");
        other_signer.package_signer = Ok(crate::flow::testing::signer("CN=John Doe"));
        let stop = go(&other_signer, &Side::of(&other_signer), &Seen::default()).unwrap_err();
        assert_eq!(stop.failure, Failure::Signature);
        assert_eq!(other_signer.calls(), ["hash", "signer"]);

        let mut refused = Pc::new("move-refused");
        refused.install = Err("0x80073CF3".to_string());
        let stop = go(&refused, &Side::of(&refused), &Seen::default()).unwrap_err();
        assert_eq!(stop.failure, Failure::WindowsRefused);
        assert_eq!(refused.calls(), ["hash", "signer", "install"]);
    }

    #[test]
    fn a_cancel_during_the_download_is_taken_as_in_any_run() {
        let pc = Pc::new("move-cancel");
        let seen = Seen::default();
        seen.cancel_at.set(Some(Stage::Downloading));
        assert_eq!(go(&pc, &Side::of(&pc), &seen).unwrap_err().failure, Failure::Cancelled);
        assert!(pc.calls().is_empty());
    }

    #[test]
    fn a_package_that_does_not_pass_its_check_is_removed_and_the_app_never_told() {
        for check in [Ok(4), Ok(5), Err("the alias did not start".to_string())] {
            let mut pc = Pc::new("move-check");
            pc.check = check;
            let seen = Seen::default();
            let stop = go(&pc, &Side::of(&pc), &seen).unwrap_err();
            assert_eq!(stop.failure, Failure::PackageCheck);
            assert_eq!(calls_after_the_check(&pc), ["remove package"]);
            assert_eq!(seen.stages.borrow().last(), Some(&Stage::PuttingBack));
        }
    }

    #[test]
    fn an_app_that_does_not_say_go_keeps_its_install_and_the_package_goes() {
        for (ready, word) in [
            (Ok(()), Err("it answered 'no'".to_string())),
            (Ok(()), Err("no word in 30 s".to_string())),
            (Err("the pipe is closed".to_string()), Ok(())),
        ] {
            let pc = Pc::new("move-no-go");
            let mut side = Side::of(&pc);
            let told = ready.is_ok();
            side.ready = ready;
            side.go = word;
            let stop = go(&pc, &side, &Seen::default()).unwrap_err();
            assert_eq!(stop.failure, Failure::AppStayed);
            let after = calls_after_the_check(&pc);
            let heard: &[&str] = if told {
                &["say ready", "hear go"]
            } else {
                &["say ready"]
            };
            assert_eq!(after[..heard.len()], *heard);
            // The app may have written its note before it fell silent.
            assert_eq!(after[heard.len()..], ["remove note", "remove package"]);
        }
    }

    #[test]
    fn an_app_that_does_not_quit_in_time_keeps_its_install_and_nothing_is_uninstalled() {
        let pc = Pc::new("move-stays");
        let mut side = Side::of(&pc);
        side.gone = false;
        let stop = go(&pc, &side, &Seen::default()).unwrap_err();
        assert_eq!(stop.failure, Failure::AppStayed);
        assert_eq!(
            calls_after_the_check(&pc),
            [
                "say ready",
                "hear go",
                "wait for the app",
                "remove note",
                "remove package"
            ]
        );
    }

    #[test]
    fn an_uninstaller_that_refuses_gets_the_note_and_the_package_removed_and_the_app_started_again() {
        for uninstall in [Ok(2), Ok(1), Err("the uninstaller is not there".to_string())] {
            let pc = Pc::new("move-refusal");
            let mut side = Side::of(&pc);
            side.uninstall = uninstall;
            let seen = Seen::default();
            let stop = go(&pc, &side, &seen).unwrap_err();
            assert_eq!(stop.failure, Failure::ClassicRemains);
            assert_eq!(
                calls_after_the_check(&pc),
                [
                    "say ready",
                    "hear go",
                    "wait for the app",
                    "uninstall",
                    "remove note",
                    "remove package",
                    "start app"
                ]
            );
            assert_eq!(seen.stages.borrow().last(), Some(&Stage::PuttingBack));
        }
    }

    #[test]
    fn a_put_back_goes_on_past_what_it_cannot_undo() {
        let mut pc = Pc::new("move-put-back");
        pc.remove = Err("0x80073CFA".to_string());
        let mut side = Side::of(&pc);
        side.uninstall = Ok(2);
        side.note = Err("access is denied".to_string());
        side.start = Err("the program is not there".to_string());
        let stop = go(&pc, &side, &Seen::default()).unwrap_err();
        assert_eq!(stop.failure, Failure::ClassicRemains);
        assert_eq!(
            calls_after_the_check(&pc)[4..],
            ["remove note", "remove package", "start app"]
        );
    }

    #[test]
    fn a_package_that_cannot_be_started_after_the_move_stays_and_nothing_is_put_back() {
        let mut pc = Pc::new("move-not-opened");
        pc.finish = Err("the alias is switched off".to_string());
        let stop = go(&pc, &Side::of(&pc), &Seen::default()).unwrap_err();
        assert_eq!(stop.failure, Failure::NotOpened);
        assert_eq!(calls_after_the_check(&pc).last().unwrap(), "finish");
        assert!(
            !pc.calls()
                .iter()
                .any(|call| call.starts_with("remove") || call == "start app")
        );
    }

    #[test]
    fn the_uninstaller_is_started_in_its_move_mode_with_the_folder_last_and_bare() {
        assert_eq!(
            uninstaller_arguments(Path::new("C:\\Users\\John Doe\\AppData\\Local\\Programs\\open-headers")),
            "/S /KEEP_APP_DATA /currentuser --updated --move-to-package _?=C:\\Users\\John Doe\\AppData\\Local\\Programs\\open-headers"
        );
    }

    #[test]
    fn only_the_one_word_is_a_go() {
        assert!(is_go("go") && is_go("go\r\n"));
        assert!(!is_go("") && !is_go("no") && !is_go("go on"));
    }

    #[test]
    fn a_stop_is_said_with_the_code_the_installer_ends_with() {
        assert_eq!(stopped_line(Failure::ClassicRemains.exit_code()), "stopped 34");
        assert_eq!(stopped_line(Failure::Download.exit_code()), "stopped 21");
    }

    #[test]
    fn the_packages_app_is_started_through_this_users_alias() {
        let alias = package_app_alias(Path::new("local"));
        assert_eq!(
            alias,
            Path::new("local")
                .join("Microsoft")
                .join("WindowsApps")
                .join("openheaders.exe")
        );
    }
}
