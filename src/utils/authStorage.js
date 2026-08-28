const memoryAuthTokens = new Map();
const AUTH_MAX_AGE_SECONDS = 7 * 24 * 60 * 60;

export function getStoredAuthToken(key) {
  const memoryToken = memoryAuthTokens.get(key);
  if (memoryToken) return memoryToken;

  const cookieToken = getCookieValue(key);
  if (cookieToken) {
    memoryAuthTokens.set(key, cookieToken);
    return cookieToken;
  }

  return '';
}

export function storePersistentAuthToken(key, token) {
  memoryAuthTokens.set(key, token);
  localStorage.removeItem(key);
  sessionStorage.removeItem(key);
  setAuthCookie(key, token);
}

export function clearStoredAuthToken(key) {
  memoryAuthTokens.delete(key);
  clearLegacyPersistentAuthToken(key);
}

function getCookieValue(key) {
  const encodedKey = encodeURIComponent(key);
  const match = document.cookie
    .split(';')
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${encodedKey}=`));
  if (!match) return '';
  return decodeURIComponent(match.slice(encodedKey.length + 1));
}

function setAuthCookie(key, token) {
  const encodedKey = encodeURIComponent(key);
  const encodedToken = encodeURIComponent(token);
  const secure = window.location.protocol === 'https:' ? '; Secure' : '';
  document.cookie = `${encodedKey}=${encodedToken}; max-age=${AUTH_MAX_AGE_SECONDS}; path=/; SameSite=Lax${secure}`;
}

function clearLegacyPersistentAuthToken(key) {
  localStorage.removeItem(key);
  sessionStorage.removeItem(key);
  const encodedKey = encodeURIComponent(key);
  document.cookie = `${encodedKey}=; max-age=0; path=/; SameSite=Lax`;
  if (window.location.protocol === 'https:') {
    document.cookie = `${encodedKey}=; max-age=0; path=/; SameSite=Lax; Secure`;
  }
}
