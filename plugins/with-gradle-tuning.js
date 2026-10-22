/**
 * with-gradle-tuning.js
 *
 * Keeps our Gradle tuning inside `android/gradle.properties` across
 * `expo prebuild --clean` runs. Prebuild regenerates the whole `android/`
 * folder from the React Native template, which wipes any manual edit.
 *
 * Flags
 * -----
 *   org.gradle.caching=false
 *       Disables the local task-output build cache. Release builds stay
 *       reproducible (every task is re-executed from its inputs).
 *   org.gradle.vfs.watch=false
 *       File-system watching goes stale on Windows and makes Gradle miss
 *       changes to generated sources.
 *
 * The "Could not read workspace metadata from ...\metadata.bin" failures
 * ---------------------------------------------------------------------
 * Those are NOT fixed by a Gradle property - they are repaired, not
 * configured away.
 *
 * Gradle unpacks every artifact transform into
 *
 *     %GRADLE_USER_HOME%\caches\<version>\transforms\<hash>\
 *         transformed\...   <- the unpacked artifact
 *         metadata.bin      <- cache metadata (written last)
 *
 * The react-android AAR contains prefab C++ headers that unpack to paths of
 * ~290 characters. Windows MAX_PATH is 260 and LongPathsEnabled is 0 on this
 * machine, so Gradle cannot delete those files when it invalidates the
 * transform. The entry is then left half-written (transformed\ populated,
 * metadata.bin gone) and every later build that needs that artifact fails
 * with "Could not read workspace metadata from ...\metadata.bin".
 *
 * `scripts/repair-gradle-transform-cache.ps1` deletes those orphaned entries
 * (using the \\?\ extended-length path syntax so the long paths can actually
 * be removed) and is run automatically by `scripts/build-android-release.ps1`.
 *
 * Enabling Windows long paths removes the root cause:
 *   setx /f HKLM\SYSTEM\CurrentControlSet\Control\FileSystem LongPathsEnabled 1
 * (requires an elevated prompt and a reboot).
 */
const fs = require('fs');
const path = require('path');
const { withDangerousMod } = require('expo/config-plugins');

const FLAGS = {
  'org.gradle.caching': 'false',
  'org.gradle.vfs.watch': 'false',
};

// Properties that earlier versions of this plugin added. `org.gradle.unsafe.
// transform-cache` is not a real Gradle property - it is silently ignored and
// only gave the false impression that the transform cache was disabled.
const OBSOLETE_FLAGS = ['org.gradle.unsafe.transform-cache'];

// Marker used by this plugin to annotate added properties.
const MARKER = '# Added by plugins/with-gradle-tuning.js';

module.exports = function withGradleTuning(config) {
  return withDangerousMod(config, [
    'android',
    async (cfg) => {
      const propsFile = path.join(cfg.modRequest.projectRoot, 'android', 'gradle.properties');
      if (!fs.existsSync(propsFile)) return cfg;

      let lines = fs.readFileSync(propsFile, 'utf8').split(/\r?\n/);

      // Drop the no-op properties, plus the "# Added by ..." marker that
      // introduced them (otherwise it would annotate nothing).
      lines = lines.filter((line, index) => {
        const trimmed = line.trim();
        if (OBSOLETE_FLAGS.some((key) => trimmed.startsWith(`${key}=`))) return false;
        if (trimmed === MARKER) {
          const next = (lines[index + 1] || '').trim();
          const nextIsObsolete = OBSOLETE_FLAGS.some((key) => next.startsWith(`${key}=`));
          return !nextIsObsolete;
        }
        return true;
      });

      for (const [key, value] of Object.entries(FLAGS)) {
        const entry = `${key}=${value}`;
        const idx = lines.findIndex((line) => line.trim().startsWith(`${key}=`));
        if (idx >= 0) {
          if (lines[idx].trim() !== entry) lines[idx] = entry;
        } else {
          lines.push('', '# Added by plugins/with-gradle-tuning.js', entry);
        }
      }

      fs.writeFileSync(propsFile, lines.join('\n'), 'utf8');
      return cfg;
    },
  ]);
};
