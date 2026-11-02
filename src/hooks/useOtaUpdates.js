import { useState, useEffect, useCallback, useRef } from 'react';
import { AppState } from 'react-native';
import * as Updates from 'expo-updates';
import otaService from '../services/otaService';

export function useOtaUpdates({ autoCheck = true, checkDelayMs = 2500 } = {}) {
  const [isChecking, setIsChecking] = useState(false);
  const [updateAvailable, setUpdateAvailable] = useState(false);
  const [update, setUpdate] = useState(null);
  const [isDownloading, setIsDownloading] = useState(false);
  const [isPendingRestart, setIsPendingRestart] = useState(false);
  const [installedInfo, setInstalledInfo] = useState(null);
  const downloadingRef = useRef(false);

  const loadInstalledInfo = useCallback(async () => {
    const info = await otaService.getInstalledVersionInfo();
    const pending = await otaService.isPendingRestart();
    setInstalledInfo(info);
    setIsPendingRestart(pending);
    return info;
  }, []);

  /**
   * Check for updates and download silently in the background
   */
  const checkForUpdates = useCallback(async () => {
    if (downloadingRef.current) return;
    setIsChecking(true);
    try {
      await loadInstalledInfo();
      const res = await otaService.checkForUpdate();
      if (res.updateAvailable && res.update) {
        setUpdate(res.update);
        setUpdateAvailable(true);

        // SILENT BACKGROUND DOWNLOAD - Never interrupt user with modal
        downloadingRef.current = true;
        setIsDownloading(true);
        console.log(`[useOtaUpdates] New update v${res.update.version} found. Starting silent background download...`);

        otaService
          .downloadSilently(res.update)
          .then((success) => {
            setIsDownloading(false);
            downloadingRef.current = false;
            if (success) {
              setIsPendingRestart(true);
              loadInstalledInfo();
            }
          })
          .catch(() => {
            setIsDownloading(false);
            downloadingRef.current = false;
          });

        return { updateAvailable: true, update: res.update };
      } else {
        setUpdateAvailable(false);
        setUpdate(null);
        return { updateAvailable: false, message: res.message };
      }
    } catch (e) {
      console.warn('[useOtaUpdates] Silent check notice:', e?.message || e);
      return { updateAvailable: false, error: e?.message };
    } finally {
      setIsChecking(false);
    }
  }, [loadInstalledInfo]);

  // Listen to AppState: When user sends app to background and an update is ready,
  // reload the app in background so next time they open, the new version is active!
  useEffect(() => {
    const sub = AppState.addEventListener('change', async (nextState) => {
      if (nextState === 'background' || nextState === 'inactive') {
        const pending = await otaService.isPendingRestart();
        if (pending && Updates.isEnabled && Updates.reloadAsync) {
          console.log('[useOtaUpdates] App backgrounded. Reloading silently to apply downloaded update...');
          await otaService.clearPendingRestart();
          Updates.reloadAsync().catch(() => {});
        }
      }
    });
    return () => sub.remove();
  }, []);

  useEffect(() => {
    loadInstalledInfo();

    if (autoCheck) {
      const timer = setTimeout(() => {
        checkForUpdates();
      }, checkDelayMs);
      return () => clearTimeout(timer);
    }
  }, [autoCheck, checkDelayMs, checkForUpdates, loadInstalledInfo]);

  return {
    isChecking,
    updateAvailable,
    update,
    isDownloading,
    isPendingRestart,
    installedInfo,
    checkForUpdates,
    loadInstalledInfo,
  };
}

export default useOtaUpdates;
