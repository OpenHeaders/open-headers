//! The run's log: one file, written anew by each run, every line with
//! the seconds since the run began. A log that cannot be written is no
//! reason to stop an install.

use std::fs::File;
use std::io::Write;
use std::path::{Path, PathBuf};
use std::sync::Mutex;
use std::time::{Instant, SystemTime, UNIX_EPOCH};

pub const LOG_FILE_NAME: &str = "OpenHeaders-Installer.log";

pub struct Log {
    path: PathBuf,
    file: Mutex<Option<File>>,
    started: Instant,
}

impl Log {
    pub fn create(path: &Path) -> Log {
        let log = Log {
            path: path.to_path_buf(),
            file: Mutex::new(File::create(path).ok()),
            started: Instant::now(),
        };
        let now = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .map(|since| since.as_secs())
            .unwrap_or(0);
        log.line(&format!("started {} UTC", utc_text(now)));
        log
    }

    pub fn path(&self) -> &Path {
        &self.path
    }

    pub fn line(&self, text: &str) {
        let Ok(mut file) = self.file.lock() else { return };
        if let Some(file) = file.as_mut() {
            let _ = writeln!(file, "[{:8.3}] {text}", self.started.elapsed().as_secs_f64());
            let _ = file.flush();
        }
    }
}

/// Seconds since 1970 as `2026-11-26 20:35:28`.
pub fn utc_text(epoch_seconds: u64) -> String {
    let (days, second_of_day) = (epoch_seconds / 86_400, epoch_seconds % 86_400);
    // Civil date from a day count, in the proleptic Gregorian calendar.
    let shifted = days + 719_468;
    let era = shifted / 146_097;
    let day_of_era = shifted % 146_097;
    let year_of_era = (day_of_era - day_of_era / 1_460 + day_of_era / 36_524 - day_of_era / 146_096) / 365;
    let day_of_year = day_of_era - (365 * year_of_era + year_of_era / 4 - year_of_era / 100);
    let month_index = (5 * day_of_year + 2) / 153;
    let day = day_of_year - (153 * month_index + 2) / 5 + 1;
    let month = if month_index < 10 {
        month_index + 3
    } else {
        month_index - 9
    };
    let year = year_of_era + era * 400 + u64::from(month <= 2);
    format!(
        "{year:04}-{month:02}-{day:02} {:02}:{:02}:{:02}",
        second_of_day / 3_600,
        second_of_day % 3_600 / 60,
        second_of_day % 60
    )
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::transfer::testing::scratch_dir;

    #[test]
    fn a_moment_reads_as_its_utc_date_and_time() {
        assert_eq!(utc_text(0), "1970-01-01 00:00:00");
        assert_eq!(utc_text(951_782_400), "2000-02-29 00:00:00");
        assert_eq!(utc_text(1_795_725_328), "2026-11-26 20:35:28");
    }

    #[test]
    fn every_line_lands_in_the_file_with_its_time() {
        let dir = scratch_dir("log");
        let path = dir.join(LOG_FILE_NAME);
        let log = Log::create(&path);
        log.line("the pointer names 2026.11.3-beta.6");
        let written = std::fs::read_to_string(&path).unwrap();
        let lines: Vec<&str> = written.lines().collect();
        assert_eq!(lines.len(), 2);
        assert!(
            lines[0].starts_with("[   0.0") && lines[0].contains("] started 20"),
            "{}",
            lines[0]
        );
        assert!(
            lines[1].ends_with("] the pointer names 2026.11.3-beta.6"),
            "{}",
            lines[1]
        );
        let _ = std::fs::remove_dir_all(&dir);
    }

    #[test]
    fn a_log_that_cannot_be_written_stops_nothing() {
        let dir = scratch_dir("log-missing");
        let log = Log::create(&dir.join("no-such-folder").join(LOG_FILE_NAME));
        log.line("still running");
        let _ = std::fs::remove_dir_all(&dir);
    }
}
