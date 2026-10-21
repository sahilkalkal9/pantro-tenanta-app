import { useCallback, useMemo } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { addToast, removeToast } from '../slices/uiSlice';

export function useToast() {
  const dispatch = useDispatch();
  const toasts = useSelector((state) => state.ui.toasts);

  const show = useCallback((type, message, options = {}) => {
    dispatch(addToast({
      type,
      message,
      duration: options.duration || 4000,
      ...options,
    }));
  }, [dispatch]);

  const success = useCallback((message, options) => show('success', message, options), [show]);
  const error = useCallback((message, options) => show('error', message, options), [show]);
  const info = useCallback((message, options) => show('info', message, options), [show]);
  const warning = useCallback((message, options) => show('warning', message, options), [show]);

  const dismiss = useCallback((id) => {
    dispatch(removeToast(id));
  }, [dispatch]);

  const clear = useCallback(() => {
    //
  }, []);

  return useMemo(() => ({
    toasts,
    show,
    success,
    error,
    info,
    warning,
    dismiss,
    clear,
  }), [show, success, error, info, warning, dismiss, clear]);
}