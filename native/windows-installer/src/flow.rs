//! One install, in its order: is this a PC the package installs on, is
//! the package there already, what does the channel offer, download it,
//! hold it to the pointer's hash and to our signer, hand the file to
//! Windows, open the app.
//!
//! Windows is behind [`System`] and the person behind [`Watcher`], so the
//! order and every way it stops are pinned without either.
//!
//! Whose package it is: a signed installer takes only a package signed
//! by its own signer — read from its own file when it runs, never a name
//! written here. A build that carries no signature (a developer's) has
//! no signer of its own and holds the package to the publisher the
//! pointer names.

use std::path::{Path, PathBuf};

use crate::feed::{Channel, pointer_url};
use crate::log::Log;
use crate::outcome::{Failure, Stop};
use crate::pointer::{Arch, PackageOffer, PointerError, file_name_of, read_offer};
use crate::transfer::{Around, DownloadError, Transport, download, read_small};

/// The pointer is a few hundred bytes; anything far larger is not one.
const POINTER_SIZE_CAP: usize = 64 * 1024;

/// Who signed a file: the certificate's subject as Windows prints it,
/// and as the certificate encodes it.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct Signer {
    pub subject: String,
    pub subject_der: Vec<u8>,
}

/// Why this PC takes no package.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Unfit {
    WindowsTooOld,
    SMode,
    PolicyBlocks,
}

pub trait System {
    fn fitness(&self) -> Result<(), Unfit>;
    /// The PC's own arch, whatever the installer was built for.
    fn arch(&self) -> Option<Arch>;
    /// The version of the package this user has installed, if any.
    fn installed_version(&self) -> Result<Option<String>, String>;
    fn transport(&self) -> &dyn Transport;
    fn pause(&self, milliseconds: u64);
    /// The folder a download is kept in while the run lasts.
    fn download_dir(&self) -> PathBuf;
    fn sha256_hex(&self, file: &Path) -> Result<String, String>;
    /// The installer's own signer; `None` for a build that carries no signature.
    fn own_signer(&self) -> Result<Option<Signer>, String>;
    /// The signer of a package file whose signature Windows trusts.
    fn package_signer(&self, file: &Path) -> Result<Signer, String>;
    fn install(&self, file: &Path, on_percent: &mut dyn FnMut(u32)) -> Result<(), String>;
    fn open_app(&self) -> Result<(), String>;
    /// Starts the installed package in its check mode and waits this long
    /// for it: how the check ended.
    fn check_package_start(&self, within_ms: u64) -> Result<i32, String>;
    /// Takes this user's package away again.
    fn remove_package(&self) -> Result<(), String>;
    /// Starts the installed package to take the classic install's data in.
    fn finish_move(&self) -> Result<(), String>;
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Stage {
    Checking,
    Downloading,
    Verifying,
    Installing,
    Opening,
    /// A move: the installed package is asked whether it starts.
    CheckingPackage,
    /// A move: the classic app is told, and waited for.
    ClosingApp,
    /// A move: the classic install's own uninstaller runs.
    RemovingClassic,
    /// A move that stopped: what it changed is undone.
    PuttingBack,
}

/// A megabyte as Windows counts one where it shows a file's size.
const MEGABYTE: u64 = 1024 * 1024;

/// How far a stage is.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Progress {
    /// Nothing to count yet, or nothing that can be counted.
    Unknown,
    Percent(u32),
    /// A download: the bytes on disk, of the bytes the pointer names.
    Bytes {
        have: u64,
        total: u64,
    },
}

impl Progress {
    pub fn percent(self) -> Option<u32> {
        match self {
            Progress::Unknown => None,
            Progress::Percent(percent) => Some(percent.min(100)),
            Progress::Bytes { total: 0, .. } => None,
            Progress::Bytes { have, total } => Some((have.saturating_mul(100) / total).min(100) as u32),
        }
    }

    /// The download in whole megabytes, where it is at least one.
    fn megabytes(self) -> Option<(u64, u64)> {
        match self {
            Progress::Bytes { have, total } if total >= MEGABYTE => {
                Some((have.min(total) / MEGABYTE, total / MEGABYTE))
            }
            _ => None,
        }
    }
}

