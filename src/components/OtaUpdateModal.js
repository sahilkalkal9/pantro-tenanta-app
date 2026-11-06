import React from 'react';
import { useOtaUpdates } from '../hooks/useOtaUpdates';

/**
 * OtaUpdateModal
 * Silent Background Update Engine:
 * - Automatically checks for OTA updates in the background on startup.
 * - Downloads bundles silently without prompting or showing any popup modal.
 * - Applies downloaded updates automatically in background when app is minimized or relaunched.
 */
export default function OtaUpdateModal() {
  useOtaUpdates({ autoCheck: true, checkDelayMs: 1500 });
  return null;
}

