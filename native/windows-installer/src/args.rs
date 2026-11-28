//! The installer's switches.
//!
//!   --silent            no window; the log and the exit code say how it went
//!   --channel <name>    `stable` or `beta`, in place of the build's own
//!   --package <file>    install this package file: nothing is downloaded
//!   --no-launch         do not open the app afterwards
//!   --log <file>        write the log there
//!
//! A move (`classic_move`) is asked for by the classic app with four more,
//! all of them or none:
//!
//!   --move-app <file>          the app's own program
//!   --move-app-pid <number>    the running app's process
//!   --move-uninstaller <file>  its uninstaller, in the install folder
//!   --move-note <file>         where it writes its request note
//!
//! A value may also follow its switch after `=`.

use std::path::PathBuf;

use crate::classic_move::ClassicInstall;
use crate::feed::Channel;

#[derive(Debug, Default, PartialEq, Eq)]
pub struct Args {
    pub silent: bool,
    pub channel: Option<Channel>,
    pub package: Option<PathBuf>,
    pub no_launch: bool,
    pub log: Option<PathBuf>,
    /// The classic install a move takes the place of.
    pub classic: Option<ClassicInstall>,
}

pub fn parse<I>(args: I) -> Result<Args, String>
where
    I: IntoIterator<Item = String>,
{
    let mut parsed = Args::default();
    let (mut app, mut app_pid, mut uninstaller, mut note) = (None, None, None, None);
    let mut rest = args.into_iter();
    while let Some(arg) = rest.next() {
        let (name, inline) = match arg.split_once('=') {
            Some((name, value)) => (name.to_string(), Some(value.to_string())),
            None => (arg, None),
        };
        let mut value = |name: &str| -> Result<String, String> {
            let value = match inline.clone() {
                Some(value) => value,
                None => rest.next().ok_or_else(|| format!("{name} expects a value"))?,
            };
            if value.is_empty() {
                return Err(format!("{name} expects a value"));
            }
            Ok(value)
        };
        match name.as_str() {
            "--channel" => {
                let text = value("--channel")?;
                parsed.channel = Some(
                    Channel::from_name(&text).ok_or_else(|| format!("--channel is stable or beta, not '{text}'"))?,
                );
            }
            "--package" => parsed.package = Some(PathBuf::from(value("--package")?)),
            "--log" => parsed.log = Some(PathBuf::from(value("--log")?)),
            "--move-app" => app = Some(PathBuf::from(value("--move-app")?)),
            "--move-app-pid" => {
                let text = value("--move-app-pid")?;
                app_pid = Some(
                    text.parse::<u32>()
                        .ok()
                        .filter(|pid| *pid > 0)
                        .ok_or_else(|| format!("--move-app-pid is a process id, not '{text}'"))?,
                );
            }
            "--move-uninstaller" => uninstaller = Some(PathBuf::from(value("--move-uninstaller")?)),
            "--move-note" => note = Some(PathBuf::from(value("--move-note")?)),
            "--silent" | "--no-launch" if inline.is_some() => return Err(format!("{name} takes no value")),
            "--silent" => parsed.silent = true,
            "--no-launch" => parsed.no_launch = true,
            other => return Err(format!("unknown switch '{other}'")),
        }
    }
    parsed.classic = match (app, app_pid, uninstaller, note) {
        (None, None, None, None) => None,
        (Some(app), Some(app_pid), Some(uninstaller), Some(note)) => Some(ClassicInstall {
            app,
            app_pid,
            uninstaller,
            note,
        }),
        _ => {
            return Err(
                "a move takes --move-app, --move-app-pid, --move-uninstaller and --move-note together".to_string(),
            );
        }
    };
    // A move ends by starting the package: there is nothing to leave closed.
    if parsed.classic.is_some() && parsed.no_launch {
        return Err("--no-launch does not go with a move".to_string());
    }
    Ok(parsed)
}

#[cfg(test)]
mod tests {
    use super::*;