impl Stage {
    /// The line a person reads while the stage runs.
    pub fn words(self, progress: Progress) -> String {
        let words = match self {
            Stage::Checking => "Getting ready…",
            Stage::Downloading => "Downloading Open Headers…",
            Stage::Verifying => "Verifying…",
            Stage::Installing => "Installing…",
            Stage::Opening => "Opening Open Headers…",
            Stage::CheckingPackage => "Checking the package…",
            Stage::ClosingApp => "Closing Open Headers…",
            Stage::RemovingClassic => "Removing the previous install…",
            Stage::PuttingBack => "Putting things back…",
        };
        match (self, progress.percent(), progress.megabytes()) {
            (Stage::Downloading, Some(percent), Some((have, total))) => {
                format!("{words} {percent}% ({have} of {total} MB)")
            }
            (Stage::Downloading | Stage::Installing, Some(percent), _) => format!("{words} {percent}%"),
            _ => words.to_string(),
        }
    }

    /// Whether a cancel is still taken: not once Windows has the package.
    pub fn takes_cancel(self) -> bool {
        matches!(self, Stage::Checking | Stage::Downloading | Stage::Verifying)
    }
}

/// The person watching, if anyone is.
pub trait Watcher {
    fn stage(&self, stage: Stage);
    /// How far the stage is.
    fn progress(&self, progress: Progress);
    fn cancelled(&self) -> bool;
}

/// A run nobody watches.
pub struct Unwatched;

impl Watcher for Unwatched {
    fn stage(&self, _stage: Stage) {}
    fn progress(&self, _progress: Progress) {}
    fn cancelled(&self) -> bool {
        false
    }
}

pub struct Plan {
    pub channel: Channel,
    /// A package file to install in place of the channel's.
    pub package: Option<PathBuf>,
    pub open_app: bool,
}

