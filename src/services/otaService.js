import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import * as Updates from 'expo-updates';
import axios from 'axios';
import { API_ORIGIN } from '../lib/api';

const OTA_STORAGE_KEYS = {
  CURRENT_VERSION: 'pantro_ota_current_version',
  LAST_CHECKED: 'pantro_ota_last_checked',
  PENDING_RESTART: 'pantro_ota_pending_restart',
  RELEASE_NOTES: 'pantro_ota_release_notes',
};

export const NATIVE_APP_VERSION = Constants.expoConfig?.version || '1.0.16';
export const NATIVE_BUILD_NUMBER =
  Platform.OS === 'android'
    ? Constants.expoConfig?.android?.versionCode || 10
    : Constants.expoConfig?.ios?.buildNumber || '6';
export const RUNTIME_VERSION =
  Updates.runtimeVersion || Constants.expoConfig?.runtimeVersion || '1.1.0';

class OtaService {
  /**
   * Ask the native expo-updates client whether a new update is available and
   * fetch it. This is the only source of truth for whether an update can
   * actually be applied — the custom /check-update endpoint is only UI info.
   */
  async fetchNativeUpdate() {
    if (!Updates.isEnabled || !Updates.checkForUpdateAsync || !Updates.fetchUpdateAsync) {
      return { enabled: false, available: false, fetched: false };
    }

    const check = await Updates.checkForUpdateAsync();
    if (!check?.isAvailable) {
      return { enabled: true, available: false, fetched: false };
    }

    await Updates.fetchUpdateAsync();
    return { enabled: true, available: true, fetched: true };
  }

  /**
   * Get currently active OTA version or 'Base Binary'
   */
  async getInstalledVersionInfo() {
    try {
      const storedVersion = await AsyncStorage.getItem(OTA_STORAGE_KEYS.CURRENT_VERSION);
      const lastChecked = await AsyncStorage.getItem(OTA_STORAGE_KEYS.LAST_CHECKED);
      const updateId = Updates.updateId ?? null;
      const isEmbedded = Updates.isEmbeddedLaunch ?? !updateId;

      // If an OTA bundle is already running, any "pending restart" marker is
      // stale (the update was applied by expo-updates on launch).
      if (!isEmbedded) {
        await AsyncStorage.removeItem(OTA_STORAGE_KEYS.PENDING_RESTART);
      }

      const manifestVer =
        Updates.manifest?.metadata?.version ||
        Updates.manifest?.extra?.version ||
        null;
      const otaVersion = isEmbedded ? null : (manifestVer || storedVersion);

      return {
        nativeVersion: NATIVE_APP_VERSION,
        buildNumber: NATIVE_BUILD_NUMBER,
        runtimeVersion: RUNTIME_VERSION,
        otaVersion,
        displayVersion: otaVersion ? `v${otaVersion} (OTA)` : `v${NATIVE_APP_VERSION}`,
        updateId,
        isEmbedded,
        channel: Updates.channel || 'production',
        lastChecked: lastChecked ? new Date(lastChecked) : null,
        isUpdatesEnabled: Updates.isEnabled ?? false,
      };
    } catch (e) {
      return {
        nativeVersion: NATIVE_APP_VERSION,
        buildNumber: NATIVE_BUILD_NUMBER,
        runtimeVersion: RUNTIME_VERSION,
        otaVersion: null,
        displayVersion: `v${NATIVE_APP_VERSION}`,
        updateId: null,
        isEmbedded: true,
        channel: 'production',
        lastChecked: null,
        isUpdatesEnabled: false,
      };
    }
  }

  /**
   * Check Superadmin / Backend for available OTA updates
   */
  async checkForUpdate() {
    try {
      const currentOtaVersion = await AsyncStorage.getItem(OTA_STORAGE_KEYS.CURRENT_VERSION);
      const url = `${API_ORIGIN}/api/ota/check-update`;

      const response = await axios.get(url, {
        params: {
          app: 'tenant',
          platform: Platform.OS,
          nativeVersion: NATIVE_APP_VERSION,
          buildNumber: NATIVE_BUILD_NUMBER,
          currentOtaVersion: currentOtaVersion || '',
          runtimeVersion: RUNTIME_VERSION,
        },
        timeout: 15000,
      });

      await AsyncStorage.setItem(OTA_STORAGE_KEYS.LAST_CHECKED, new Date().toISOString());

      if (response.data && response.data.updateAvailable && response.data.update) {
        return {
          updateAvailable: true,
          update: response.data.update,
        };
      }

      return {
        updateAvailable: false,
        message: response.data?.message || 'App is up to date',
      };
    } catch (error) {
      console.warn('[OTA] Check update failed:', error?.message || error);
      return {
        updateAvailable: false,
        error: error?.message || 'Network error while checking for updates',
      };
    }
  }

