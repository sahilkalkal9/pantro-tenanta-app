import { NativeModules, Platform, DeviceEventEmitter } from 'react-native';

const { TenantPaymentModule } = NativeModules;

export const isNativeListenerSupported =
  Platform.OS === 'android' && Boolean(TenantPaymentModule);

export async function checkNotificationAccess() {
  if (!isNativeListenerSupported) return false;
  try {
    return await TenantPaymentModule.isNotificationAccessGranted();
  } catch (err) {
    console.warn('[TenantPaymentBridge] checkNotificationAccess error:', err);
    return false;
  }
}

export async function openNotificationSettings() {
  if (!isNativeListenerSupported) return false;
  try {
    return await TenantPaymentModule.openNotificationSettings();
  } catch (err) {
    console.warn('[TenantPaymentBridge] openNotificationSettings error:', err);
    return false;
  }
}

export async function getLastDetectedRrn(expectedAmount = 0, maxAgeMinutes = 15) {
  if (!isNativeListenerSupported) return null;
  try {
    const result = await TenantPaymentModule.getLastDetectedRrn(
      Number(expectedAmount) || 0,
      Number(maxAgeMinutes) || 15
    );
    return result;
  } catch (err) {
    console.warn('[TenantPaymentBridge] getLastDetectedRrn error:', err);
    return null;
  }
}

export async function clearLastDetectedRrn() {
  if (!isNativeListenerSupported) return false;
  try {
    return await TenantPaymentModule.clearLastDetectedRrn();
  } catch (err) {
    return false;
  }
}

export function subscribePaymentRrn(callback) {
  if (!isNativeListenerSupported || typeof callback !== 'function') {
    return () => {};
  }
  const subscription = DeviceEventEmitter.addListener('onPaymentRrnDetected', callback);
  return () => {
    subscription.remove();
  };
}