/// What one try of a run hands the next.
#[derive(Debug, Default)]
pub struct Carry {
    /// The download on disk failed its hash: the next try fetches it anew.
    pub distrust_download: bool,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Done {
    Installed,
    /// The package was there already; the app updates itself.
    AlreadyInstalled,
    /// The package took the classic install's place (`classic_move`).
    Moved,
}

fn offer_for(plan: &Plan, system: &dyn System, log: &Log) -> Result<PackageOffer, Stop> {
    let arch = system
        .arch()
        .ok_or_else(|| Stop::new(Failure::NothingPublished, "this PC is neither x64 nor ARM64"))?;
    let url = pointer_url(plan.channel);
    log.line(&format!("reading {url} for {}", arch.name()));
    let (status, body) =
        read_small(system.transport(), &url, POINTER_SIZE_CAP).map_err(|error| Stop::new(Failure::Pointer, error))?;
    match status {
        200 => {}
        404 => {
            return Err(Stop::new(
                Failure::NothingPublished,
                format!("the {} channel has published no package", plan.channel.name()),
            ));
        }
        other => return Err(Stop::new(Failure::Pointer, format!("the feed answered {other}"))),
    }
    let offer = read_offer(&body, arch).map_err(|error| match error {
        PointerError::NoPackage => Stop::new(
            Failure::NothingPublished,
            format!("the pointer names no {} package", arch.name()),
        ),
        PointerError::Stopped => Stop::new(
            Failure::HeldBack,
            format!(
                "the {} channel's pointer says stop: its package is held back",
                plan.channel.name()
            ),
        ),
        PointerError::Unreadable(why) => Stop::new(Failure::Pointer, format!("unreadable pointer: {why}")),
    })?;
    log.line(&format!(
        "the pointer offers {} ({} bytes) at {}",
        offer.version, offer.size, offer.url
    ));
    Ok(offer)
}

fn fetch(
    offer: &PackageOffer,
    system: &dyn System,
    watcher: &dyn Watcher,
    log: &Log,
    carry: &mut Carry,
) -> Result<PathBuf, Stop> {
    let name = file_name_of(&offer.url)
        .ok_or_else(|| Stop::new(Failure::Pointer, format!("the link {} names no file", offer.url)))?;
    let dir = system.download_dir();
    std::fs::create_dir_all(&dir)
        .map_err(|error| Stop::new(Failure::Download, format!("cannot make {}: {error}", dir.display())))?;
    let file = dir.join(name);

    watcher.stage(Stage::Downloading);
    let mut shown = None;
    let result = download(
        system.transport(),
        &offer.url,
        &file,
        offer.size,
        Around {
            pause: &|milliseconds| system.pause(milliseconds),
            on_bytes: &mut |have| {
                // The line changes with the percentage and with the megabyte, and is said once per change.
                let progress = Progress::Bytes {
                    have,
                    total: offer.size,
                };
                let line = (progress.percent(), progress.megabytes());
                if shown != Some(line) {
                    shown = Some(line);
                    watcher.progress(progress);
                }
            },
            is_cancelled: &|| watcher.cancelled(),
            note: &|text| log.line(text),
            start_over: carry.distrust_download,
        },
    );
    match result {
        Ok(()) => {}
        Err(DownloadError::Cancelled) => return Err(Stop::new(Failure::Cancelled, "cancelled during the download")),
        Err(DownloadError::Failed(why)) => return Err(Stop::new(Failure::Download, why)),
    }
    log.line(&format!("downloaded {}", file.display()));

    watcher.stage(Stage::Verifying);
    watcher.progress(Progress::Unknown);
    let hash = system
        .sha256_hex(&file)
        .map_err(|error| Stop::new(Failure::Hash, error))?;
    if !hash.eq_ignore_ascii_case(&offer.sha256) {
        // A whole file with the wrong bytes: another try fetches it anew over this one, and the
        // run's end takes it away. It is not deleted here — Windows can hold a delete of a file
        // it is still scanning for a long time, and the person is owed the answer now.
        carry.distrust_download = true;
        return Err(Stop::new(
            Failure::Hash,
            format!("the download hashes to {hash}, the pointer names {}", offer.sha256),
        ));
    }
    carry.distrust_download = false;
    log.line(&format!("sha256 {hash} matches the pointer"));
    Ok(file)
}

fn hold_to_signer(file: &Path, publisher: Option<&str>, system: &dyn System, log: &Log) -> Result<(), Stop> {
    let own = system
        .own_signer()
        .map_err(|error| Stop::new(Failure::Signature, format!("the installer's own signature: {error}")))?;
    let package = system
        .package_signer(file)
        .map_err(|error| Stop::new(Failure::Signature, format!("the package's signature: {error}")))?;
    log.line(&format!("the package is signed by {}", package.subject));
    match (own, publisher) {
        (Some(own), _) => {
            if package.subject_der != own.subject_der {
                return Err(Stop::new(
                    Failure::Signature,
                    format!("the package's signer is not this installer's ({})", own.subject),
                ));
            }
            log.line("the package's signer is this installer's own");
        }
        (None, Some(publisher)) => {
            if package.subject != publisher {
                return Err(Stop::new(
                    Failure::Signature,
                    format!("the package's signer is not the pointer's publisher ({publisher})"),
                ));
            }
            log.line("this installer carries no signature: the package is held to the pointer's publisher");
        }
        (None, None) => {
            log.line(
                "this installer carries no signature and was handed a file: the package's signer is held to nothing",
            );
        }
    }
    Ok(())
}

/// Whether this PC takes the package, and the version of the one this
/// user has already, if any. Nothing is read from the feed before it.
pub fn survey(system: &dyn System, watcher: &dyn Watcher) -> Result<Option<String>, Stop> {
    watcher.stage(Stage::Checking);
    watcher.progress(Progress::Unknown);
    system.fitness().map_err(|unfit| match unfit {
        Unfit::WindowsTooOld => Stop::new(
            Failure::WindowsTooOld,
            "this Windows has no package install by link (before 10 2004)",
        ),
        Unfit::SMode => Stop::new(Failure::SMode, "Windows is in S mode"),
        Unfit::PolicyBlocks => Stop::new(Failure::PolicyBlocks, "the policy AllowAllTrustedApps is 0"),
    })?;
    system
        .installed_version()
        .map_err(|error| Stop::new(Failure::Unexpected, error))
}

/// Puts the package on the PC: the channel's, downloaded and held to the
/// pointer's hash, or the file the plan names; held to our signer; handed
/// to Windows.
pub fn place(
    plan: &Plan,
    system: &dyn System,
    watcher: &dyn Watcher,
    log: &Log,
    carry: &mut Carry,
) -> Result<(), Stop> {
    let (file, publisher) = match &plan.package {
        Some(file) => {
            if !file.is_file() {
                return Err(Stop::new(
                    Failure::BadSwitches,
                    format!("no package at {}", file.display()),
                ));
            }
            log.line(&format!("installing the file {}", file.display()));
            watcher.stage(Stage::Verifying);
            (file.clone(), None)
        }
        None => {
            let offer = offer_for(plan, system, log)?;
            (fetch(&offer, system, watcher, log, carry)?, Some(offer.publisher))
        }
    };
    hold_to_signer(&file, publisher.as_deref(), system, log)?;

    // The last moment a cancel is taken: an install Windows has begun is left to end.
    if watcher.cancelled() {
        return Err(Stop::new(Failure::Cancelled, "cancelled before the install"));
    }
    watcher.stage(Stage::Installing);
    let mut shown = None;
    system
        .install(&file, &mut |percent| {
            if shown != Some(percent) {
                shown = Some(percent);
                watcher.progress(Progress::Percent(percent));
            }
        })
        .map_err(|error| Stop::new(Failure::WindowsRefused, error))?;
    log.line("Windows installed the package");
    Ok(())
}

pub fn run(
    plan: &Plan,
    system: &dyn System,
    watcher: &dyn Watcher,
    log: &Log,
    carry: &mut Carry,
) -> Result<Done, Stop> {
    if let Some(version) = survey(system, watcher)? {
        log.line(&format!(
            "the package is installed already ({version}): nothing is installed over it"
        ));
        if plan.open_app {
            watcher.stage(Stage::Opening);
            system
                .open_app()
                .map_err(|error| Stop::new(Failure::NotOpened, error))?;
        }
        return Ok(Done::AlreadyInstalled);
    }
    place(plan, system, watcher, log, carry)?;

    if plan.open_app {
        watcher.stage(Stage::Opening);
        watcher.progress(Progress::Unknown);
        system
            .open_app()
            .map_err(|error| Stop::new(Failure::NotOpened, error))?;
        log.line("the app was opened");
    }
    Ok(Done::Installed)
}

/// A PC and a watcher that answer from what a test set, for this module's
/// tests and for the move's.
#[cfg(test)]
pub mod testing {
    use super::*;
    use crate::transfer::testing::{FakeHost, scratch_dir};
    use std::cell::{Cell, RefCell};