  /**
   * Download and apply an update package
   */
  async downloadAndApplyUpdate(update, onProgress) {
    if (!update) throw new Error('No update specified');

    try {
      if (onProgress) onProgress(0.2, 'Connecting to update server...');

      if (onProgress) onProgress(0.4, 'Downloading update bundle...');
      const native = await this.fetchNativeUpdate();

      if (!native.enabled) {
        console.log('[OTA] Native Updates.isEnabled is false (running in dev/Expo Go)');
        return { success: false, nativeFetched: false, message: 'Updates are disabled in this environment' };
      }
      if (!native.available) {
        return { success: false, nativeFetched: false, message: 'No update is available from the native updater' };
      }

      if (onProgress) onProgress(0.7, 'Verifying bundle integrity...');

      // Mark version as downloaded in AsyncStorage
      await AsyncStorage.setItem(OTA_STORAGE_KEYS.CURRENT_VERSION, update.version);
      await AsyncStorage.setItem(OTA_STORAGE_KEYS.PENDING_RESTART, 'true');
      if (update.releaseNotes) {
        await AsyncStorage.setItem(OTA_STORAGE_KEYS.RELEASE_NOTES, update.releaseNotes);
      }

      if (onProgress) onProgress(0.9, 'Finalizing update...');

      // Report success telemetry to SuperAdmin
      this.reportStatus(update.id, 'success').catch(() => {});

      if (onProgress) onProgress(1.0, 'Update ready!');

      return { success: true, nativeFetched: true };
    } catch (error) {
      console.error('[OTA] Download & Apply failed:', error);
      this.reportStatus(update.id, 'failure', error?.message).catch(() => {});
      throw error;
    }
  }

  /**
   * Download update silently in the background without asking or blocking user
   */
  async downloadSilently(update) {
    if (!update) return false;
    try {
      console.log(`[OTA:Silent] Downloading update v${update.version} in background...`);
      const native = await this.fetchNativeUpdate();

      if (!native.enabled) {
        console.log('[OTA:Silent] Native updates disabled; nothing to apply.');
        return false;
      }
      if (!native.available) {
        console.log('[OTA:Silent] Native updater reports no update available; keeping current version.');
        return false;
      }

      await AsyncStorage.setItem(OTA_STORAGE_KEYS.CURRENT_VERSION, update.version);
      await AsyncStorage.setItem(OTA_STORAGE_KEYS.PENDING_RESTART, 'true');
      if (update.releaseNotes) {
        await AsyncStorage.setItem(OTA_STORAGE_KEYS.RELEASE_NOTES, update.releaseNotes);
      }

      // Telemetry
      this.reportStatus(update.id, 'success').catch(() => {});
      console.log(`[OTA:Silent] Update v${update.version} ready! Will apply automatically on next restart/background.`);
      return true;
    } catch (e) {
      console.warn('[OTA:Silent] Silent background download error:', e.message);
      this.reportStatus(update.id, 'failure', e.message).catch(() => {});
      return false;
    }
  }

  /**
   * Check if a silent update has been downloaded and is waiting for restart
   */
  async isPendingRestart() {
    try {
      const val = await AsyncStorage.getItem(OTA_STORAGE_KEYS.PENDING_RESTART);
      return val === 'true';
    } catch {
      return false;
    }
  }

  /**
   * Clear the pending restart flag
   */
  async clearPendingRestart() {
    try {
      await AsyncStorage.removeItem(OTA_STORAGE_KEYS.PENDING_RESTART);
    } catch {}
  }

  /**
   * Restart the app to apply the newly downloaded bundle
   */
  async reloadApp() {
    try {
      if (Updates.isEnabled && Updates.reloadAsync) {
        await Updates.reloadAsync();
      } else {
        // Fallback for dev / unlinked environments
        console.log('[OTA] Reloading app...');
      }
    } catch (err) {
      console.warn('[OTA] Reload error:', err);
    }
  }

  /**
   * Report adoption or error back to Superadmin
   */
  async reportStatus(releaseId, status, error = null) {
    try {
      if (!releaseId) return;
      await axios.post(
        `${API_ORIGIN}/api/ota/report-status`,
        {
          releaseId,
          status,
          error,
          app: 'tenant',
          platform: Platform.OS,
          nativeVersion: NATIVE_APP_VERSION,
        },
        { timeout: 8000 }
      );
    } catch (_) {
      // Non-critical telemetry ping
    }
  }
}

export const otaService = new OtaService();
export default otaService;
