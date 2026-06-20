const COOKIE_MAX_AGE = 60 * 60 * 24 * 365;

export function getStoredAuthToken(key) {
  return (
    getCookie(key) ||
    localStorage.getItem(key) ||
    sessionStorage.getItem(key)
  );
}

export function storePersistentAuthToken(key, token) {
  localStorage.setItem(key, token);
  sessionStorage.setItem(key, token);
  document.cookie = `${encodeURIComponent(key)}=${encodeURIComponent(token)}; max-age=${COOKIE_MAX_AGE}; path=/; SameSite=Lax`;
}

export function clearStoredAuthToken(key) {
  localStorage.removeItem(key);
  sessionStorage.removeItem(key);
  document.cookie = `${encodeURIComponent(key)}=; max-age=0; path=/; SameSite=Lax`;
}

function getCookie(key) {
  const encodedKey = encodeURIComponent(key);
  const match = document.cookie
    .split('; ')
    .find((row) => row.startsWith(`${encodedKey}=`));
  return match ? decodeURIComponent(match.slice(encodedKey.length + 1)) : null;
}