    pub const PUBLISHER: &str = "CN=BITHUB TEAM SRL, O=BITHUB TEAM SRL, L=Iasi, S=Iasi, C=RO";
    pub const PACKAGE: &[u8] = b"a package's bytes, as the download host holds them";
    pub const HASH: &str = "5f0c3e6f6f4a1e2d3c4b5a69788796a5b4c3d2e1f00112233445566778899aab";

    pub fn pointer() -> Vec<u8> {
        format!(
            r#"{{"version":"2026.11.3-beta.6","packageVersion":"2026.11.3.6","tag":"v2026.11.3-beta.6","publisher":"{PUBLISHER}",
            "packages":{{"x64":{{"url":"https://updates.openheaders.io/dl/v2026.11.3-beta.6/OpenHeaders-2026.11.3-beta.6-x64.msix","size":{},"sha256":"{HASH}"}}}},
            "stop":false,"ramp":100}}"#,
            PACKAGE.len()
        )
        .into_bytes()
    }

    /// The feed and the download host in one: the pointer at the pointer's
    /// link, the package at any other.
    pub struct Feed {
        pub pointer: FakeHost,
        pub package: FakeHost,
    }

    impl Transport for Feed {
        fn get(&self, url: &str, from: u64, body: &mut dyn crate::transfer::Body) -> Result<(), String> {
            if url.ends_with("windows-package.json") {
                self.pointer.get(url, from, body)
            } else {
                self.package.get(url, from, body)
            }
        }
    }

    pub fn signer(subject: &str) -> Signer {
        Signer {
            subject: subject.to_string(),
            subject_der: subject.as_bytes().to_vec(),
        }
    }

    pub struct Pc {
        pub dir: PathBuf,
        pub feed: Feed,
        pub fitness: Result<(), Unfit>,
        pub arch: Option<Arch>,
        pub installed: Option<String>,
        pub hash: String,
        pub own: Result<Option<Signer>, String>,
        pub package_signer: Result<Signer, String>,
        pub install: Result<(), String>,
        pub open: Result<(), String>,
        pub check: Result<i32, String>,
        pub remove: Result<(), String>,
        pub finish: Result<(), String>,
        /// What was asked of the PC, in its order.
        pub calls: RefCell<Vec<String>>,
        pub installed_from: RefCell<Option<PathBuf>>,
    }

    impl Pc {
        pub fn new(name: &str) -> Pc {
            Pc {
                dir: scratch_dir(name),
                feed: Feed {
                    pointer: FakeHost::new(&pointer(), vec![]),
                    package: FakeHost::new(PACKAGE, vec![]),
                },
                fitness: Ok(()),
                arch: Some(Arch::X64),
                installed: None,
                hash: HASH.to_string(),
                own: Ok(Some(signer(PUBLISHER))),
                package_signer: Ok(signer(PUBLISHER)),
                install: Ok(()),
                open: Ok(()),
                check: Ok(0),
                remove: Ok(()),
                finish: Ok(()),
                calls: RefCell::new(Vec::new()),
                installed_from: RefCell::new(None),
            }
        }

        pub fn calls(&self) -> Vec<String> {
            self.calls.borrow().clone()
        }
    }

    impl Drop for Pc {
        fn drop(&mut self) {
            let _ = std::fs::remove_dir_all(&self.dir);
        }
    }

    impl System for Pc {
        fn fitness(&self) -> Result<(), Unfit> {
            self.fitness
        }
        fn arch(&self) -> Option<Arch> {
            self.arch
        }
        fn installed_version(&self) -> Result<Option<String>, String> {
            Ok(self.installed.clone())
        }
        fn transport(&self) -> &dyn Transport {
            &self.feed
        }
        fn pause(&self, _milliseconds: u64) {}
        fn download_dir(&self) -> PathBuf {
            self.dir.join("download")
        }
        fn sha256_hex(&self, _file: &Path) -> Result<String, String> {
            self.calls.borrow_mut().push("hash".to_string());
            Ok(self.hash.clone())
        }
        fn own_signer(&self) -> Result<Option<Signer>, String> {
            self.own.clone()
        }
        fn package_signer(&self, _file: &Path) -> Result<Signer, String> {
            self.calls.borrow_mut().push("signer".to_string());
            self.package_signer.clone()
        }
        fn install(&self, file: &Path, on_percent: &mut dyn FnMut(u32)) -> Result<(), String> {
            self.calls.borrow_mut().push("install".to_string());
            *self.installed_from.borrow_mut() = Some(file.to_path_buf());
            for percent in [0, 40, 40, 100] {
                on_percent(percent);
            }
            self.install.clone()
        }
        fn open_app(&self) -> Result<(), String> {
            self.calls.borrow_mut().push("open".to_string());
            self.open.clone()
        }
        fn check_package_start(&self, _within_ms: u64) -> Result<i32, String> {
            self.calls.borrow_mut().push("check".to_string());
            self.check.clone()
        }
        fn remove_package(&self) -> Result<(), String> {
            self.calls.borrow_mut().push("remove package".to_string());
            self.remove.clone()
        }
        fn finish_move(&self) -> Result<(), String> {
            self.calls.borrow_mut().push("finish".to_string());
            self.finish.clone()
        }
    }

    #[derive(Default)]
    pub struct Seen {
        pub stages: RefCell<Vec<Stage>>,
        pub progress: RefCell<Vec<Progress>>,
        pub cancel_at: Cell<Option<Stage>>,
    }

    impl Watcher for Seen {
        fn stage(&self, stage: Stage) {
            self.stages.borrow_mut().push(stage);
        }
        fn progress(&self, progress: Progress) {
            self.progress.borrow_mut().push(progress);
        }
        fn cancelled(&self) -> bool {
            self.cancel_at
                .get()
                .is_some_and(|stage| self.stages.borrow().contains(&stage))
        }
    }

    pub fn plan() -> Plan {
        Plan {
            channel: Channel::Beta,
            package: None,
            open_app: true,
        }
    }
}

