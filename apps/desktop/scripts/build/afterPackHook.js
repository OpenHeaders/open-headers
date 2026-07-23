const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

// Compiles the SMAppService trust helper (dual-mode Swift binary) and
// embeds it with its launchd plist. Runs before signing, so the helper
// is signed and sealed with the app. A missing Swift toolchain skips
// the helper — the daemon's capability probe then stays honestly off.
function embedMacTrustHelper(context) {
    const { appOutDir } = context;
    const helperSrcDir = path.join(__dirname, '..', '..', 'build', 'mac', 'trust-helper');
    const appName = context.packager.appInfo.productFilename;
    const contentsDir = path.join(appOutDir, `${appName}.app`, 'Contents');
    const sources = fs.readdirSync(helperSrcDir)
        .filter((f) => f.endsWith('.swift'))
        .sort()
        .map((f) => path.join(helperSrcDir, f));
    // electron-builder Arch enum: 1 = x64, 3 = arm64, 4 = universal
    const archNames = context.arch === 1 ? ['x86_64'] : context.arch === 3 ? ['arm64'] : ['arm64', 'x86_64'];
    const binaryPath = path.join(contentsDir, 'MacOS', 'oh-trust-helper');
    const slicePaths = [];
    try {
        for (const archName of archNames) {
            const slicePath = archNames.length === 1 ? binaryPath : `${binaryPath}-${archName}`;
            execFileSync('xcrun', [
                'swiftc', '-O',
                '-target', `${archName}-apple-macos13.0`,
                '-o', slicePath,
                ...sources
            ], { stdio: 'pipe' });
            slicePaths.push(slicePath);
        }
        if (slicePaths.length > 1) {
            execFileSync('lipo', ['-create', ...slicePaths, '-output', binaryPath], { stdio: 'pipe' });
            for (const slicePath of slicePaths) fs.rmSync(slicePath);
        }
    } catch (error) {
        console.warn('⚠ Trust helper compile failed — System-keychain trust will stay unavailable in this build');
        console.warn(`  ${error.message}`);
        for (const slicePath of slicePaths) fs.rmSync(slicePath, { force: true });
        fs.rmSync(binaryPath, { force: true });
        return;
    }
    signMacTrustHelper(binaryPath);
    const daemonsDir = path.join(contentsDir, 'Library', 'LaunchDaemons');
    fs.mkdirSync(daemonsDir, { recursive: true });
    fs.copyFileSync(
        path.join(helperSrcDir, 'io.openheaders.trust-helper.plist'),
        path.join(daemonsDir, 'io.openheaders.trust-helper.plist')
    );
    console.log(`✓ Trust helper embedded (${archNames.join('+')})`);
}

// electron-builder's signing walk over Contents/MacOS is alphabetical and
// 'OpenHeaders' sorts before 'oh-trust-helper', so the main-binary seal
// sees an unsigned nested binary and codesign refuses. Pre-signing the
// helper makes the walk order irrelevant; electron-builder's --force
// re-sign later in the pass keeps the seal consistent. Unsigned lanes
// (CSC_IDENTITY_AUTO_DISCOVERY=false) and keychains without a signing
// identity skip this — those builds are never sealed anyway.
function signMacTrustHelper(binaryPath) {
    if (process.env.CSC_IDENTITY_AUTO_DISCOVERY === 'false') return;
    let identity = '';
    try {
        const out = execFileSync('security', ['find-identity', '-v', '-p', 'codesigning'], { encoding: 'utf8' });
        identity = (out.match(/\b([0-9A-F]{40})\b/) || [])[1] || '';
    } catch {
        return;
    }
    if (!identity) return;
    execFileSync('codesign', ['--sign', identity, '--force', '--timestamp', '--options', 'runtime', binaryPath], {
        stdio: 'pipe',
    });
    console.log('✓ Trust helper signed');
}

