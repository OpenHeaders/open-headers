//! Taking the download away when the run ends — the run's last act,
//! after its outcome is known and, where a person watches, after the
//! dialog is gone and the app is open.
//!
//! Windows can make the delete of a large file that was just written and
//! read wait: on the machine this was measured on, a rename or a delete
//! of the 252 MB package took about a minute and a half to return for as
//! long as that after the file's first whole read, and returned at once
//! afterwards. The call does return, so the program stays for it and
//! leaves nothing behind. A delete that is REFUSED is another matter: it
//! is asked a few more times, and what is still refused then is left for
//! the next run, which finds the file whole, checks it again and deletes
//! it at its own end.

use std::path::Path;
use std::time::Instant;

/// How often a refused delete is asked again, and the wait between two asks.
pub const TRIES: u32 = 8;
pub const WAIT_BETWEEN_TRIES_MS: u64 = 250;

/// Removes `dir` and the files in it. Returns whether it is gone.
pub fn remove_download_dir(dir: &Path, tries: u32, pause: &dyn Fn(u64), note: &dyn Fn(&str)) -> bool {
    if !dir.exists() {
        return true;
    }
    note("removing the download folder");
    let started = Instant::now();
    let mut last = String::new();
    for attempt in 1..=tries.max(1) {
        if attempt > 1 {
            pause(WAIT_BETWEEN_TRIES_MS);
        }
        last.clear();
        if let Ok(entries) = std::fs::read_dir(dir) {
            for entry in entries.flatten() {
                if let Err(error) = std::fs::remove_file(entry.path()) {
                    last = format!("{}: {error}", entry.path().display());
                }
            }
        }
        if last.is_empty() {
            match std::fs::remove_dir(dir) {
                Ok(()) => {
                    note(&format!(
                        "the download folder is removed (try {attempt}, {} ms)",
                        started.elapsed().as_millis()
                    ));
                    return true;
                }
                Err(error) => last = format!("{}: {error}", dir.display()),
            }
        }
        if attempt == 1 {
            note(&format!("the download folder cannot be removed yet: {last}"));
        }
    }
    note(&format!(
        "the download folder is left for the next run after {tries} tries, {} ms: {last}",
        started.elapsed().as_millis()
    ));
    false
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::transfer::testing::scratch_dir;
    use std::cell::RefCell;

    fn run(dir: &Path) -> (bool, Vec<u64>, Vec<String>) {
        let pauses = RefCell::new(Vec::new());
        let notes = RefCell::new(Vec::new());
        let gone = remove_download_dir(dir, 3, &|ms| pauses.borrow_mut().push(ms), &|text| {
            notes.borrow_mut().push(text.to_string())
        });
        (gone, pauses.into_inner(), notes.into_inner())
    }

    #[test]
    fn a_folder_that_was_never_made_is_gone() {
        let scratch = scratch_dir("cleanup-none");
        let (gone, pauses, notes) = run(&scratch.join("download"));
        assert!(gone && pauses.is_empty() && notes.is_empty());
        let _ = std::fs::remove_dir_all(&scratch);
    }

    #[test]
    fn a_folder_with_a_download_goes_at_the_first_try() {
        let scratch = scratch_dir("cleanup-plain");
        let dir = scratch.join("download");
        std::fs::create_dir_all(&dir).unwrap();
        std::fs::write(dir.join("OpenHeaders-2026.11.3-beta.6-x64.msix"), b"bytes").unwrap();
        let (gone, pauses, notes) = run(&dir);
        assert!(gone && !dir.exists());
        assert!(pauses.is_empty());
        assert_eq!(notes[0], "removing the download folder");
        assert!(
            notes[1].starts_with("the download folder is removed (try 1"),
            "{notes:?}"
        );
        let _ = std::fs::remove_dir_all(&scratch);
    }

    #[test]
    fn what_cannot_be_taken_away_is_asked_for_a_bounded_time_and_left() {
        let scratch = scratch_dir("cleanup-held");
        let dir = scratch.join("download");
        // A folder inside stands in for a file Windows holds: it cannot be removed as a file.
        std::fs::create_dir_all(dir.join("held")).unwrap();
        let (gone, pauses, notes) = run(&dir);
        assert!(!gone && dir.exists());
        assert_eq!(pauses, [WAIT_BETWEEN_TRIES_MS, WAIT_BETWEEN_TRIES_MS]);
        assert!(
            notes[1].starts_with("the download folder cannot be removed yet: "),
            "{notes:?}"
        );
        assert!(
            notes[2].starts_with("the download folder is left for the next run after 3 tries"),
            "{notes:?}"
        );
        let _ = std::fs::remove_dir_all(&scratch);
    }
}
