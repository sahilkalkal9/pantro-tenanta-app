import { useCallback, useMemo } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { setTheme as setThemeAction, toggleTheme as toggleThemeAction } from '../slices/uiSlice';
import { getThemeColors } from '../constants/colors';

const THEME_STORAGE_KEY = 'pantro_theme_mode';

export function useTheme() {
  const dispatch = useDispatch();
  const theme = useSelector((state) => state.ui.theme) || 'light';

  const toggleTheme = useCallback(async () => {
    const next = theme === 'dark' ? 'light' : 'dark';
    dispatch(toggleThemeAction());
    try {
      await AsyncStorage.setItem(THEME_STORAGE_KEY, next);
    } catch (_) {}
  }, [theme, dispatch]);

  const setTheme = useCallback(async (mode) => {
    dispatch(setThemeAction(mode));
    try {
      await AsyncStorage.setItem(THEME_STORAGE_KEY, mode);
    } catch (_) {}
  }, [dispatch]);

  const isDark = theme === 'dark';
  const colors = useMemo(() => getThemeColors(isDark), [isDark]);

  return {
    theme,
    toggleTheme,
    setTheme,
    mounted: true,
    isDark,
    colors,
  };
}