exports.default = async function(context) {
    const { appOutDir, electronPlatformName } = context;

    if (electronPlatformName === 'darwin') {
        embedMacTrustHelper(context);
        return;
    }

    // Windows builds - verify native module is included
    if (electronPlatformName === 'win32') {
        console.log('Running afterPack hook for Windows build...');
        console.log('App output directory:', appOutDir);
        
        // Debug: Check various possible locations for the module
        const possiblePaths = [
            path.join(appOutDir, 'resources', 'app.asar.unpacked', 'node_modules', '@openheaders', 'windows-foreground'),
            path.join(appOutDir, 'resources', 'app.asar.unpacked', 'node_modules', '@openheaders'),
            path.join(appOutDir, 'resources', 'app.asar.unpacked', 'node_modules'),
            path.join(process.cwd(), 'node_modules', '@openheaders', 'windows-foreground'),
            path.join(process.cwd(), 'node_modules', '@openheaders')
        ];
        
        console.log('DEBUG: Checking for module in various locations...');
        for (const checkPath of possiblePaths) {
            if (fs.existsSync(checkPath)) {
                console.log(`  ✓ Path exists: ${checkPath}`);
                // List contents if it's a directory
                if (fs.statSync(checkPath).isDirectory()) {
                    const contents = fs.readdirSync(checkPath);
                    console.log(`    Contents: ${contents.join(', ')}`);
                }
            } else {
                console.log(`  ✗ Path not found: ${checkPath}`);
            }
        }
        
        // Check if @openheaders/windows-foreground is in the unpacked resources
        const nativeModulePath = path.join(appOutDir, 'resources', 'app.asar.unpacked', 'node_modules', '@openheaders', 'windows-foreground');
        
        if (fs.existsSync(nativeModulePath)) {
            console.log('✓ @openheaders/windows-foreground module found in unpacked resources');
            
            // List all files in the module directory
            console.log('Module directory contents:');
            const listFiles = (dir, prefix = '  ') => {
                const files = fs.readdirSync(dir);
                files.forEach(file => {
                    const filePath = path.join(dir, file);
                    const stat = fs.statSync(filePath);
                    if (stat.isDirectory()) {
                        console.log(`${prefix}📁 ${file}/`);
                        if (file !== 'node_modules') { // Avoid recursing into node_modules
                            listFiles(filePath, prefix + '  ');
                        }
                    } else {
                        console.log(`${prefix}📄 ${file} (${stat.size} bytes)`);
                    }
                });
            };
            listFiles(nativeModulePath);
            
            // Check for the native binding (multiple possible locations)
            const possibleBindings = [
                path.join(nativeModulePath, 'build', 'Release', 'foreground.node'),
                path.join(nativeModulePath, 'prebuilds', `win32-${process.arch}`, `node-${process.versions.modules}.node`),
                path.join(nativeModulePath, 'prebuilds', `win32-x64`, 'node.napi.node'),
                path.join(nativeModulePath, 'binding.node')
            ];
            
            console.log('Checking for native bindings...');
            let bindingFound = false;
            for (const bindingPath of possibleBindings) {
                if (fs.existsSync(bindingPath)) {
                    const stat = fs.statSync(bindingPath);
                    console.log(`  ✓ Native binding found: ${bindingPath} (${stat.size} bytes)`);
                    bindingFound = true;
                    break;
                } else {
                    console.log(`  ✗ Not found: ${bindingPath}`);
                }
            }
            
            if (!bindingFound) {
                console.warn('⚠ Native binding not found at expected locations');
                console.warn('  The module may not have been rebuilt for Electron');
            }
        } else {
            console.warn('⚠ @openheaders/windows-foreground module not found in unpacked resources');
            console.warn('  Expected path:', nativeModulePath);
            console.warn('  Windows focus enhancement will use fallback methods');
            
            // Check if it's in the source node_modules
            const sourceModulePath = path.join(process.cwd(), 'node_modules', '@openheaders', 'windows-foreground');
            if (fs.existsSync(sourceModulePath)) {
                console.log('  Note: Module exists in source node_modules at:', sourceModulePath);
                console.log('  It may not have been included in the asar.unpacked configuration');
            }
        }
        
        return;
    }

    // Handle Linux builds
    if (electronPlatformName !== 'linux') {
        return;
    }

    console.log('Running afterPack hook for Linux build...');

    // Path to the source file in dist-webpack/main (copied there by electron-vite build)
    const sourceFile = path.join(process.cwd(), 'dist-webpack', 'main', 'install-open-headers.sh');

    // Path where we want to copy the file
    const destDir = path.dirname(appOutDir);
    const destFile = path.join(destDir, 'install-open-headers.sh');

    try {
        if (fs.existsSync(sourceFile)) {
            // Copy the file to the dist directory (alongside the AppImage)
            fs.copyFileSync(sourceFile, destFile);
            // Make it executable
            fs.chmodSync(destFile, 0o755);
            console.log(`Successfully copied ${sourceFile} to ${destFile}`);
        } else {
            console.error(`Source file not found: ${sourceFile}`);
        }
    } catch (error) {
        console.error('Error copying install script:', error);
    }
};