#[cfg(test)]
mod tests {
    use super::testing::*;
    use super::*;
    use crate::transfer::testing::{Answer, FakeHost};

    fn go(pc: &Pc, plan: &Plan, seen: &Seen) -> Result<Done, Stop> {
        go_on(pc, plan, seen, &mut Carry::default())
    }

    fn go_on(pc: &Pc, plan: &Plan, seen: &Seen, carry: &mut Carry) -> Result<Done, Stop> {
        let log = Log::create(&pc.dir.join("install.log"));
        run(plan, pc, seen, &log, carry)
    }

    fn failure(result: Result<Done, Stop>) -> Failure {
        result.expect_err("the run stops").failure
    }

    #[test]
    fn a_plain_run_downloads_checks_installs_and_opens_in_that_order() {
        let pc = Pc::new("plain");
        let seen = Seen::default();
        assert_eq!(go(&pc, &plan(), &seen), Ok(Done::Installed));
        assert_eq!(pc.calls(), ["hash", "signer", "install", "open"]);
        assert_eq!(
            *seen.stages.borrow(),
            [
                Stage::Checking,
                Stage::Downloading,
                Stage::Verifying,
                Stage::Installing,
                Stage::Opening
            ]
        );
        assert_eq!(
            pc.feed.pointer.asked.borrow()[0].0,
            "https://updates.openheaders.com/desktop/beta/windows-package.json"
        );
        let from = pc.installed_from.borrow().clone().unwrap();
        assert_eq!(
            from,
            pc.dir.join("download").join("OpenHeaders-2026.11.3-beta.6-x64.msix")
        );
        assert_eq!(std::fs::read(from).unwrap(), PACKAGE);
    }