    fn parse_words(words: &[&str]) -> Result<Args, String> {
        parse(words.iter().map(|word| word.to_string()))
    }

    #[test]
    fn no_switch_is_the_plain_run() {
        assert_eq!(parse_words(&[]), Ok(Args::default()));
    }

    #[test]
    fn every_switch_is_read() {
        let args = parse_words(&[
            "--silent",
            "--channel",
            "beta",
            "--package",
            "C:\\Temp\\OpenHeaders-2026.11.3-beta.6-arm64.msix",
            "--no-launch",
            "--log",
            "C:\\Temp\\install.log",
        ])
        .unwrap();
        assert!(args.silent && args.no_launch);
        assert_eq!(args.channel, Some(Channel::Beta));
        assert_eq!(
            args.package,
            Some(PathBuf::from("C:\\Temp\\OpenHeaders-2026.11.3-beta.6-arm64.msix"))
        );
        assert_eq!(args.log, Some(PathBuf::from("C:\\Temp\\install.log")));
    }

    #[test]
    fn a_value_may_follow_an_equals_sign() {
        let args = parse_words(&["--channel=stable", "--log=C:\\a=b.log"]).unwrap();
        assert_eq!(args.channel, Some(Channel::Stable));
        assert_eq!(args.log, Some(PathBuf::from("C:\\a=b.log")));
    }

    #[test]
    fn a_switch_without_its_value_is_refused() {
        assert_eq!(
            parse_words(&["--channel"]),
            Err("--channel expects a value".to_string())
        );
        assert_eq!(
            parse_words(&["--package="]),
            Err("--package expects a value".to_string())
        );
    }

    const MOVE: [&str; 8] = [
        "--move-app",
        "C:\\Users\\John Doe\\AppData\\Local\\Programs\\open-headers\\OpenHeaders.exe",
        "--move-app-pid",
        "4312",
        "--move-uninstaller",
        "C:\\Users\\John Doe\\AppData\\Local\\Programs\\open-headers\\Uninstall OpenHeaders.exe",
        "--move-note",
        "C:\\Users\\John Doe\\AppData\\Roaming\\OpenHeaders\\move-to-package.json",
    ];

    #[test]
    fn a_move_is_its_four_switches() {
        let args = parse_words(&MOVE).unwrap();
        assert_eq!(
            args.classic,
            Some(ClassicInstall {
                app: PathBuf::from(MOVE[1]),
                app_pid: 4312,
                uninstaller: PathBuf::from(MOVE[5]),
                note: PathBuf::from(MOVE[7]),
            })
        );
        assert!(!args.silent && args.package.is_none());
    }

    #[test]
    fn a_move_named_in_part_is_refused() {
        for missing in [0, 2, 4, 6] {
            let mut words = MOVE.to_vec();
            words.drain(missing..missing + 2);
            assert_eq!(
                parse_words(&words),
                Err("a move takes --move-app, --move-app-pid, --move-uninstaller and --move-note together".to_string()),
                "without {}",
                MOVE[missing]
            );
        }
    }

    #[test]
    fn a_moves_process_is_a_number_and_a_move_always_starts_the_package() {
        for pid in ["0", "-4", "the app"] {
            let mut words = MOVE.to_vec();
            words[3] = pid;
            assert_eq!(
                parse_words(&words),
                Err(format!("--move-app-pid is a process id, not '{pid}'"))
            );
        }
        let mut words = MOVE.to_vec();
        words.push("--no-launch");
        assert_eq!(
            parse_words(&words),
            Err("--no-launch does not go with a move".to_string())
        );
    }

    #[test]
    fn an_unknown_channel_or_switch_is_refused() {
        assert!(parse_words(&["--channel", "nightly"]).is_err());
        assert_eq!(parse_words(&["--quiet"]), Err("unknown switch '--quiet'".to_string()));
        assert_eq!(parse_words(&["--silent=1"]), Err("--silent takes no value".to_string()));
    }
}
