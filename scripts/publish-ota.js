#!/usr/bin/env node

/**
 * Pantro OTA Publishing Tool (Cross-Platform: Android & iOS)
 * ---------------------------------------------------------------------------
 * Exports and uploads an Over-The-Air JavaScript bundle directly to the
 * Pantro backend and SuperAdmin control center.
 *
 * Features:
 *   - Auto-increments patch version on every push (e.g. 1.0.4 -> 1.0.5 -> 1.0.6)
 *   - Syncs bumped version across package.json, app.json, and Expo.plist
 *   - Exports and publishes for both Android and iOS
 *   - Safe flexible background updates with zero user popups
 *
 * Usage:
 *   npm run ota:publish                                      # Auto-bumps version & publishes for Android + iOS
 *   npm run ota:publish -- --platform android                # Publishes for Android only
 *   npm run ota:publish -- --platform ios                    # Publishes for iOS only
 *   npm run ota:publish -- --version 1.0.8                   # Uses explicit version without bumping
 *   npm run ota:publish -- --no-bump                         # Keeps current version without bumping
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const projectRoot = path.resolve(__dirname, '..');
const distDir = path.join(projectRoot, 'dist');
const pkgPath = path.join(projectRoot, 'package.json');
const pkg = require(pkgPath);

// Parse command line arguments
const args = process.argv.slice(2);
function getArg(flag, fallback = null) {
  const idx = args.indexOf(flag);
  if (idx !== -1 && args[idx + 1]) return args[idx + 1];
  return fallback;
}

function bumpSemver(ver) {
  const parts = ver.replace(/[^0-9.]/g, '').split('.').map(Number);
  while (parts.length < 3) parts.push(0);
  parts[2] += 1;
  return parts.join('.');
}

// Auto-bump version handling
const explicitVersion = getArg('--version');
const noBump = args.includes('--no-bump');

let version;
const currentVer = pkg.version || '1.0.4';

if (explicitVersion) {
  version = explicitVersion;
} else if (noBump) {
  version = currentVer;
} else {
  // Auto-increment version on every push
  version = bumpSemver(currentVer);

  // 1. Sync package.json
  pkg.version = version;
  fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + '\n', 'utf8');

  // 2. Sync app.json
  const appJsonPath = path.join(projectRoot, 'app.json');
  if (fs.existsSync(appJsonPath)) {
    try {
      const appJson = JSON.parse(fs.readFileSync(appJsonPath, 'utf8'));
      if (appJson.expo) {
        appJson.expo.version = version;
        appJson.expo.runtimeVersion = version;
        fs.writeFileSync(appJsonPath, JSON.stringify(appJson, null, 2) + '\n', 'utf8');
      }
    } catch (_) {}
  }

  // 3. Sync ios Expo.plist if exists
  const expoPlistPath = path.join(projectRoot, 'ios', 'PantroTenant', 'Supporting', 'Expo.plist');
  if (fs.existsSync(expoPlistPath)) {
    try {
      let plistContent = fs.readFileSync(expoPlistPath, 'utf8');
      plistContent = plistContent.replace(
        /<key>EXUpdatesRuntimeVersion<\/key>\s*<string>[^<]+<\/string>/,
        `<key>EXUpdatesRuntimeVersion</key>\r\n    <string>${version}</string>`
      );
      fs.writeFileSync(expoPlistPath, plistContent, 'utf8');
    } catch (_) {}
  }

  console.log(`\n✨ Auto-bumped OTA Release version: v${currentVer} -> v${version}\n`);
}

const appName = getArg('--app', 'tenant');
const requestedPlatform = getArg('--platform', 'all'); // 'all', 'android', or 'ios'
const targetNative = getArg('--native', '*');
const runtimeVersion = getArg('--runtime', '*');
const urgency = getArg('--urgency', 'flexible'); // Safe flexible background updates
const title = getArg('--title', `Pantro ${appName === 'tenant' ? 'Tenant' : 'Owner'} v${version}`);
const notes = getArg('--notes', 'Over-The-Air bug fixes and improvements.');
const apiBase = getArg('--api', 'https://stayverse-backend-zyl7.onrender.com/api');
const adminEmail = getArg('--email', process.env.SUPER_ADMIN_EMAIL || 'sahil@wabsyte.com');
const adminPassword = getArg('--password', process.env.SUPER_ADMIN_PASSWORD || 'mangal911$');
const shouldExport = !args.includes('--no-export');
const noUpload = args.includes('--no-upload');

const platformsToPublish =
  requestedPlatform === 'all' ? ['android', 'ios'] : [requestedPlatform];

console.log('----------------------------------------------------');
console.log(' Pantro OTA Bundle Publisher (Multi-Platform)');
console.log('----------------------------------------------------');
console.log(`App:             ${appName}`);
console.log(`Target Platform: ${requestedPlatform} (${platformsToPublish.join(', ')})`);
console.log(`Release Version: v${version}`);
console.log(`Target Native:   ${targetNative}`);
console.log(`Runtime Version: ${runtimeVersion}`);
console.log(`Urgency:         ${urgency} (Silent background mode)`);
console.log(`API Target:      ${apiBase}`);
console.log('----------------------------------------------------\n');

function findBundleFile(dir, targetPlatform) {
  if (targetPlatform) {
    const platformDir = path.join(dir, '_expo', 'static', 'js', targetPlatform);
    if (fs.existsSync(platformDir)) {
      const files = fs.readdirSync(platformDir);
      const match = files.find(
        (f) => f.endsWith('.hbc') || f.endsWith('.bundle') || f.endsWith('.js')
      );
      if (match) return path.join(platformDir, match);
    }
  }

  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      const found = findBundleFile(fullPath, targetPlatform);
      if (found) return found;
    } else if (
      entry.name.endsWith('.hbc') ||
      entry.name.endsWith('.bundle') ||
      entry.name.endsWith('.js')
    ) {
      return fullPath;
    }
  }
  return null;
}

async function publishForPlatform(platform, token) {
  console.log(`\n====================================================`);
  console.log(`>> Processing OTA Release for Platform: [${platform.toUpperCase()}]`);
  console.log(`====================================================`);

  // Step 1: Export bundle
  if (shouldExport) {
    console.log(`[1/3] Exporting Expo bundle for ${platform}...`);
    try {
      execSync(`npx expo export --platform ${platform} --output-dir dist`, {
        cwd: projectRoot,
        stdio: 'inherit',
      });
    } catch (err) {
      console.error(`Export failed for ${platform}:`, err.message);
      return false;
    }
  } else {
    console.log(`[1/3] Skipping export (using existing dist directory)`);
  }

  // Step 2: Locate bundle
  console.log(`\n[2/3] Locating exported bundle file for ${platform}...`);
  if (!fs.existsSync(distDir)) {
    console.error('Error: dist directory does not exist!');
    return false;
  }

  const bundlePath = findBundleFile(distDir, platform);
  if (!bundlePath) {
    console.error(`Error: No bundle file found for platform ${platform} in dist!`);
    return false;
  }

  const bundleStats = fs.statSync(bundlePath);
  console.log(`Found bundle: ${bundlePath} (${(bundleStats.size / (1024 * 1024)).toFixed(2)} MB)`);

  if (noUpload) {
    console.log(`[3/3] (--no-upload set) Bundle ready for manual upload: ${bundlePath}`);
    return true;
  }

  // Step 3: Upload
  console.log(`\n[3/3] Uploading ${platform} bundle directly to Pantro Backend...`);
  const fileBytes = fs.readFileSync(bundlePath);
  const form = new FormData();
  form.append('app', appName);
  form.append('platform', platform);
  form.append('version', version);
  form.append('targetNativeVersion', targetNative);
  form.append('runtimeVersion', runtimeVersion);
  form.append('updateType', urgency);
  form.append('title', `${title} (${platform.toUpperCase()})`);
  form.append('releaseNotes', notes);
  form.append('status', 'active');
  form.append(
    'bundle',
    new Blob([fileBytes], { type: 'application/javascript' }),
    `${appName}-${version}-${platform}.hbc`
  );

  const uploadRes = await fetch(`${apiBase}/ota/admin/releases`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
    },
    body: form,
  });
  const uploadData = await uploadRes.json();
  if (!uploadData.success) {
    throw new Error(`Upload failed for ${platform}: ${uploadData.message || 'Unknown error'}`);
  }

  console.log(`✓ OTA Release v${version} for [${platform.toUpperCase()}] is LIVE!`);
  console.log(`  Release ID:  ${uploadData.data?._id}`);
  console.log(`  Bundle URL:  ${uploadData.data?.bundleUrl}`);
  console.log(`  Bundle Hash: ${uploadData.data?.bundleHash}`);
  return true;
}

async function main() {
  let token = null;
  if (!noUpload) {
    console.log('Authenticating Super Admin credentials...');
    try {
      const loginRes = await fetch(`${apiBase}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ identifier: adminEmail, password: adminPassword }),
      });
      const loginData = await loginRes.json();
      if (!loginData.success || !loginData.data?.token) {
        throw new Error(`Superadmin login failed: ${loginData.message || 'Check credentials'}`);
      }
      token = loginData.data.token;
      console.log(`✓ Authenticated as ${loginData.data.user?.name || 'Super Admin'}\n`);
    } catch (err) {
      console.error('Authentication error:', err.message);
      process.exit(1);
    }
  }

  for (const plat of platformsToPublish) {
    const success = await publishForPlatform(plat, token);
    if (!success) {
      console.error(`\nFailed to publish OTA update for platform: ${plat}`);
      process.exit(1);
    }
  }

  console.log('\n====================================================');
  console.log(`🎉 ALL OTA RELEASES PUBLISHED SUCCESSFULLY!`);
  console.log(`New Version: v${version}`);
  console.log(`Platforms:   ${platformsToPublish.map((p) => p.toUpperCase()).join(', ')}`);
  console.log(`All devices (Android & iPhone) will receive updates automatically in background!`);
  console.log('====================================================\n');
}

main();
