export function unwrapList(response, ...keys) {
  if (!response) return [];
  
  let data = response.data || response;
  
  for (const key of keys) {
    if (data && Array.isArray(data[key])) {
      return data[key];
    }
    if (data && data.data && Array.isArray(data.data[key])) {
      return data.data[key];
    }
  }
  
  if (Array.isArray(data)) return data;
  if (data && data.data && Array.isArray(data.data)) return data.data;
  if (data && data.data && Array.isArray(data.data.data)) return data.data.data;
  
  return [];
}

export function getErrorMessage(error) {
  if (!error) return 'Something went wrong. Please try again.';
  if (error.response?.data?.message) return error.response.data.message;
  if (error.response?.data?.error) return error.response.data.error;
  if (error.message) return error.message;
  return 'Something went wrong. Please try again.';
}

export function getPagination(response) {
  if (!response) return null;
  const data = response.data || response;
  return data.pagination || data.meta || null;
}

export function unwrapItem(response, ...keys) {
  if (!response) return null;
  
  let data = response.data || response;
  
  for (const key of keys) {
    if (data && data[key] && typeof data[key] === 'object') {
      return data[key];
    }
    if (data && data.data && data.data[key] && typeof data.data[key] === 'object') {
      return data.data[key];
    }
  }

  // Common response wrappers used in backend controllers
  const commonKeys = ['profile', 'dashboard', 'user', 'data', 'rent', 'complaint', 'notice'];
  for (const k of commonKeys) {
    if (data && data[k] && typeof data[k] === 'object') {
      return data[k];
    }
  }
  
  if (data && typeof data === 'object') return data;
  
  return null;
}