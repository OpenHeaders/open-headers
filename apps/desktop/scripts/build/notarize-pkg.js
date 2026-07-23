const { execFileSync } = require('child_process');

// afterSign (notarize.js) covers only the .app — the pkg installers are
// assembled afterwards, and Gatekeeper assesses a downloaded pkg on its
// own signature + notarization, not the payload's. This hook notarizes
// and staples every mac .pkg once all artifacts exist. An unsigned pkg
// (no Developer ID Installer identity in the keychain) is skipped with
// a warning instead of failing the leg — same degrade contract as the
// Windows signing steps.
async function notarizePkgs(buildResult) {
    if (process.platform !== 'darwin') return [];

    const pkgs = (buildResult.artifactPaths || []).filter((p) => p.endsWith('.pkg'));
    if (pkgs.length === 0) return [];

    if (process.env.CSC_IDENTITY_AUTO_DISCOVERY === 'false') {
        console.log('⏭️ Skipping pkg notarization for unsigned build (CSC_IDENTITY_AUTO_DISCOVERY=false)');
        return [];
    }

    const missingVars = ['APPLE_ID', 'APPLE_APP_SPECIFIC_PASSWORD', 'APPLE_TEAM_ID'].filter(
        (key) => !process.env[key]
    );
    if (missingVars.length > 0) {
        console.log(`⚠️ Skipping pkg notarization: Missing required environment variables: ${missingVars.join(', ')}`);
        return [];
    }

    for (const pkgPath of pkgs) {
        let signed = true;
        try {
            const check = execFileSync('pkgutil', ['--check-signature', pkgPath], { encoding: 'utf8' });
            signed = !check.includes('no signature');
        } catch {
            signed = false;
        }
        if (!signed) {
            console.warn(`⚠️ ${pkgPath} is unsigned (no Developer ID Installer identity?) — skipping notarization`);
            continue;
        }

        console.log(`📝 Notarizing ${pkgPath}`);
        execFileSync(
            'xcrun',
            [
                'notarytool',
                'submit',
                pkgPath,
                '--apple-id',
                process.env.APPLE_ID,
                '--password',
                process.env.APPLE_APP_SPECIFIC_PASSWORD,
                '--team-id',
                process.env.APPLE_TEAM_ID,
                '--wait',
            ],
            { stdio: 'inherit' }
        );
        execFileSync('xcrun', ['stapler', 'staple', pkgPath], { stdio: 'inherit' });
        console.log(`✅ Notarized and stapled ${pkgPath}`);
    }
    return [];
}

module.exports = notarizePkgs;
