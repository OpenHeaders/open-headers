//! Where the installer reads what to install: the channel's Windows
//! package pointer on the update feed — the file an installed package
//! reads to learn of an update.

pub const FEED_ORIGIN: &str = "https://updates.openheaders.com";

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Channel {
    Stable,
    Beta,
}

impl Channel {
    pub fn name(self) -> &'static str {
        match self {
            Channel::Stable => "stable",
            Channel::Beta => "beta",
        }
    }

    pub fn from_name(name: &str) -> Option<Channel> {
        match name {
            "stable" => Some(Channel::Stable),
            "beta" => Some(Channel::Beta),
            _ => None,
        }
    }

    /// The channel of the release an installer was built for: a beta's
    /// installer installs betas.
    pub fn of_release(version: &str) -> Channel {
        if version.contains("-beta.") {
            Channel::Beta
        } else {
            Channel::Stable
        }
    }
}

pub fn pointer_url(channel: Channel) -> String {
    format!("{FEED_ORIGIN}/desktop/{}/windows-package.json", channel.name())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn a_beta_release_reads_the_beta_pointer() {
        assert_eq!(Channel::of_release("2026.11.3-beta.6"), Channel::Beta);
        assert_eq!(
            pointer_url(Channel::Beta),
            "https://updates.openheaders.com/desktop/beta/windows-package.json"
        );
    }

    #[test]
    fn a_stable_release_reads_the_stable_pointer() {
        assert_eq!(Channel::of_release("2026.11.3"), Channel::Stable);
        assert_eq!(
            pointer_url(Channel::Stable),
            "https://updates.openheaders.com/desktop/stable/windows-package.json"
        );
    }

    #[test]
    fn channel_names_round_trip() {
        for channel in [Channel::Stable, Channel::Beta] {
            assert_eq!(Channel::from_name(channel.name()), Some(channel));
        }
        assert_eq!(Channel::from_name("nightly"), None);
    }
}
