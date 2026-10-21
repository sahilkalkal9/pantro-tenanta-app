import { Linking, Platform } from 'react-native';

export const UPI_APPS = {
  gpay: { name: 'Google Pay', scheme: 'gpay://', package: 'com.google.android.apps.nbu.paisa.user', storeUrl: 'https://play.google.com/store/apps/details?id=com.google.android.apps.nbu.paisa.user' },
  phonepe: { name: 'PhonePe', scheme: 'phonepe://', package: 'com.phonepe.app', storeUrl: 'https://play.google.com/store/apps/details?id=com.phonepe.app' },
  paytm: { name: 'Paytm', scheme: 'paytm://', package: 'net.one97.paytm', storeUrl: 'https://play.google.com/store/apps/details?id=net.one97.paytm' },
  bhim: { name: 'BHIM', scheme: 'bhim://', package: 'in.org.npci.upiapp', storeUrl: 'https://play.google.com/store/apps/details?id=in.org.npci.upiapp' },
  amazonpay: { name: 'Amazon Pay', scheme: 'amazonpay://', package: 'in.amazon.mShop.android.shopping', storeUrl: 'https://play.google.com/store/apps/details?id=in.amazon.mShop.android.shopping' },
};

export function generateUpiLink({ pa, pn, am, tn, cu = 'INR' }) {
  const params = new URLSearchParams();
  if (pa) params.append('pa', pa);
  if (pn) params.append('pn', pn);
  if (am) params.append('am', String(am));
  if (tn) params.append('tn', tn);
  if (cu) params.append('cu', cu);
  return `upi://pay?${params.toString()}`;
}

export async function detectInstalledUpiApps() {
  const installed = [];
  
  for (const [key, app] of Object.entries(UPI_APPS)) {
    try {
      const canOpen = await Linking.canOpenURL(app.scheme);
      if (canOpen) {
        installed.push({ key, ...app });
      }
    } catch (error) {
      console.warn(`Failed to check ${app.name}:`, error);
    }
  }
  
  return installed;
}

export async function openUpiApp(appKey, link) {
  const app = UPI_APPS[appKey];
  if (!app) throw new Error(`Unknown UPI app: ${appKey}`);
  
  try {
    const customLink = link.replace('upi://', app.scheme);
    const canOpen = await Linking.canOpenURL(customLink);
    
    if (canOpen) {
      await Linking.openURL(customLink);
      return { success: true, app: app.name };
    }
    
    // Fallback to generic UPI link
    const canOpenGeneric = await Linking.canOpenURL(link);
    if (canOpenGeneric) {
      await Linking.openURL(link);
      return { success: true, app: 'Default UPI app' };
    }
    
    throw new Error(`${app.name} is not installed or cannot handle UPI links`);
  } catch (error) {
    // If custom scheme fails, try generic
    try {
      await Linking.openURL(link);
      return { success: true, app: 'Default UPI app' };
    } catch (genericError) {
      throw new Error(`Failed to open UPI app: ${error.message}`);
    }
  }
}

export function openPlayStore(appKey) {
  const app = UPI_APPS[appKey];
  if (!app) return;
  
  const url = Platform.OS === 'android' ? app.storeUrl : `https://apps.apple.com/app/id${app.package}`;
  Linking.openURL(url);
}

export function buildUpiDeepLinkForRent({ payeeVpa, payeeName, amount, propertyName, month, year, tenantName }) {
  const tn = `Rent-${propertyName}-${month}/${year}-${tenantName}`.replace(/\s+/g, '-');
  return generateUpiLink({
    pa: payeeVpa,
    pn: payeeName,
    am: amount,
    tn,
  });
}

export function buildUpiDeepLinkForDeposit({ payeeVpa, payeeName, amount, propertyName, tenantName }) {
  const tn = `Deposit-${propertyName}-${tenantName}`.replace(/\s+/g, '-');
  return generateUpiLink({
    pa: payeeVpa,
    pn: payeeName,
    am: amount,
    tn,
  });
}

export function buildUpiDeepLinkForCharge({ payeeVpa, payeeName, amount, title, propertyName }) {
  const tn = `Charge-${title}-${propertyName}`.replace(/\s+/g, '-');
  return generateUpiLink({
    pa: payeeVpa,
    pn: payeeName,
    am: amount,
    tn,
  });
}