    #[test]
    fn the_window_hears_each_change_once() {
        let pc = Pc::new("percent");
        let seen = Seen::default();
        go(&pc, &plan(), &seen).unwrap();
        let progress = seen.progress.borrow();
        assert!(progress.contains(&Progress::Bytes {
            have: PACKAGE.len() as u64,
            total: PACKAGE.len() as u64
        }));
        assert!(
            progress
                .windows(2)
                .all(|pair| pair[0] != pair[1] || pair[0] == Progress::Unknown),
            "{progress:?}"
        );
        assert_eq!(
            &progress[progress.len() - 4..],
            [
                Progress::Percent(0),
                Progress::Percent(40),
                Progress::Percent(100),
                Progress::Unknown
            ]
        );
    }

    #[test]
    fn a_stage_reads_as_its_line_with_a_percentage_where_there_is_one() {
        assert_eq!(
            Stage::Downloading.words(Progress::Percent(42)),
            "Downloading Open Headers… 42%"
        );
        assert_eq!(Stage::Downloading.words(Progress::Unknown), "Downloading Open Headers…");
        assert_eq!(Stage::Verifying.words(Progress::Percent(42)), "Verifying…");
        assert_eq!(Stage::Installing.words(Progress::Percent(7)), "Installing… 7%");
        assert_eq!(Stage::Opening.words(Progress::Unknown), "Opening Open Headers…");
        assert!(Stage::Verifying.takes_cancel() && !Stage::Installing.takes_cancel());
    }

    #[test]
    fn a_moves_stages_read_as_their_lines_and_take_no_cancel() {
        let lines = [
            (Stage::CheckingPackage, "Checking the package…"),
            (Stage::ClosingApp, "Closing Open Headers…"),
            (Stage::RemovingClassic, "Removing the previous install…"),
            (Stage::PuttingBack, "Putting things back…"),
        ];
        for (stage, line) in lines {
            assert_eq!(stage.words(Progress::Percent(42)), line);
            assert!(!stage.takes_cancel(), "{stage:?}");
        }
    }

    #[test]
    fn a_download_reads_with_its_megabytes_as_windows_counts_them() {
        let megabyte = 1024 * 1024;
        // The package of beta.5 for ARM64: Windows shows the file as 240 MB.
        let total = 252_212_268;
        let words = |have| Stage::Downloading.words(Progress::Bytes { have, total });
        assert_eq!(words(0), "Downloading Open Headers… 0% (0 of 240 MB)");
        assert_eq!(words(112 * megabyte), "Downloading Open Headers… 46% (112 of 240 MB)");
        assert_eq!(words(total), "Downloading Open Headers… 100% (240 of 240 MB)");
        assert_eq!(
            words(total + megabyte),
            "Downloading Open Headers… 100% (240 of 240 MB)"
        );
        // A download under a megabyte has none to count.
        assert_eq!(
            Stage::Downloading.words(Progress::Bytes { have: 20, total: 40 }),
            "Downloading Open Headers… 50%"
        );
        assert_eq!(Progress::Bytes { have: 0, total: 0 }.percent(), None);
    }

    #[test]
    fn a_pc_windows_cannot_install_on_stops_before_anything_is_read() {
        for (unfit, expected) in [
            (Unfit::WindowsTooOld, Failure::WindowsTooOld),
            (Unfit::SMode, Failure::SMode),
            (Unfit::PolicyBlocks, Failure::PolicyBlocks),
        ] {
            let mut pc = Pc::new("unfit");
            pc.fitness = Err(unfit);
            assert_eq!(failure(go(&pc, &plan(), &Seen::default())), expected);
            assert!(pc.feed.pointer.asked.borrow().is_empty());
        }
    }

