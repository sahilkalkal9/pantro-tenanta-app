import { useState, useCallback, useEffect } from 'react';
import { Linking, Platform } from 'react-native';
import { detectInstalledUpiApps, openUpiApp, buildUpiDeepLinkForRent, buildUpiDeepLinkForDeposit, buildUpiDeepLinkForCharge, UPI_APPS } from '../utils/upiDeepLink';
import { useDispatch, useSelector } from 'react-redux';
import { addToOfflineQueue } from '../slices/offlineSlice';
import { addToast } from '../slices/uiSlice';

export function useUpiDeepLink() {
  const dispatch = useDispatch();
  const [installedApps, setInstalledApps] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  
  const detectApps = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const apps = await detectInstalledUpiApps();
      setInstalledApps(apps);
      return apps;
    } catch (err) {
      setError(err.message);
      return [];
    } finally {
      setIsLoading(false);
    }
  }, []);
  
  const payRent = useCallback(async ({ payeeVpa, payeeName, amount, propertyName, month, year, tenantName, rentId, onSuccess }) => {
    setError(null);
    try {
      const link = buildUpiDeepLinkForRent({ payeeVpa, payeeName, amount, propertyName, month, year, tenantName });
      const result = await openUpiApp(installedApps[0]?.key || 'gpay', link);
      
      if (result.success) {
        dispatch(addToast({
          type: 'info',
          title: 'Payment Initiated',
          message: `Complete payment in ${result.app} and return to Pantro`,
        }));
        
        if (onSuccess) onSuccess({ link, app: result.app });
        
        // Queue for auto-detection via SMS
        dispatch(addToOfflineQueue({
          method: 'POST',
          url: '/tenant/upi/pending',
          data: {
            rentId,
            amount,
            payeeVpa,
            expectedUtr: null,
            initiatedAt: Date.now(),
          },
        }));
      }
      
      return result;
    } catch (err) {
      setError(err.message);
      throw err;
    }
  }, [installedApps]);
  
  const payDeposit = useCallback(async ({ payeeVpa, payeeName, amount, propertyName, tenantName, onSuccess }) => {
    setError(null);
    try {
      const link = buildUpiDeepLinkForDeposit({ payeeVpa, payeeName, amount, propertyName, tenantName });
      const result = await openUpiApp(installedApps[0]?.key || 'gpay', link);
      
      if (result.success) {
        dispatch(addToast({
          type: 'info',
          title: 'Payment Initiated',
          message: `Complete deposit payment in ${result.app}`,
        }));
        
        if (onSuccess) onSuccess({ link, app: result.app });
      }
      
      return result;
    } catch (err) {
      setError(err.message);
      throw err;
    }
  }, [installedApps]);
  
  const payCharge = useCallback(async ({ payeeVpa, payeeName, amount, title, propertyName, chargeId, onSuccess }) => {
    setError(null);
    try {
      const link = buildUpiDeepLinkForCharge({ payeeVpa, payeeName, amount, title, propertyName });
      const result = await openUpiApp(installedApps[0]?.key || 'gpay', link);
      
      if (result.success) {
        dispatch(addToast({
          type: 'info',
          title: 'Payment Initiated',
          message: `Complete charge payment in ${result.app}`,
        }));
        
        if (onSuccess) onSuccess({ link, app: result.app });
      }
      
      return result;
    } catch (err) {
      setError(err.message);
      throw err;
    }
  }, [installedApps]);
  
  const openApp = useCallback(async (appKey, link) => {
    setError(null);
    try {
      const result = await openUpiApp(appKey, link);
      return result;
    } catch (err) {
      setError(err.message);
      throw err;
    }
  }, []);
  
  return {
    installedApps,
    isLoading,
    error,
    detectApps,
    payRent,
    payDeposit,
    payCharge,
    openApp,
    upiApps: UPI_APPS,
  };
}

// Hook for handling UPI deep link return
export function useUpiReturnHandler() {
  const [returnData, setReturnData] = useState(null);
  
  useEffect(() => {
    const handleUrl = (url) => {
      if (url.startsWith('pantro-owner://') || url.startsWith('pantro-tenant://')) {
        const parsed = Linking.parse(url);
        setReturnData(parsed.queryParams);
      }
    };
    
    Linking.addEventListener('url', handleUrl);
    Linking.getInitialURL().then(handleUrl);
    
    return () => {
      Linking.removeEventListener('url', handleUrl);
    };
  }, []);
  
  return returnData;
}