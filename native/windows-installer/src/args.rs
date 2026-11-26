//! The installer's switches.
//!
//!   --silent            no window; the log and the exit code say how it went
//!   --channel <name>    `stable` or `beta`, in place of the build's own
//!   --package <file>    install this package file: nothing is downloaded
//!   --no-launch         do not open the app afterwards
//!   --log <file>        write the log there
//!
//! A value may also follow its switch after `=`.

use std::path::PathBuf;

use crate::feed::Channel;

#[derive(Debug, Default, PartialEq, Eq)]
pub struct Args {
    pub silent: bool,
    pub channel: Option<Channel>,
    pub package: Option<PathBuf>,
    pub no_launch: bool,
    pub log: Option<PathBuf>,
}

pub fn parse<I>(args: I) -> Result<Args, String>
where
    I: IntoIterator<Item = String>,
{
    let mut parsed = Args::default();
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
            "--silent" | "--no-launch" if inline.is_some() => return Err(format!("{name} takes no value")),
            "--silent" => parsed.silent = true,
            "--no-launch" => parsed.no_launch = true,
            other => return Err(format!("unknown switch '{other}'")),
        }
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

    #[test]
    fn an_unknown_channel_or_switch_is_refused() {
        assert!(parse_words(&["--channel", "nightly"]).is_err());
        assert_eq!(parse_words(&["--quiet"]), Err("unknown switch '--quiet'".to_string()));
        assert_eq!(parse_words(&["--silent=1"]), Err("--silent takes no value".to_string()));
    }
}
