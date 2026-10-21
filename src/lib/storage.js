import AsyncStorage from '@react-native-async-storage/async-storage';

const TOKEN_KEY = 'pantro_tenant_token';
const USER_KEY = 'pantro_tenant_user';
const PUSH_TOKEN_KEY = 'pantro_tenant_push_token';

export async function setAuthToken(token) {
  await AsyncStorage.setItem(TOKEN_KEY, token);
}

export async function getAuthToken() {
  return await AsyncStorage.getItem(TOKEN_KEY);
}

export async function removeAuthToken() {
  await AsyncStorage.removeItem(TOKEN_KEY);
}

export async function setUserData(user) {
  await AsyncStorage.setItem(USER_KEY, JSON.stringify(user));
}

export async function getUserData() {
  const data = await AsyncStorage.getItem(USER_KEY);
  return data ? JSON.parse(data) : null;
}

export async function removeUserData() {
  await AsyncStorage.removeItem(USER_KEY);
}

export async function setPushToken(token) {
  await AsyncStorage.setItem(PUSH_TOKEN_KEY, token);
}

export async function getPushToken() {
  return await AsyncStorage.getItem(PUSH_TOKEN_KEY);
}

export async function clearAllAuthData() {
  await AsyncStorage.multiRemove([TOKEN_KEY, USER_KEY, PUSH_TOKEN_KEY]);
}