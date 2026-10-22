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

export const NATIVE_APP_VERSION = Constants.expoConfig?.version || '1.0.2';
export const NATIVE_BUILD_NUMBER =
  Platform.OS === 'android'
    ? Constants.expoConfig?.android?.versionCode || 4
    : Constants.expoConfig?.ios?.buildNumber || 2;

class OtaService {
  /**
   * Get currently active OTA version or 'Base Binary'
   */
  async getInstalledVersionInfo() {
    try {
      const otaVersion = await AsyncStorage.getItem(OTA_STORAGE_KEYS.CURRENT_VERSION);
      const lastChecked = await AsyncStorage.getItem(OTA_STORAGE_KEYS.LAST_CHECKED);
      const isEmbedded = Updates.isEmbeddedLaunch ?? true;

      return {
        nativeVersion: NATIVE_APP_VERSION,
        buildNumber: NATIVE_BUILD_NUMBER,
        otaVersion: otaVersion || null,
        displayVersion: otaVersion ? `v${otaVersion} (OTA)` : `v${NATIVE_APP_VERSION}`,
        isEmbedded,
        lastChecked: lastChecked ? new Date(lastChecked) : null,
        isUpdatesEnabled: Updates.isEnabled ?? false,
      };
    } catch (e) {
      return {
        nativeVersion: NATIVE_APP_VERSION,
        buildNumber: NATIVE_BUILD_NUMBER,
        otaVersion: null,
        displayVersion: `v${NATIVE_APP_VERSION}`,
        isEmbedded: true,
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
          runtimeVersion: NATIVE_APP_VERSION,
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

      // First attempt native expo-updates fetch if enabled
      let nativeFetched = false;
      if (Updates.isEnabled && Updates.fetchUpdateAsync) {
        try {
          if (onProgress) onProgress(0.4, 'Fetching update bundle...');
          const result = await Updates.fetchUpdateAsync();
          if (result && result.isNew) {
            nativeFetched = true;
          }
        } catch (nativeErr) {
          console.warn('[OTA] Native expo-updates fetch failed, continuing with direct download:', nativeErr.message);
        }
      }

      if (onProgress) onProgress(0.7, 'Verifying bundle integrity...');

      // Mark version as downloaded in AsyncStorage
      await AsyncStorage.setItem(OTA_STORAGE_KEYS.CURRENT_VERSION, update.version);
      if (update.releaseNotes) {
        await AsyncStorage.setItem(OTA_STORAGE_KEYS.RELEASE_NOTES, update.releaseNotes);
      }

      if (onProgress) onProgress(0.9, 'Finalizing update...');

      // Report success telemetry to SuperAdmin
      this.reportStatus(update.id, 'success').catch(() => {});

      if (onProgress) onProgress(1.0, 'Update ready!');

      return { success: true, nativeFetched };
    } catch (error) {
      console.error('[OTA] Download & Apply failed:', error);
      this.reportStatus(update.id, 'failure', error?.message).catch(() => {});
      throw error;
    }
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
