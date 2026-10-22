import { useState, useEffect, useCallback } from 'react';
import otaService from '../services/otaService';

export function useOtaUpdates({ autoCheck = true, checkDelayMs = 2500 } = {}) {
  const [isChecking, setIsChecking] = useState(false);
  const [updateAvailable, setUpdateAvailable] = useState(false);
  const [update, setUpdate] = useState(null);
  const [isDownloading, setIsDownloading] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState(0);
  const [progressText, setProgressText] = useState('');
  const [installedInfo, setInstalledInfo] = useState(null);
  const [isDismissed, setIsDismissed] = useState(false);

  const loadInstalledInfo = useCallback(async () => {
    const info = await otaService.getInstalledVersionInfo();
    setInstalledInfo(info);
    return info;
  }, []);

  const checkForUpdates = useCallback(async () => {
    setIsChecking(true);
    try {
      await loadInstalledInfo();
      const res = await otaService.checkForUpdate();
      if (res.updateAvailable && res.update) {
        setUpdate(res.update);
        setUpdateAvailable(true);
        setIsDismissed(false);
        return { updateAvailable: true, update: res.update };
      } else {
        setUpdateAvailable(false);
        setUpdate(null);
        return { updateAvailable: false, message: res.message };
      }
    } catch (e) {
      console.warn('[useOtaUpdates] Check failed:', e);
      return { updateAvailable: false, error: e.message };
    } finally {
      setIsChecking(false);
    }
  }, [loadInstalledInfo]);

  const downloadAndInstall = useCallback(async () => {
    if (!update) return;
    setIsDownloading(true);
    setDownloadProgress(0.1);
    setProgressText('Starting download...');

    try {
      await otaService.downloadAndApplyUpdate(update, (progress, text) => {
        setDownloadProgress(progress);
        if (text) setProgressText(text);
      });

      setProgressText('Restarting app...');
      setTimeout(async () => {
        await otaService.reloadApp();
      }, 800);
    } catch (err) {
      console.error('[useOtaUpdates] Install error:', err);
      setProgressText('Update failed. Please retry.');
      setIsDownloading(false);
      throw err;
    }
  }, [update]);

  const dismissUpdate = useCallback(() => {
    setIsDismissed(true);
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
    updateAvailable: updateAvailable && !isDismissed,
    update,
    isMandatory: update?.updateType === 'mandatory',
    isDownloading,
    downloadProgress,
    progressText,
    installedInfo,
    checkForUpdates,
    downloadAndInstall,
    dismissUpdate,
    loadInstalledInfo,
  };
}

export default useOtaUpdates;
