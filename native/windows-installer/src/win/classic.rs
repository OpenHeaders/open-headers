//! The classic install's side of a move: the pipe its app handed over as
//! this program's standard handles, the app's process, its uninstaller,
//! its request note.

use std::io::{BufRead, ErrorKind, Write};
use std::os::windows::io::OwnedHandle;
use std::os::windows::process::CommandExt;
use std::path::PathBuf;
use std::sync::mpsc;
use std::time::Duration;

use super::process;
use crate::classic_move::{Classic, ClassicInstall, READY_WORD, is_go, stopped_line, uninstaller_arguments};

pub struct Mover {
    install: ClassicInstall,
    app: OwnedHandle,
    /// Where the uninstaller's copy lies while it runs.
    work_dir: PathBuf,
}

impl Mover {
    /// Takes hold of the app's process, which runs: it started this
    /// program. The pipe's two ends stay this program's alone — the
    /// package it starts at the end outlives it.
    pub fn open(install: ClassicInstall, work_dir: PathBuf) -> Result<Mover, String> {
        let app = process::open_to_wait(install.app_pid)?;
        process::keep_to_self(&std::io::stdin());
        process::keep_to_self(&std::io::stdout());
        process::keep_to_self(&std::io::stderr());
        Ok(Mover { install, app, work_dir })
    }

    /// Tells the app a move stopped, as soon as it has: this program may
    /// stay a while longer to take its download away. An app that has
    /// gone hears nothing, and needs nothing.
    pub fn say_stopped(&self, exit_code: i32) {
        let mut pipe = std::io::stdout().lock();
        let _ = writeln!(pipe, "{}", stopped_line(exit_code)).and_then(|()| pipe.flush());
    }
}

impl Classic for Mover {
    fn say_ready(&self) -> Result<(), String> {
        let mut pipe = std::io::stdout().lock();
        writeln!(pipe, "{READY_WORD}")
            .and_then(|()| pipe.flush())
            .map_err(|error| format!("the pipe could not be written: {error}"))
    }

    fn hear_go(&self, within_ms: u64) -> Result<(), String> {
        // A read of a pipe has no time limit of its own: it is made on a thread that is left behind when the limit passes.
        let (heard, hears) = mpsc::channel();
        std::thread::spawn(move || {
            let mut line = String::new();
            let read = std::io::stdin().lock().read_line(&mut line);
            let _ = heard.send(read.map(|count| (count, line)));
        });
        match hears.recv_timeout(Duration::from_millis(within_ms)) {
            Ok(Ok((0, _))) => Err("the pipe closed without a word".to_string()),
            Ok(Ok((_, line))) if is_go(&line) => Ok(()),
            Ok(Ok((_, line))) => Err(format!("it answered '{}'", line.trim())),
            Ok(Err(error)) => Err(format!("the pipe could not be read: {error}")),
            Err(_) => Err(format!("no word in {} s", within_ms / 1000)),
        }
    }

    fn app_gone(&self, within_ms: u64) -> bool {
        process::ended_within(&self.app, within_ms)
    }

    fn uninstall(&self) -> Result<i32, String> {
        let uninstaller = &self.install.uninstaller;
        let (Some(install_dir), Some(name)) = (uninstaller.parent(), uninstaller.file_name()) else {
            return Err(format!("{} names no file in a folder", uninstaller.display()));
        };
        // Run from the install folder, the uninstaller could not remove its own file.
        let copy = self.work_dir.join(name);
        std::fs::create_dir_all(&self.work_dir)
            .and_then(|()| std::fs::copy(uninstaller, &copy))
            .map_err(|error| format!("cannot copy {} out: {error}", uninstaller.display()))?;
        let ended = process::apart(&copy)
            .raw_arg(uninstaller_arguments(install_dir))
            .status()
            .map_err(|error| format!("cannot start {}: {error}", copy.display()))?;
        ended.code().ok_or_else(|| "it ended without a code".to_string())
    }

    fn remove_note(&self) -> Result<(), String> {
        match std::fs::remove_file(&self.install.note) {
            Ok(()) => Ok(()),
            Err(error) if error.kind() == ErrorKind::NotFound => Ok(()),
            Err(error) => Err(format!("{}: {error}", self.install.note.display())),
        }
    }

    fn start_app(&self) -> Result<(), String> {
        process::apart(&self.install.app)
            .spawn()
            .map(drop)
            .map_err(|error| format!("{}: {error}", self.install.app.display()))
    }
}
