#!/usr/bin/env node

/**
 * Pantro OTA Publishing Tool
 * ---------------------------------------------------------------------------
 * Exports and uploads an Over-The-Air JavaScript bundle directly to the
 * Pantro backend and SuperAdmin control center.
 *
 * Usage:
 *   npm run ota:publish -- --version 1.0.7 --notes "UI fixes and updates"
 *   npm run ota:publish -- --no-export --version 1.0.7
 *   npm run ota:publish -- --no-upload (to only export bundle)
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const projectRoot = path.resolve(__dirname, '..');
const distDir = path.join(projectRoot, 'dist');
const pkg = require(path.join(projectRoot, 'package.json'));

// Parse command line arguments
const args = process.argv.slice(2);
function getArg(flag, fallback = '') {
  const idx = args.indexOf(flag);
  if (idx !== -1 && args[idx + 1]) return args[idx + 1];
  return fallback;
}

const appName = getArg('--app', 'tenant');
const platform = getArg('--platform', 'android');
const version = getArg('--version', pkg.version || '1.0.3');
const targetNative = getArg('--native', '*');
const runtimeVersion = getArg('--runtime', '*');
const urgency = getArg('--urgency', 'mandatory'); // 'flexible' or 'mandatory'
const title = getArg('--title', `Pantro ${appName === 'tenant' ? 'Tenant' : 'Owner'} v${version}`);
const notes = getArg('--notes', 'Over-The-Air bug fixes and improvements.');
const apiBase = getArg('--api', 'https://stayverse-backend-zyl7.onrender.com/api');
const adminEmail = getArg('--email', process.env.SUPER_ADMIN_EMAIL || 'sahil@wabsyte.com');
const adminPassword = getArg('--password', process.env.SUPER_ADMIN_PASSWORD || 'mangal911$');
const shouldExport = !args.includes('--no-export');
const noUpload = args.includes('--no-upload');

console.log('----------------------------------------------------');
console.log(' Pantro OTA Bundle Publisher');
console.log('----------------------------------------------------');
console.log(`App:             ${appName}`);
console.log(`Platform:        ${platform}`);
console.log(`Release Version: v${version}`);
console.log(`Target Native:   ${targetNative}`);
console.log(`Runtime Version: ${runtimeVersion}`);
console.log(`Urgency:         ${urgency}`);
console.log(`API Target:      ${apiBase}`);
console.log('----------------------------------------------------\n');

// Step 1: Export bundle if requested
if (shouldExport) {
  console.log('[1/3] Exporting Expo bundle for Android...');
  try {
    execSync('npx expo export --platform android --output-dir dist', {
      cwd: projectRoot,
      stdio: 'inherit',
    });
  } catch (err) {
    console.error('Export failed:', err.message);
    process.exit(1);
  }
} else {
  console.log('[1/3] Skipping export (using existing dist directory)');
}

// Step 2: Locate the generated bundle file
console.log('\n[2/3] Locating exported bundle file...');
if (!fs.existsSync(distDir)) {
  console.error('Error: dist directory does not exist! Run export first.');
  process.exit(1);
}

function findBundleFile(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      const found = findBundleFile(fullPath);
      if (found) return found;
    } else if (entry.name.endsWith('.hbc') || entry.name.endsWith('.bundle')) {
      return fullPath;
    }
  }
  return null;
}

const bundlePath = findBundleFile(distDir);
if (!bundlePath) {
  console.error('Error: No .hbc or .bundle file found in dist directory!');
  process.exit(1);
}

const bundleStats = fs.statSync(bundlePath);
console.log(`Found bundle: ${bundlePath} (${(bundleStats.size / (1024 * 1024)).toFixed(2)} MB)`);

// Step 3: Direct automated upload or display SuperAdmin instructions
async function uploadToBackend() {
  if (noUpload) {
    console.log('\n[3/3] Ready for Superadmin Control Center!');
    console.log('====================================================');
    console.log('Bundle has been successfully compiled and verified:');
    console.log(`Path: ${bundlePath}`);
    console.log(`Size: ${(bundleStats.size / (1024 * 1024)).toFixed(2)} MB`);
    console.log('====================================================\n');
    console.log('To publish:');
    console.log('1. Open SuperAdmin Panel -> System & Tools -> OTA Updates');
    console.log('2. Click "Publish New OTA Update"');
    console.log(`3. Select "${appName === 'tenant' ? 'Tenant App' : 'Owner App'}", Version "${version}", and upload this bundle file:`);
    console.log(`   ${bundlePath}`);
    console.log('4. Toggle "Activate immediately upon upload" and click Publish!\n');
    return;
  }

  console.log('\n[3/3] Uploading bundle directly to Pantro Backend...');
  try {
    // 1. Authenticate as Super Admin
    const loginRes = await fetch(`${apiBase}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ identifier: adminEmail, password: adminPassword }),
    });
    const loginData = await loginRes.json();
    if (!loginData.success || !loginData.data?.token) {
      throw new Error(`Superadmin login failed: ${loginData.message || 'Check credentials'}`);
    }
    const token = loginData.data.token;
    console.log(`✓ Authenticated as ${loginData.data.user?.name || 'Super Admin'}`);

    // 2. Prepare FormData payload
    const fileBytes = fs.readFileSync(bundlePath);
    const form = new FormData();
    form.append('app', appName);
    form.append('platform', platform);
    form.append('version', version);
    form.append('targetNativeVersion', targetNative);
    form.append('runtimeVersion', runtimeVersion);
    form.append('updateType', urgency);
    form.append('title', title);
    form.append('releaseNotes', notes);
    form.append('status', 'active');
    form.append(
      'bundle',
      new Blob([fileBytes], { type: 'application/octet-stream' }),
      `${appName}-${version}.hbc`
    );

    // 3. Upload release
    console.log('Uploading and activating release...');
    const uploadRes = await fetch(`${apiBase}/ota/admin/releases`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
      },
      body: form,
    });
    const uploadData = await uploadRes.json();
    if (!uploadData.success) {
      throw new Error(`Upload failed: ${uploadData.message || 'Unknown error'}`);
    }

    console.log('\n====================================================');
    console.log(`🚀 OTA Release v${version} is now LIVE on Pantro!`);
    console.log(`Release ID:      ${uploadData.data?._id}`);
    console.log(`Bundle URL:      ${uploadData.data?.bundleUrl}`);
    console.log(`Bundle Hash:     ${uploadData.data?.bundleHash}`);
    console.log(`Target Native:   ${uploadData.data?.targetNativeVersion}`);
    console.log(`Runtime Version: ${uploadData.data?.runtimeVersion}`);
    console.log('====================================================\n');
    console.log('All devices running Pantro Tenant will download this update automatically on app launch!\n');
  } catch (err) {
    console.error('\nDirect upload error:', err.message);
    console.log('\nFallback: You can still upload manually via SuperAdmin Panel:');
    console.log(`Bundle file: ${bundlePath}\n`);
    process.exit(1);
  }
}

uploadToBackend();