    #[test]
    fn an_installed_package_is_opened_and_nothing_is_downloaded() {
        let mut pc = Pc::new("installed");
        pc.installed = Some("2026.11.3.5".to_string());
        assert_eq!(go(&pc, &plan(), &Seen::default()), Ok(Done::AlreadyInstalled));
        assert_eq!(pc.calls(), ["open"]);
        assert!(pc.feed.pointer.asked.borrow().is_empty());
    }

    #[test]
    fn a_channel_without_a_package_says_so() {
        let mut pc = Pc::new("no-pointer");
        pc.feed.pointer = FakeHost::new(b"", vec![Answer::Status(404)]);
        assert_eq!(failure(go(&pc, &plan(), &Seen::default())), Failure::NothingPublished);
        let mut other_arch = Pc::new("no-arch");
        other_arch.arch = Some(Arch::Arm64);
        assert_eq!(
            failure(go(&other_arch, &plan(), &Seen::default())),
            Failure::NothingPublished
        );
    }

    #[test]
    fn a_channel_held_back_installs_nothing_and_is_not_tried_again() {
        let mut pc = Pc::new("held-back");
        let held = String::from_utf8(pointer())
            .unwrap()
            .replace("\"stop\":false", "\"stop\":true");
        pc.feed.pointer = FakeHost::new(held.as_bytes(), vec![]);
        let stop = go(&pc, &plan(), &Seen::default()).unwrap_err();
        assert_eq!(stop.failure, Failure::HeldBack);
        assert!(!stop.failure.worth_another_try());
        assert!(pc.calls().is_empty() && pc.feed.package.asked.borrow().is_empty());
    }

    #[test]
    fn a_feed_that_cannot_be_read_is_a_connection_matter() {
        for answer in [Answer::Unreachable, Answer::Status(503)] {
            let mut pc = Pc::new("feed-down");
            pc.feed.pointer = FakeHost::new(b"", vec![answer]);
            assert_eq!(failure(go(&pc, &plan(), &Seen::default())), Failure::Pointer);
        }
        let mut garbled = Pc::new("feed-garbled");
        garbled.feed.pointer = FakeHost::new(b"<html>sign in</html>", vec![]);
        assert_eq!(failure(go(&garbled, &plan(), &Seen::default())), Failure::Pointer);
    }

    #[test]
    fn a_download_that_never_ends_stops_the_run() {
        let mut pc = Pc::new("download-fails");
        pc.feed.package = FakeHost::new(
            PACKAGE,
            vec![Answer::Unreachable, Answer::Unreachable, Answer::Unreachable],
        );
        assert_eq!(failure(go(&pc, &plan(), &Seen::default())), Failure::Download);
        assert!(pc.calls().is_empty());
    }

    #[test]
    fn a_wrong_hash_stops_the_run_at_once_and_the_next_try_fetches_anew() {
        let mut pc = Pc::new("hash");
        pc.hash = HASH.replace('5', "6");
        let mut carry = Carry::default();
        assert_eq!(
            failure(go_on(&pc, &plan(), &Seen::default(), &mut carry)),
            Failure::Hash
        );
        assert_eq!(pc.calls(), ["hash"]);
        // The file is left where it is: nothing waits on Windows before the person is told.
        let file = pc.dir.join("download").join("OpenHeaders-2026.11.3-beta.6-x64.msix");
        assert!(file.exists() && carry.distrust_download);
        assert_eq!(pc.feed.package.asked.borrow().len(), 1);

        // The next try does not take the whole file it finds for the package.
        pc.hash = HASH.to_string();
        assert_eq!(go_on(&pc, &plan(), &Seen::default(), &mut carry), Ok(Done::Installed));
        let asked = pc.feed.package.asked.borrow();
        assert_eq!(asked.len(), 2);
        assert_eq!(asked[1].1, 0);
        assert!(!carry.distrust_download);
    }

    #[test]
    fn a_package_windows_does_not_trust_is_not_installed() {
        let mut pc = Pc::new("untrusted");
        pc.package_signer = Err("no signature".to_string());
        assert_eq!(failure(go(&pc, &plan(), &Seen::default())), Failure::Signature);
        assert_eq!(pc.calls(), ["hash", "signer"]);
    }

    #[test]
    fn a_signed_installer_takes_only_its_own_signers_package() {
        let mut pc = Pc::new("other-signer");
        pc.package_signer = Ok(signer("CN=John Doe"));
        assert_eq!(failure(go(&pc, &plan(), &Seen::default())), Failure::Signature);
        assert_eq!(pc.calls(), ["hash", "signer"]);

        // Its own signer decides, whatever publisher the pointer names.
        let mut renamed = Pc::new("pointer-renamed");
        renamed.own = Ok(Some(signer("CN=John Doe")));
        renamed.package_signer = Ok(signer("CN=John Doe"));
        assert_eq!(go(&renamed, &plan(), &Seen::default()), Ok(Done::Installed));
    }

    #[test]
    fn an_installer_whose_own_signature_is_broken_installs_nothing() {
        let mut pc = Pc::new("own-broken");
        pc.own = Err("the digest does not match".to_string());
        assert_eq!(failure(go(&pc, &plan(), &Seen::default())), Failure::Signature);
        assert_eq!(pc.calls(), ["hash"]);
    }

    #[test]
    fn an_unsigned_build_holds_the_package_to_the_pointers_publisher() {
        let mut pc = Pc::new("unsigned");
        pc.own = Ok(None);
        assert_eq!(go(&pc, &plan(), &Seen::default()), Ok(Done::Installed));

        let mut other = Pc::new("unsigned-other");
        other.own = Ok(None);
        other.package_signer = Ok(signer("CN=John Doe"));
        assert_eq!(failure(go(&other, &plan(), &Seen::default())), Failure::Signature);
    }

    #[test]
    fn a_file_handed_over_is_installed_without_the_feed() {
        let pc = Pc::new("file");
        let file = pc.dir.join("OpenHeaders-2026.11.3-beta.6-x64.msix");
        std::fs::write(&file, PACKAGE).unwrap();
        let plan = Plan {
            channel: Channel::Beta,
            package: Some(file.clone()),
            open_app: false,
        };
        assert_eq!(go(&pc, &plan, &Seen::default()), Ok(Done::Installed));
        assert_eq!(pc.calls(), ["signer", "install"]);
        assert_eq!(*pc.installed_from.borrow(), Some(file));
        assert!(pc.feed.pointer.asked.borrow().is_empty() && pc.feed.package.asked.borrow().is_empty());
    }

    #[test]
    fn a_file_that_is_not_there_is_a_bad_switch() {
        let pc = Pc::new("no-file");
        let plan = Plan {
            channel: Channel::Beta,
            package: Some(pc.dir.join("missing.msix")),
            open_app: true,
        };
        assert_eq!(failure(go(&pc, &plan, &Seen::default())), Failure::BadSwitches);
    }

    #[test]
    fn a_cancel_during_the_download_installs_nothing() {
        let pc = Pc::new("cancel-download");
        let seen = Seen::default();
        seen.cancel_at.set(Some(Stage::Downloading));
        assert_eq!(failure(go(&pc, &plan(), &seen)), Failure::Cancelled);
        assert!(pc.calls().is_empty());
    }

    #[test]
    fn a_cancel_while_verifying_is_taken_before_windows_starts() {
        let pc = Pc::new("cancel-verify");
        let seen = Seen::default();
        seen.cancel_at.set(Some(Stage::Verifying));
        assert_eq!(failure(go(&pc, &plan(), &seen)), Failure::Cancelled);
        assert_eq!(pc.calls(), ["hash", "signer"]);
    }

    #[test]
    fn a_refusal_by_windows_carries_its_own_words() {
        let mut pc = Pc::new("refused");
        pc.install = Err("0x80073CF3: the package failed update, dependency or conflict validation".to_string());
        let stop = go(&pc, &plan(), &Seen::default()).unwrap_err();
        assert_eq!(stop.failure, Failure::WindowsRefused);
        assert!(stop.detail.contains("0x80073CF3"));
        assert_eq!(pc.calls(), ["hash", "signer", "install"]);
    }

    #[test]
    fn an_app_that_does_not_open_is_still_installed() {
        let mut pc = Pc::new("not-opened");
        pc.open = Err("no app list entry".to_string());
        assert_eq!(failure(go(&pc, &plan(), &Seen::default())), Failure::NotOpened);
        assert_eq!(pc.calls(), ["hash", "signer", "install", "open"]);
    }

    #[test]
    fn a_run_told_not_to_open_the_app_does_not() {
        let pc = Pc::new("no-launch");
        let plan = Plan {
            channel: Channel::Beta,
            package: None,
            open_app: false,
        };
        assert_eq!(go(&pc, &plan, &Seen::default()), Ok(Done::Installed));
        assert_eq!(pc.calls(), ["hash", "signer", "install"]);
    }
}
